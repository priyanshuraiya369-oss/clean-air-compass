'use strict';

/**
 * Offline fallback for follow-up questions when no AI key is configured or the AI call fails.
 * Each topic gives one concrete action plus the impact of doing it.
 */
const TOPICS = [
  {
    keys: ['mask', 'n95', 'ffp2', 'respirator'],
    answer:
      'Use a fitted N95 or FFP2 respirator outdoors on smoggy days. Impact: a good seal can cut the fine particles you inhale by up to roughly 90%, while cloth masks block far fewer.',
  },
  {
    keys: ['purifier', 'hepa', 'filter', 'corsi'],
    answer:
      'Run a HEPA purifier (or a DIY Corsi-Rosenthal box) in the room you use most with the door closed. Impact: typically roughly 50-80% lower indoor PM2.5 in that room.',
  },
  {
    keys: ['window', 'ventilat', 'open', 'fresh air'],
    answer:
      'On smoggy days keep windows shut and air out for about 10 minutes in early afternoon, when outdoor air is usually cleanest. Impact: keeps outdoor smog from flowing into the rooms where you spend most time.',
  },
  {
    keys: ['child', 'kid', 'school', 'baby', 'infant'],
    answer:
      'Keep children\u2019s outdoor play and sports indoors when AQI is above about 150, and make their bedroom your clean room. Impact: children breathe faster than adults, so this protects the most exposed family members.',
  },
  {
    keys: ['cook', 'kitchen', 'stove', 'chulha', 'lpg'],
    answer:
      'Use the chimney or exhaust fan while cooking and keep a window cracked. If you cook with wood or dung, move to LPG or induction. Impact: kitchens are often the biggest indoor source of fine particles.',
  },
  {
    keys: ['exercise', 'run', 'jog', 'walk', 'gym', 'yoga'],
    answer:
      'When AQI is above about 100 for sensitive people (150 for everyone), move exercise indoors. Impact: exercise multiplies how much air you breathe, so it multiplies your exposure too.',
  },
  {
    keys: ['plant', 'tulsi', 'money plant', 'snake'],
    answer:
      'Houseplants have a negligible effect on indoor air in real homes. Spend your effort on filtration, sealing gaps and ventilation timing instead.',
  },
  {
    keys: ['car', 'commute', 'metro', 'bus', 'bike', 'transport', 'carpool'],
    answer:
      'Swap some car or two-wheeler trips for metro, bus or carpooling. Impact: a 10 km each-way commute by car vs public transport saves roughly 70 kg CO2e a month and means fewer local tailpipe particles.',
  },
  {
    keys: ['burn', 'fire', 'cracker', 'diwali', 'waste'],
    answer:
      'Avoid burning leaves, waste, wood or firecrackers, and report open burning to your local authority. Impact: open burning is a major winter PM2.5 source for the whole neighbourhood.',
  },
];

const GENERIC =
  'Three moves help most on a smoggy day: wear a fitted N95 outdoors, keep indoor air clean with a purifier in one closed room, and move exercise indoors. Impact: together they can cut your exposure substantially.';

function fallbackAnswer(question) {
  const q = String(question || '').toLowerCase();
  const hit = TOPICS.find((t) => t.keys.some((k) => q.includes(k)));
  return hit ? hit.answer : GENERIC;
}

module.exports = { fallbackAnswer };
