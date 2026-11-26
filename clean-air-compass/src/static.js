'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { HttpError, SECURITY_HEADERS } = require('./http');

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
});

/**
 * Load every servable file under `dir` once (with a pre-compressed copy) so requests do no disk I/O.
 * Only files found here can ever be served, which makes path traversal impossible.
 * @returns {Map<string, {type:string, body:Buffer, gzip:Buffer, etag:string}>}
 */
function loadStaticFiles(dir) {
  const files = new Map();
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), `${prefix}${entry.name}/`);
        continue;
      }
      const type = CONTENT_TYPES[path.extname(entry.name)];
      if (!type) continue;
      const body = fs.readFileSync(path.join(current, entry.name));
      files.set(`${prefix}${entry.name}`, {
        type,
        body,
        gzip: zlib.gzipSync(body, { level: 9 }),
        etag: `"${crypto.createHash('sha1').update(body).digest('base64url')}"`,
      });
    }
  };
  walk(dir, '/');
  if (files.has('/index.html')) files.set('/', files.get('/index.html'));
  return files;
}

/** Serve one preloaded file, honouring ETag and gzip. */
function serveStatic(files, req, res) {
  const file = files.get(new URL(req.url, 'http://localhost').pathname);
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

module.exports = { loadStaticFiles, serveStatic };
