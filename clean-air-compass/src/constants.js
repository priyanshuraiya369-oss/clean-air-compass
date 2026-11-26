'use strict';

/** Vocabulary shared by the rules engine, the AI sanitiser and the tests. */
const WHEN = Object.freeze(['today', 'this-week', 'long-term']);
const WHEN_ORDER = Object.freeze({ today: 0, 'this-week': 1, 'long-term': 2 });
const COST = Object.freeze(['free', 'low', 'medium', 'high']);
const EXPOSURE = Object.freeze(['high', 'medium', 'low']);
const SECTION_IDS = Object.freeze(['routine', 'indoor', 'sustainable']);

/** Sort comparator: urgent actions first. */
const byUrgency = (a, b) => WHEN_ORDER[a.when] - WHEN_ORDER[b.when];

module.exports = { WHEN, WHEN_ORDER, COST, EXPOSURE, SECTION_IDS, byUrgency };
