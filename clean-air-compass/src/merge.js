'use strict';

/**
 * Merge the model's output into the rules-based plan (mutates and returns `plan`).
 * The guaranteed safety block keeps its structure: only faithful text translations are applied,
 * and the English original is kept on each translated item.
 * @param {object} plan plan from buildPlan()
 * @param {object|null} ai result of gemini.generatePlan(), or null
 * @param {string} language requested output language code
 */
function applyAiToPlan(plan, ai, language) {
  plan.language = language;
  plan.generatedBy = ai ? 'gemini' : 'rules';
  plan.localInsights = ai ? ai.localInsights : [];
  if (!ai) return plan;

  plan.sections = ai.sections;
  if (ai.headline) plan.headline = ai.headline;
  if (ai.summary) plan.summary = ai.summary;
  if (ai.disclaimer) plan.disclaimer = ai.disclaimer;

  plan.safety = plan.safety.map((entry) => {
    const t = ai.safetyTranslations && ai.safetyTranslations[entry.id];
    if (!t) return entry;
    return {
      ...entry,
      title: t.title,
      action: t.action,
      why: t.why,
      impact: { ...entry.impact, text: t.impact },
      en: { title: entry.title, action: entry.action, why: entry.why, impact: entry.impact.text },
    };
  });
  return plan;
}

module.exports = { applyAiToPlan };
