'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyAiToPlan } = require('../src/merge');
const { readConfig } = require('../src/config');
const { clientIp, HttpError } = require('../src/http');
const { loadStaticFiles } = require('../src/static');
const { validateProfile } = require('../src/validate');
const { buildPlan } = require('../src/engine');
const { byUrgency, WHEN_ORDER } = require('../src/constants');

const profile = validateProfile({ city: 'Delhi', language: 'hi' }).value;
const freshPlan = () => buildPlan(profile, { aqi: 200, city: 'Delhi', source: 'manual' });

test('applyAiToPlan without AI keeps the rules plan and marks it as such', () => {
  const plan = applyAiToPlan(freshPlan(), null, 'hi');
  assert.equal(plan.generatedBy, 'rules');
  assert.deepEqual(plan.localInsights, []);
  assert.equal(plan.language, 'hi');
});

test('applyAiToPlan swaps sections but never removes or reorders safety items', () => {
  const plan = freshPlan();
  const before = plan.safety.map((i) => i.id);
  const ai = {
    headline: 'H',
    summary: 'S',
    disclaimer: 'D',
    localInsights: ['L'],
    sections: [{ id: 'routine', title: 'R', items: [] }],
    safetyTranslations: { [before[0]]: { title: 'T', action: 'A', why: 'W', impact: 'I' } },
  };
  applyAiToPlan(plan, ai, 'hi');
  assert.equal(plan.generatedBy, 'gemini');
  assert.equal(plan.headline, 'H');
  assert.deepEqual(
    plan.safety.map((i) => i.id),
    before,
  );
  assert.equal(plan.safety[0].title, 'T');
  assert.ok(plan.safety[0].en.title);
  assert.ok(plan.safety.slice(1).every((i) => !i.en));
  assert.ok(plan.safety.every((i) => i.safety === true));
});

test('readConfig sanitises models, token and proxy hops', () => {
  const c = readConfig({
    GEMINI_API_KEY: 'k',
    GEMINI_MODEL: 'gemini-x',
    GEMINI_FALLBACK_MODELS: 'ok-1, bad name!, ../etc',
    TRUST_PROXY_HOPS: '2',
  });
  assert.deepEqual(c.models, ['gemini-x', 'ok-1']);
  assert.equal(c.trustedHops, 2);
  assert.equal(readConfig({}).models.length >= 1, true);
  assert.equal(readConfig({ TRUST_PROXY_HOPS: '-5' }).trustedHops, 0);
  assert.equal(readConfig({ TRUST_PROXY_HOPS: 'abc' }).trustedHops, 0);
});

test('clientIp only trusts forwarded headers for configured hops', () => {
  const req = { headers: { 'x-forwarded-for': 'spoofed, 1.2.3.4' }, socket: { remoteAddress: '9.9.9.9' } };
  assert.equal(clientIp(req, 0), '9.9.9.9');
  assert.equal(clientIp(req, 1), '1.2.3.4');
  assert.equal(clientIp(req, 5), '9.9.9.9');
});

test('HttpError carries status and details', () => {
  const e = new HttpError(429, 'slow down', { retryAfterSec: 3 });
  assert.equal(e.status, 429);
  assert.equal(e.details.retryAfterSec, 3);
  assert.ok(e instanceof Error);
});

test('loadStaticFiles walks sub-folders and ignores unknown file types', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'));
  fs.mkdirSync(path.join(dir, 'js'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>hi</p>');
  fs.writeFileSync(path.join(dir, 'js', 'a.mjs'), 'export const a = 1;');
  fs.writeFileSync(path.join(dir, 'secret.key'), 'nope');
  const files = loadStaticFiles(dir);
  assert.ok(files.has('/'));
  assert.ok(files.has('/index.html'));
  assert.match(files.get('/js/a.mjs').type, /javascript/);
  assert.ok(!files.has('/secret.key'));
  assert.ok(files.get('/index.html').gzip.length > 0);
});

test('byUrgency orders today before this-week before long-term', () => {
  const items = [{ when: 'long-term' }, { when: 'today' }, { when: 'this-week' }];
  assert.deepEqual(
    items.sort(byUrgency).map((i) => i.when),
    ['today', 'this-week', 'long-term'],
  );
  assert.equal(Object.keys(WHEN_ORDER).length, 3);
});

test('source files stay focused (200 lines or fewer)', () => {
  const root = path.join(__dirname, '..');
  const dirs = ['src', path.join('src', 'rules'), path.join('public', 'js')];
  const files = [path.join(root, 'server.js')];
  for (const dir of dirs) {
    for (const f of fs.readdirSync(path.join(root, dir))) {
      if (/\.(m?js)$/.test(f)) files.push(path.join(root, dir, f));
    }
  }
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n').length;
    assert.ok(lines <= 200, `${path.relative(root, file)} has ${lines} lines`);
  }
});
