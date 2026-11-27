'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/ratelimit');
const { TtlCache } = require('../src/cache');

test('allows up to the limit then blocks, then resets after the window', () => {
  let t = 1000;
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
  assert.equal(rl.check('a').allowed, true);
  assert.equal(rl.check('a').allowed, true);
  const blocked = rl.check('a');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(rl.check('b').allowed, true, 'other clients are unaffected');
  t += 1001;
  assert.equal(rl.check('a').allowed, true);
});

test('memory stays bounded', () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 60000, maxKeys: 5 });
  for (let i = 0; i < 50; i++) rl.check(`ip-${i}`);
  assert.ok(rl.size() <= 5);
});

test('TtlCache expires entries and evicts when full', () => {
  let t = 0;
  const c = new TtlCache(100, 2, () => t);
  c.set('a', 1);
  assert.equal(c.get('a'), 1);
  t = 101;
  assert.equal(c.get('a'), undefined);
  c.set('x', 1);
  c.set('y', 2);
  c.set('z', 3);
  assert.equal(c.get('x'), undefined);
  assert.equal(c.get('z'), 3);
});

test('TtlCache uses a bounded default capacity', () => {
  const c = new TtlCache(100);
  for (let i = 0; i < 501; i++) c.set(`key-${i}`, i);
  assert.equal(c.get('key-0'), undefined);
  assert.equal(c.get('key-500'), 500);
});
