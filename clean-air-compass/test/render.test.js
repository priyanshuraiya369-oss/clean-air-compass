'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { installFakeDom, FakeElement, findAll, hasClass } = require('./helpers/fake-dom');
const { validateProfile } = require('../src/validate');
const { buildPlan } = require('../src/engine');
const { applyAiToPlan } = require('../src/merge');
const { summarizeForecast } = require('../src/forecast');

const dom = installFakeDom();
const load = (name) => import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', name)).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function forecast() {
  const times = [];
  const values = [];
  for (let h = 0; h < 48; h++) {
    times.push(new Date(Date.UTC(2026, 10, 24, h)).toISOString().slice(0, 16));
    values.push(h >= 14 && h <= 16 ? 110 : 190);
  }
  return summarizeForecast(times, values, '2026-11-24T09:30');
}

function payload({ ai = false, withForecast = true, language = 'en' } = {}) {
  const profile = validateProfile({ city: 'Delhi', children: true, elderly: true, commute: 'car', language }).value;
  const plan = buildPlan(profile, { aqi: 185, pm25: 90, city: 'Delhi', source: 'open-meteo', forecast: withForecast ? forecast() : null });
  const item = (n) => ({ id: `ai-${n}`, title: `AI title ${n}`, action: 'Do it', why: 'Because', impact: { text: 'Helps', co2KgPerMonth: null, exposure: 'high' }, when: 'today', cost: 'free', by: 'gemini' });
  const aiResult = ai
    ? {
        headline: 'AI headline', summary: 'AI summary', disclaimer: 'AI disclaimer', localInsights: ['Local note'],
        sections: plan.sections.map((s) => ({ ...s, items: [item(1), item(2)] })),
        safetyTranslations: { [plan.safety[0].id]: { title: 'Translated', action: 'A', why: 'W', impact: 'I' } },
      }
    : null;
  applyAiToPlan(plan, aiResult, language);
  return { plan, ai: { used: Boolean(aiResult), model: aiResult ? 'gemini-3.5-flash' : null, available: Boolean(aiResult) } };
}

test('renderPlan fills the gauge, risk meters, chart, safety block and sections', async () => {
  const { renderPlan } = await load('plan.mjs');
  const p = payload({ ai: true });
  renderPlan(p);
  const $ = (id) => dom.registry.get(id);

  assert.equal($('results').hidden, false);
  assert.equal($('air-card').dataset.level, String(p.plan.air.level));
  assert.equal(findAll($('air-card'), (e) => e.classes.has('seg')).length, 6);
  assert.equal($('group-risk').children.length, 4);
  assert.equal($('headline').textContent, 'AI headline');

  const bars = findAll($('chart'), (e) => e.tagName === 'rect' && e.classes.has('bar'));
  assert.equal(bars.length, 24);
  assert.equal(findAll($('chart'), hasClass('best-band')).length, 1);
  assert.equal(findAll($('chart-table'), (e) => e.tagName === 'tr').length, 25);
  assert.equal($('chart-card').hidden, false);

  assert.equal($('safety-list').children.length, p.plan.safety.length);
  assert.equal($('safety').hidden, false);
  assert.equal($('sections').children.length, 3);
  assert.match($('ai-box').textContent, /Personalised by Gemini/);
  assert.match($('ai-box').textContent, /Local note/);
  assert.equal($('disclaimer').textContent, 'AI disclaimer');
  assert.equal($('ring-text').textContent, '0%');

  await sleep(220);
  assert.match($('air-card').children[0].children.find((c) => c.classes.has('needle')).style.transform, /^rotate\(-?[\d.]+deg\)$/);
  assert.ok(findAll($('group-risk'), hasClass('meter-fill')).every((f) => f.classes.has('go')));
});

test('translated safety items expose the English original', async () => {
  const { renderPlan } = await load('plan.mjs');
  renderPlan(payload({ ai: true, language: 'hi' }));
  const details = findAll(dom.registry.get('safety-list'), (e) => e.tagName === 'details');
  assert.equal(details.length, 1);
  assert.match(details[0].textContent, /English original/);
});

test('ticking actions updates the progress ring, text and saved progress', async () => {
  const { renderPlan } = await load('plan.mjs');
  const { state } = await load('state.mjs');
  renderPlan(payload());
  const $ = (id) => dom.registry.get(id);
  assert.ok(state.boxes.length > 8);
  assert.match($('progress-text').textContent, /Tick actions/);

  state.boxes[0].checked = true;
  state.boxes[0].fire('change');
  assert.notEqual($('ring-text').textContent, '0%');
  assert.match($('progress-text').textContent, /1 of \d+ actions done/);
  assert.ok(dom.window.localStorage.getItem('cac:done:v1').includes('|'));

  state.boxes.forEach((box) => { box.checked = true; box.fire('change'); });
  assert.equal($('ring-text').textContent, '100%');
  assert.match($('progress-text').textContent, /All done/);
  assert.equal($('progress-card').classes.has('complete'), true);
  assert.equal($('ring-fg').style.strokeDashoffset, '0');

  renderPlan(payload());
  assert.match($('progress-text').textContent, /actions done|All done/, 'progress is restored from storage');
});

test('rules-only plans explain where the plan came from; missing forecast hides the chart', async () => {
  const { renderPlan } = await load('plan.mjs');
  renderPlan(payload({ ai: false, withForecast: false }));
  const $ = (id) => dom.registry.get(id);
  assert.match($('ai-box').textContent, /No Gemini key is configured/);
  assert.equal($('chart-card').hidden, true);
});

test('pure helpers: bestIndex, arcPath, shareText, planToText, purifierMessage', async () => {
  const { bestIndex } = await load('chart.mjs');
  const { arcPath } = await load('gauge.mjs');
  const { shareText, planToText } = await load('share.mjs');
  const { purifierMessage } = await load('toolbox.mjs');
  const p = payload({ ai: false });

  const f = p.plan.air.forecast;
  assert.equal(f.hours[bestIndex(f.hours, f.best)].t.slice(11, 16), f.best.from);
  assert.equal(bestIndex(f.hours, null), -1);

  assert.match(arcPath(110, 110, 90, 0, 30), /^M [\d. -]+ A 90 90 0 0 1 [\d. -]+$/);

  const share = shareText(p.plan, 'https://example.test');
  assert.match(share, /Delhi: AQI 185/);
  assert.match(share, /Do today:/);
  assert.match(share, /https:\/\/example\.test/);
  assert.ok(share.split('\n').filter((l) => l.startsWith('- ')).length <= 4);

  const text = planToText(p.plan);
  assert.match(text, /SAFETY ESSENTIALS/);
  assert.match(text, /not medical advice/i);

  assert.match(purifierMessage({ areaM2: 14, volumeM3: 37.8, cadrM3h: 181, cadrCfm: 107 }), /181 m/);
  assert.match(purifierMessage(null), /sensible room sizes/);
});

test('dom helpers build elements safely (text is never parsed as HTML)', async () => {
  const { h, s, clear } = await load('dom.mjs');
  const el = h('p', { class: 'x', 'data-a': 'b', skip: false }, '<img src=x onerror=alert(1)>', h('span', { text: 'child' }));
  assert.ok(el instanceof FakeElement);
  assert.equal(el.getAttribute('class'), 'x');
  assert.equal(el.getAttribute('skip'), null);
  assert.equal(el.children[0].data, '<img src=x onerror=alert(1)>');
  assert.equal(el.children.length, 2);
  assert.equal(s('svg', {}).tagName, 'svg');
  clear(el);
  assert.equal(el.children.length, 0);
});
