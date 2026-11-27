'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createResilientFetch, isNetworkFailure } = require('../src/net');
const { summarizeForecast } = require('../src/forecast');

const dnsError = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });

test('uses the normal fetch when it works', async () => {
  const f = createResilientFetch({
    primary: async () => ({ ok: true, tag: 'primary' }),
    fallback: async () => {
      throw new Error('no');
    },
  });
  assert.equal((await f('https://x.test')).tag, 'primary');
});

test('retries through public DNS on ENOTFOUND', async () => {
  const f = createResilientFetch({
    primary: async () => {
      throw dnsError();
    },
    fallback: async () => ({ ok: true, tag: 'fallback' }),
  });
  assert.equal((await f('https://x.test')).tag, 'fallback');
});

test('retries through public DNS when the primary attempt hangs', async () => {
  const f = createResilientFetch({
    primaryTimeoutMs: 20,
    primary: (_u, init) =>
      new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason))),
    fallback: async () => ({ ok: true, tag: 'fallback' }),
  });
  assert.equal((await f('https://x.test')).tag, 'fallback');
});

test('does not retry on unrelated errors or when the caller aborted', async () => {
  let calls = 0;
  const fallback = async () => {
    calls += 1;
    return { ok: true };
  };
  const f = createResilientFetch({
    primary: async () => {
      throw new Error('boom');
    },
    fallback,
  });
  await assert.rejects(f('https://x.test'), /boom/);
  const ctrl = new AbortController();
  ctrl.abort();
  const g = createResilientFetch({
    primary: async () => {
      throw dnsError();
    },
    fallback,
  });
  await assert.rejects(g('https://x.test', { signal: ctrl.signal }));
  assert.equal(calls, 0);
  assert.equal(isNetworkFailure(dnsError()), true);
  assert.equal(isNetworkFailure(new Error('x')), false);
});

test('summarizeForecast finds the cleanest daytime and dirtiest windows', () => {
  const times = [];
  const vals = [];
  for (let h = 0; h < 48; h++) {
    times.push(new Date(Date.UTC(2026, 10, 24, h)).toISOString().slice(0, 16));
    vals.push(h < 8 ? 300 : h >= 14 && h <= 16 ? 120 : 200);
  }
  const out = summarizeForecast(times, vals, '2026-11-24T09:30');
  assert.deepEqual(out.best, { day: 'today', from: '14:00', to: '16:00', aqi: 120 });
  assert.equal(out.worst.aqi, 200);
  assert.equal(summarizeForecast([], [], '2026-11-24T09:30'), null);
  assert.equal(summarizeForecast(times, vals, ''), null);
});
