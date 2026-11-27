'use strict';

const http = require('node:http');
const path = require('node:path');

const { readConfig } = require('./src/config');
const { createGeoClient } = require('./src/geo');
const { createGeminiClient } = require('./src/gemini');
const { createResilientFetch } = require('./src/net');
const { createRateLimiter } = require('./src/ratelimit');
const { createHandlers } = require('./src/handlers');
const { loadStaticFiles, serveStatic } = require('./src/static');
const { HttpError, SECURITY_HEADERS, sendJson, clientIp } = require('./src/http');

const PUBLIC_DIR = path.join(__dirname, 'public');
const RATE_LIMIT = { limit: 30, windowMs: 60 * 1000 };

/**
 * Build the HTTP server. Dependencies are injectable so tests never hit the network.
 * @param {{env?:object, fetchImpl?:typeof fetch, now?:()=>number, quiet?:boolean}} [opts]
 */
function createApp({ env = process.env, fetchImpl = createResilientFetch(), now = Date.now, quiet = false } = {}) {
  const config = readConfig(env);
  const warn = quiet ? () => {} : (entry) => console.warn(JSON.stringify(entry));
  const statics = loadStaticFiles(PUBLIC_DIR);
  const geo = createGeoClient({ fetchImpl, now, waqiToken: config.waqiToken });
  const gemini = createGeminiClient({ apiKey: config.geminiKey, models: config.models, fetchImpl, log: warn });
  const handlers = createHandlers({ geo, gemini, warn });
  const limiter = createRateLimiter({ ...RATE_LIMIT, now });

  /** method + path -> handler. Anything else under /api returns 404 or 405. */
  const routes = {
    'GET /api/health': handlers.handleHealth,
    'GET /api/reverse': handlers.handleReverse,
    'POST /api/plan': handlers.handlePlan,
    'POST /api/ask': handlers.handleAsk,
  };
  const knownPaths = new Set(Object.keys(routes).map((key) => key.split(' ')[1]));

  async function route(req, res, pathname) {
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
      serveStatic(statics, req, res);
      return;
    }
    const verdict = limiter.check(clientIp(req, config.trustedHops));
    if (!verdict.allowed) {
      throw new HttpError(429, 'Too many requests. Please wait a moment and try again.', {
        retryAfterSec: verdict.retryAfterSec,
      });
    }
    const handler = routes[`${req.method} ${pathname}`];
    if (handler) return handler(req, res);
    throw new HttpError(
      knownPaths.has(pathname) ? 405 : 404,
      knownPaths.has(pathname) ? 'Method not allowed.' : 'Not found.',
    );
  }

  function sendError(res, err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (!res.headersSent) {
      const extra = status === 429 && err.details ? { 'Retry-After': String(err.details.retryAfterSec) } : {};
      const message = status === 500 ? 'Something went wrong on our side.' : err.message;
      sendJson(res, status, { error: message, details: err.details }, extra);
    }
    if (status === 500) warn({ level: 'error', message: String(err && err.message) });
  }

  const server = http.createServer(async (req, res) => {
    const started = now();
    try {
      await route(req, res, new URL(req.url, 'http://localhost').pathname);
    } catch (err) {
      sendError(res, err);
    } finally {
      if (!quiet) {
        console.log(
          JSON.stringify({
            method: req.method,
            path: String(req.url).split('?')[0],
            status: res.statusCode,
            ms: now() - started,
          }),
        );
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
