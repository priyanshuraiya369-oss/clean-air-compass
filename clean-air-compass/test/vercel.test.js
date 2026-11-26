'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { SECURITY_HEADERS } = require('../server');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

test('vercel.json sends the same security headers as the Node server', () => {
  const rule = config.headers.find((h) => h.source === '/(.*)');
  assert.ok(rule);
  const sent = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
  assert.deepEqual(sent, SECURITY_HEADERS);
});

test('vercel.json routes /api/* to the function and bundles the public folder', () => {
  assert.equal(config.rewrites[0].source, '/api/(.*)');
  assert.equal(config.rewrites[0].destination, '/api/index.js');
  assert.equal(config.functions['api/index.js'].includeFiles, 'public/**');
  assert.ok(config.functions['api/index.js'].maxDuration >= 30);
});

test('api/index.js exports a request handler that serves the app', async () => {
  const handler = require('../api/index.js');
  assert.equal(typeof handler, 'function');
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    const bad = await fetch(`${base}/api/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
