'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfile } = require('../src/validate');
const { buildPlan, groupRisk } = require('../src/engine');
const { commuteMonthlyKg, commuteSavingKg, heaterSavingKg } = require('../src/impact');

const profile = (over = {}) => {
  const r = validateProfile({ city: 'Delhi', ...over });
  assert.ok(r.ok, JSON.stringify(r.errors));
  return r.value;
};
const air = (aqi) => ({ aqi, pm25: null, pm10: null, city: 'Delhi', source: 'manual' });
const ids = (plan) => [...plan.safety, ...plan.sections.flatMap((s) => s.items)].map((i) => i.id);

test('plan has the three required sections, each with impact explanations', () => {
  const plan = buildPlan(profile(), air(180));
  assert.deepEqual(
    plan.sections.map((s) => s.id),
    ['routine', 'indoor', 'sustainable'],
  );
  for (const s of plan.sections) {
    assert.ok(s.items.length > 0);
    for (const i of s.items) {
      assert.ok(i.title && i.action && i.why && i.impact.text, `incomplete item ${i.id}`);
    }
  }
});

test('critical items live in the guaranteed safety block, not in the sections', () => {
  const plan = buildPlan(profile({ children: true, heating: 'biomass' }), air(260));
  const safetyIds = plan.safety.map((i) => i.id);
  assert.ok(safetyIds.includes('wear-n95'));
  assert.ok(safetyIds.includes('stay-indoors-severe'));
  assert.ok(safetyIds.includes('medical-signs'));
  assert.ok(safetyIds.includes('heating-biomass'));
  assert.ok(plan.safety.every((i) => i.safety === true));
  for (const s of plan.sections) assert.ok(s.items.every((i) => !safetyIds.includes(i.id)));
  assert.ok(plan.sections.every((s) => s.items.length > 0));
});

test('clean air has no emergency items', () => {
  const list = ids(buildPlan(profile(), air(30)));
  assert.ok(!list.includes('medical-signs'));
  assert.ok(!list.includes('stay-indoors-severe'));
});

test('computed figures expose only calculator-made CO2 numbers', () => {
  const plan = buildPlan(profile({ commute: 'car', commuteKm: 10 }), air(150));
  assert.deepEqual(plan.computed, [{ title: 'Switch part of your commute to public transport', co2KgPerMonth: 72.8 }]);
});

test('item ids are unique within a plan', () => {
  const list = ids(buildPlan(profile({ commute: 'car', heating: 'electric_heater', homeType: 'house' }), air(220)));
  assert.equal(new Set(list).size, list.length);
});

test('high AQI recommends mask, indoor exercise and closed windows', () => {
  const list = ids(buildPlan(profile(), air(220)));
  assert.ok(list.includes('wear-n95'));
  assert.ok(list.includes('move-exercise-indoors'));
  assert.ok(list.includes('ventilation-timing'));
});

test('clean air does not push masks and encourages walking', () => {
  const list = ids(buildPlan(profile(), air(30)));
  assert.ok(!list.includes('wear-n95'));
  assert.ok(list.includes('walk-today'));
});

test('household members trigger tailored actions', () => {
  const list = ids(buildPlan(profile({ children: true, elderly: true, sensitive: true }), air(170)));
  assert.ok(list.includes('children-indoor-play'));
  assert.ok(list.includes('elderly-routine'));
  assert.ok(list.includes('clean-room'));
});

test('sensitive households get masks earlier (moderate AQI)', () => {
  assert.ok(ids(buildPlan(profile({ sensitive: true }), air(80))).includes('wear-n95'));
  assert.ok(!ids(buildPlan(profile(), air(80))).includes('wear-n95'));
});

test('budget and purifier ownership change the purifier advice', () => {
  assert.ok(ids(buildPlan(profile({ budget: 'low' }), air(150))).includes('corsi-rosenthal'));
  assert.ok(ids(buildPlan(profile({ budget: 'high' }), air(150))).includes('buy-hepa'));
  assert.ok(ids(buildPlan(profile({ hasPurifier: true }), air(150))).includes('use-purifier'));
});

test('biomass cooking and heating raise safety actions', () => {
  const list = ids(buildPlan(profile({ cooking: 'biomass', heating: 'biomass' }), air(150)));
  assert.ok(list.includes('cooking-biomass'));
  assert.ok(list.includes('heating-biomass'));
});

test('car commute yields a quantified CO2 saving that is totalled', () => {
  const plan = buildPlan(profile({ commute: 'car', commuteKm: 10 }), air(150));
  const swap = plan.sections[2].items.find((i) => i.id === 'commute-swap');
  assert.equal(swap.impact.co2KgPerMonth, 72.8);
  assert.equal(plan.totals.co2KgPerMonth, 72.8);
});

test('items are sorted today -> this-week -> long-term in every section', () => {
  const order = { today: 0, 'this-week': 1, 'long-term': 2 };
  const plan = buildPlan(profile({ commute: 'car', homeType: 'house' }), air(200));
  for (const s of plan.sections) {
    const ranks = s.items.map((i) => order[i.when]);
    assert.deepEqual(
      ranks,
      [...ranks].sort((a, b) => a - b),
    );
  }
});

test('plan always includes myths and a medical disclaimer', () => {
  const plan = buildPlan(profile(), air(100));
  assert.ok(plan.myths.length >= 3);
  assert.match(plan.disclaimer, /not medical advice/i);
});

test('impact maths is consistent', () => {
  assert.equal(commuteMonthlyKg('walk', 10), 0);
  assert.equal(commuteMonthlyKg('car', 10), 93.6);
  assert.equal(commuteSavingKg('public', 'car', 10), 0);
  assert.equal(heaterSavingKg(1), 31.5);
});

test('group risk rises with AQI and is higher for sensitive groups', () => {
  for (let level = 0; level <= 5; level++) {
    const [healthy, children, elderly, conditions] = groupRisk(level);
    assert.ok(healthy.risk <= children.risk);
    assert.ok(children.risk <= conditions.risk);
    assert.equal(children.risk, elderly.risk);
  }
  assert.equal(groupRisk(0)[0].riskLabel, 'Low');
  assert.equal(groupRisk(5)[3].riskLabel, 'Severe');
  assert.equal(groupRisk(99).length, 4);
  assert.equal(buildPlan(profile(), air(180)).groupRisk.length, 4);
});
