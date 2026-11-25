'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { validateProfile, validateQuestion } = require('./src/validate');
const { buildPlan } = require('./src/engine');
const { createGeoClient } = require('./src/geo');
const { createGeminiClient, DEFAULT_MODELS } = require('./src/gemini');
const { createResilientFetch } = require('./src/net');
const { createRateLimiter } = require('./src/ratelimit');
const { fallbackAnswer } = require('./src/faq');
const { categorize } = require('./src/aqi');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 16 * 1024;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
    "manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Load every public file once, with a pre-compressed copy, so requests do no disk I/O. */
function loadStaticFiles(dir) {
  const files = new Map();
  for (const name of fs.readdirSync(dir)) {
    const ext = path.extname(name);
    if (!CONTENT_TYPES[ext]) continue;
    const body = fs.readFileSync(path.join(dir, name));
    files.set(`/${name}`, {
      type: CONTENT_TYPES[ext],
      body,
      gzip: zlib.gzipSync(body, { level: 9 }),
      etag: `"${require('node:crypto').createHash('sha1').update(body).digest('base64url')}"`,
    });
  }
  if (files.has('/index.html')) files.set('/', files.get('/index.html'));
  return files;
}

function clientIp(req, trustedHops) {
  if (trustedHops > 0) {
    const xff = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = xff.length - trustedHops;
    if (idx >= 0) return xff[idx];
  }
  return req.socket.remoteAddress || 'unknown';
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.toLowerCase().startsWith('application/json')) {
      reject(new HttpError(415, 'Content-Type must be application/json.'));
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON.'));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'Could not read request body.')));
  });
}

/**
 * Build the HTTP server. Dependencies are injectable so tests never hit the network.
 * @param {{env?:object, fetchImpl?:typeof fetch, now?:()=>number, quiet?:boolean}} [opts]
 */
