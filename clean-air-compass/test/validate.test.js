'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfile, validateQuestion } = require('../src/validate');

test('accepts a minimal valid profile and applies defaults', () => {
  const r = validateProfile({ city: 'Jaipur' });
  assert.equal(r.ok, true);
  assert.equal(r.value.commute, 'public');
  assert.equal(r.value.commuteKm, 10);
  assert.equal(r.value.household.children, false);
});

test('rejects non-object bodies', () => {
  for (const bad of [null, 'x', 5, [], undefined]) assert.equal(validateProfile(bad).ok, false);
});

test('requires some way to determine air quality', () => {
  assert.equal(validateProfile({}).ok, false);
  assert.equal(validateProfile({ manualAqi: 180 }).ok, true);
  assert.equal(validateProfile({ lat: 26.9, lon: 75.8 }).ok, true);
});

test('rejects unknown enum values and out-of-range numbers', () => {
  assert.equal(validateProfile({ city: 'Delhi', commute: 'rocket' }).ok, false);
  assert.equal(validateProfile({ city: 'Delhi', commuteKm: 500 }).ok, false);
  assert.equal(validateProfile({ manualAqi: 900 }).ok, false);
  assert.equal(validateProfile({ lat: 120, lon: 10 }).ok, false);
});

test('rejects suspicious characters in city names', () => {
  assert.equal(validateProfile({ city: '<script>alert(1)</script>' }).ok, false);
  assert.equal(validateProfile({ city: "São Paulo" }).ok, true);
  assert.equal(validateProfile({ city: 'दिल्ली' }).ok, true);
});

test('strips control characters and truncates notes', () => {
  const r = validateProfile({ city: 'Delhi', notes: 'a\u0000b\n\nc' + 'x'.repeat(500) });
  assert.equal(r.ok, true);
  assert.ok(r.value.notes.length <= 200);
  assert.ok(!r.value.notes.includes('\u0000'));
});

test('validateQuestion enforces length and clamps context', () => {
  assert.equal(validateQuestion({ question: 'a' }).ok, false);
  const r = validateQuestion({ question: 'Is my mask ok?', context: { aqi: 9999, city: 'Delhi' } });
  assert.equal(r.ok, true);
  assert.equal(r.value.context.aqi, 500);
});

test('language defaults to English and only accepts known codes', () => {
  assert.equal(validateProfile({ city: 'Delhi' }).value.language, 'en');
  assert.equal(validateProfile({ city: 'Delhi', language: 'hi' }).value.language, 'hi');
  assert.equal(validateProfile({ city: 'Delhi', language: 'xx' }).ok, false);
  assert.equal(validateProfile({ city: 'Delhi', language: '__proto__' }).ok, false);
  assert.equal(validateQuestion({ question: 'hello there', language: 'ta' }).value.language, 'ta');
  assert.equal(validateQuestion({ question: 'hello there', language: 'zz' }).value.language, 'en');
});
