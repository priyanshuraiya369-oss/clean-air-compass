'use strict';

const MAX_BODY_BYTES = 16 * 1024;

const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
    "manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
});

/** An error that maps directly onto an HTTP response. */
class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message safe, user-facing message
   * @param {unknown} [details] extra safe details (for example validation errors)
   */
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
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

/** Read and parse a JSON request body, enforcing content type and size. */
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

/** Client IP for rate limiting. Only trusts X-Forwarded-For for an explicit number of proxy hops. */
function clientIp(req, trustedHops) {
  if (trustedHops > 0) {
    const forwarded = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const index = forwarded.length - trustedHops;
    if (index >= 0) return forwarded[index];
  }
  return req.socket.remoteAddress || 'unknown';
}

module.exports = { HttpError, SECURITY_HEADERS, sendJson, readJsonBody, clientIp };