function createApp({ env = process.env, fetchImpl = createResilientFetch(), now = Date.now, quiet = false } = {}) {
  const statics = loadStaticFiles(PUBLIC_DIR);
  const geo = createGeoClient({ fetchImpl, now, waqiToken: env.WAQI_TOKEN || '' });
  const configuredModels = [env.GEMINI_MODEL, ...String(env.GEMINI_FALLBACK_MODELS || '').split(',')]
    .map((m) => String(m || '').trim())
    .filter((m) => /^[a-z0-9][a-z0-9.\-]{1,60}$/i.test(m));
  const gemini = createGeminiClient({
    apiKey: env.GEMINI_API_KEY,
    models: configuredModels.length ? configuredModels : DEFAULT_MODELS,
    fetchImpl,
    log: quiet ? () => {} : (entry) => console.warn(JSON.stringify(entry)),
  });
  const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000, now });
  const trustedHops = Math.max(0, parseInt(env.TRUST_PROXY_HOPS || '0', 10) || 0);

  async function resolveAir(profile) {
    if (Number.isFinite(profile.manualAqi)) {
      return { aqi: profile.manualAqi, pm25: null, pm10: null, city: profile.city, source: 'manual' };
    }
    try {
      let { lat, lon } = profile;
      let name = profile.city;
      if (!(Number.isFinite(lat) && Number.isFinite(lon))) {
        const place = await geo.geocode(profile.city);
        if (!place) throw new HttpError(404, `Could not find "${profile.city}". Check the spelling or enter an AQI value manually.`);
        ({ lat, lon } = place);
        name = place.name;
      }
      const air = await geo.airQuality(lat, lon);
      if (!air) throw new HttpError(502, 'No air-quality reading is available for that place. Enter an AQI value manually.');
      return { ...air, city: name || 'Your location' };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (!quiet) {
        const cause = err && err.cause ? err.cause.code || err.cause.message : '';
        console.warn(JSON.stringify({ level: 'warn', where: 'air-quality lookup', message: String(err && err.message), cause }));
      }
      throw new HttpError(502, 'Live air-quality data is unavailable right now. Enter an AQI value manually to continue.');
    }
  }

  async function handlePlan(req, res) {
    const parsed = validateProfile(await readJsonBody(req));
    if (!parsed.ok) throw new HttpError(400, 'Invalid input.', parsed.errors);
    const profile = parsed.value;
    const air = await resolveAir(profile);
    const plan = buildPlan(profile, air);
    const ai = await gemini.generatePlan(profile, plan);
    if (ai) {
      plan.sections = ai.sections;
      if (ai.headline) plan.headline = ai.headline;
      if (ai.summary) plan.summary = ai.summary;
      plan.localInsights = ai.localInsights;
      if (ai.disclaimer) plan.disclaimer = ai.disclaimer;
      plan.safety = plan.safety.map((item) => {
        const t = ai.safetyTranslations && ai.safetyTranslations[item.id];
        if (!t) return item;
        return {
          ...item,
          title: t.title,
          action: t.action,
          why: t.why,
          impact: { ...item.impact, text: t.impact },
          en: { title: item.title, action: item.action, why: item.why, impact: item.impact.text },
        };
      });
    } else {
      plan.localInsights = [];
    }
    plan.generatedBy = ai ? 'gemini' : 'rules';
    plan.language = profile.language;
    sendJson(res, 200, {
      plan,
      ai: { used: Boolean(ai), model: ai ? ai.model : null, available: gemini.enabled },
    });
  }

  async function handleReverse(req, res) {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new HttpError(400, 'Valid "lat" and "lon" query parameters are required.');
    }
    let name = null;
    try {
      name = await geo.reverse(lat, lon);
    } catch (err) {
      if (!quiet) console.warn(JSON.stringify({ level: 'warn', where: 'reverse geocode', message: String(err && err.message) }));
    }
    sendJson(res, 200, { name });
  }

  async function handleAsk(req, res) {
    const parsed = validateQuestion(await readJsonBody(req));
    if (!parsed.ok) throw new HttpError(400, 'Invalid input.', parsed.errors);
    const { question, context, language } = parsed.value;
    const ai = await gemini.answer(question, { ...context, language }, null);
    const category = context.aqi === null ? null : categorize(context.aqi).label;
    sendJson(res, 200, {
      answer: ai ? ai.text : fallbackAnswer(question),
      source: ai ? 'gemini' : 'rules',
      model: ai ? ai.model : null,
      category,
    });
  }

  function serveStatic(req, res) {
    const file = statics.get(new URL(req.url, 'http://localhost').pathname);
    if (!file) throw new HttpError(404, 'Not found.');
    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': file.type,
      ETag: file.etag,
      Vary: 'Accept-Encoding',
      'Cache-Control': 'no-cache',
    };
    if (req.headers['if-none-match'] === file.etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const wantsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
    const body = wantsGzip ? file.gzip : file.body;
    if (wantsGzip) headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  const server = http.createServer(async (req, res) => {
    const started = now();
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname.startsWith('/api/')) {
        const verdict = limiter.check(clientIp(req, trustedHops));
        if (!verdict.allowed) {
          throw new HttpError(429, 'Too many requests. Please wait a moment and try again.', {
            retryAfterSec: verdict.retryAfterSec,
          });
        }
        if (pathname === '/api/health' && req.method === 'GET') {
          sendJson(res, 200, { status: 'ok', ai: gemini.enabled, models: gemini.enabled ? gemini.models : [] });
        } else if (pathname === '/api/reverse' && req.method === 'GET') {
          await handleReverse(req, res);
        } else if (pathname === '/api/plan' && req.method === 'POST') {
          await handlePlan(req, res);
        } else if (pathname === '/api/ask' && req.method === 'POST') {
          await handleAsk(req, res);
        } else if (['/api/health', '/api/plan', '/api/ask', '/api/reverse'].includes(pathname)) {
          throw new HttpError(405, 'Method not allowed.');
        } else {
          throw new HttpError(404, 'Not found.');
        }
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        serveStatic(req, res);
      } else {
        throw new HttpError(405, 'Method not allowed.');
      }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (!res.headersSent) {
        const extra = status === 429 && err.details ? { 'Retry-After': String(err.details.retryAfterSec) } : {};
        sendJson(
          res,
          status,
          { error: status === 500 ? 'Something went wrong on our side.' : err.message, details: err.details },
          extra,
        );
      }
      if (status === 500 && !quiet) console.error(JSON.stringify({ level: 'error', message: String(err && err.message) }));
    } finally {
      if (!quiet) {
        console.log(JSON.stringify({ method: req.method, path: String(req.url).split('?')[0], status: res.statusCode, ms: now() - started }));
      }
    }
  });

  server.requestTimeout = 90000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (require.main === module) {
  // Prefer IPv4 first: avoids long stalls on networks with broken IPv6 (common on Windows).
  require('node:dns').setDefaultResultOrder('ipv4first');
  require('./src/env').loadEnvFile(path.join(__dirname, '.env'));
  const port = Number(process.env.PORT) || 8080;
  const server = createApp();
  server.listen(port, () => console.log(`Clean Air Compass listening on http://localhost:${port}`));
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { createApp, SECURITY_HEADERS };
