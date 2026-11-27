'use strict';

const { categorize } = require('./aqi');
const { byUrgency } = require('./constants');
const { routineItems } = require('./rules/routine');
const { indoorItems } = require('./rules/indoor');
const { sustainableItems } = require('./rules/sustainable');
const { SAFETY_IDS } = require('./rules/safety');
const { groupRisk } = require('./rules/risk');
const { MYTHS } = require('./rules/myths');

/**
 * Deterministic rules engine. It guarantees a useful, safe, explainable plan even
 * when no AI key is configured or the AI call fails. Gemini only adds on top.
 * Rules live in src/rules/*; this file only assembles them into a plan.
 */

const HEADLINES = [
  'Air is clean today. Enjoy it and keep your habits low-emission.',
  'Air is acceptable. Take light precautions if you are sensitive.',
  'Smog is building. Protect sensitive family members today.',
  'Unhealthy air. Cut outdoor exposure and clean your indoor air.',
  'Very unhealthy air. Stay indoors as much as possible today.',
  'Hazardous air. Treat today as an indoor-only day.',
];

/**
 * @param {object} profile validated profile (see validate.js)
 * @param {{aqi:number,pm25?:number|null,pm10?:number|null,city?:string,source:string}} air
 */
function buildPlan(profile, air) {
  const cat = categorize(air.aqi);
  const sensitive = profile.household.children || profile.household.elderly || profile.household.sensitive;

  const sections = [
    { id: 'routine', title: 'Low-emission daily routine', items: routineItems(profile, cat.level, sensitive) },
    { id: 'indoor', title: 'Indoor air quality hacks', items: indoorItems(profile, cat.level, sensitive) },
    { id: 'sustainable', title: 'Sustainable alternatives', items: sustainableItems(profile) },
  ];

  const safety = [];
  for (const s of sections) {
    s.items = s.items.filter((i) => {
      if (!SAFETY_IDS.has(i.id)) return true;
      safety.push({ ...i, safety: true });
      return false;
    });
    s.items.sort(byUrgency);
  }
  safety.sort(byUrgency);

  const co2KgPerMonth =
    Math.round(sections[2].items.reduce((sum, i) => sum + (i.impact.co2KgPerMonth || 0), 0) * 10) / 10;

  const where = air.city || profile.city || 'your area';
  return {
    air: {
      aqi: Math.round(air.aqi),
      level: cat.level,
      id: cat.id,
      label: cat.label,
      pm25: air.pm25 ?? null,
      pm10: air.pm10 ?? null,
      forecast: air.forecast ?? null,
      city: where,
      source: air.source,
    },
    headline: HEADLINES[cat.level],
    summary: `${where}: AQI ${Math.round(air.aqi)} (${cat.label}). ${sensitive ? 'Because your household includes sensitive members, the plan leans cautious.' : 'Here is a plan matched to your home and daily routine.'}`,
    groupRisk: groupRisk(cat.level),
    safety,
    sections,
    computed: sections[2].items
      .filter((i) => i.impact.co2KgPerMonth)
      .map((i) => ({ title: i.title, co2KgPerMonth: i.impact.co2KgPerMonth })),
    totals: { co2KgPerMonth, actions: safety.length + sections.reduce((n, s) => n + s.items.length, 0) },
    myths: MYTHS,
    disclaimer:
      'Impact figures are rounded planning estimates, not measurements. This is general guidance, not medical advice. If you have heart or lung disease or feel unwell, follow your doctor\u2019s advice and seek care when needed.',
  };
}

module.exports = { buildPlan, MYTHS, SAFETY_IDS, groupRisk };
