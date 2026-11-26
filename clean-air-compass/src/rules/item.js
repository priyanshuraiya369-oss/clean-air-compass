'use strict';

/**
 * Build one plan item.
 * @param {string} id stable identifier
 * @param {string} title short imperative title
 * @param {string} action concrete steps
 * @param {string} why the reason it matters
 * @param {{text:string, co2?:number|null, exposure?:'high'|'medium'|'low'|null}} impact
 * @param {import('../types').When} when
 * @param {import('../types').Cost} cost
 * @returns {import('../types').PlanItem}
 */
function item(id, title, action, why, impact, when, cost) {
  return {
    id,
    title,
    action,
    why,
    impact: { text: impact.text, co2KgPerMonth: impact.co2 ?? null, exposure: impact.exposure ?? null },
    when,
    cost,
  };
}

module.exports = { item };
