'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { categorize, pm25ToAqi } = require('../src/aqi');

test('categorize maps AQI values to the right level', () => {
  assert.equal(categorize(0).level, 0);
  assert.equal(categorize(50).level, 0);
  assert.equal(categorize(51).level, 1);
  assert.equal(categorize(150).level, 2);
  assert.equal(categorize(151).level, 3);
  assert.equal(categorize(250).level, 4);
  assert.equal(categorize(400).level, 5);
  assert.equal(categorize(NaN).level, 0);
  assert.equal(categorize(-5).level, 0);
});

test('pm25ToAqi follows EPA breakpoints', () => {
  assert.equal(pm25ToAqi(0), 0);
  assert.equal(pm25ToAqi(9), 50);
  assert.equal(pm25ToAqi(35.4), 100);
  assert.equal(pm25ToAqi(55.4), 150);
  assert.equal(pm25ToAqi(125.4), 200);
  assert.equal(pm25ToAqi(999), 500);
});

test('pm25ToAqi rejects invalid input', () => {
  assert.equal(pm25ToAqi(-1), null);
  assert.equal(pm25ToAqi(NaN), null);
  assert.equal(pm25ToAqi(undefined), null);
});
