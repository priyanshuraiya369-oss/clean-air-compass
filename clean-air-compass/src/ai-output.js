'use strict';

const { cleanText } = require('./validate');
const { WHEN, COST, EXPOSURE, SECTION_IDS, byUrgency } = require('./constants');

/**
 * Everything that turns untrusted model output into safe, bounded plan data.
 * Nothing the model returns reaches the page without passing through here.
 */

// Advice we never pass on, even if the model produces it.
const UNSAFE = /ozone generator|ionizer|ionizing purifier|\b\d+\s?(mg|mcg|ml)\b|dosage|antibiotic|steroid|burn (wood|coal|charcoal|incense|waste)[^.]*\b(indoors?|inside|room)\b|\bstop taking\b|\bdiagnos/i;

/** Parse JSON even if the model wrapped it in a markdown fence. */
function parseJson(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pick(value, allowed, fallback) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function sanitizeItem(raw, id) {
  if (!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title, 90);
  const action = cleanText(raw.action, 340);
  const why = cleanText(raw.why, 340);
  const impact = cleanText(raw.impact, 280);
  if (!title || !action || !why || !impact) return null;
  if (UNSAFE.test(`${title} ${action} ${why} ${impact}`)) return null;
  return {
    id,
    title,
    action,
    why,
    // CO2 numbers always come from our own calculator, never from the model.
    impact: { text: impact, co2KgPerMonth: null, exposure: pick(raw.exposure, EXPOSURE, null) },
    when: pick(raw.when, WHEN, 'this-week'),
    cost: pick(raw.cost, COST, 'low'),
    by: 'gemini',
  };
}

/**
 * Faithful translations of the guaranteed safety items. Only ids that exist are accepted,
 * so the model can neither add nor remove safety items.
 * @returns {Record<string,{title:string,action:string,why:string,impact:string}>}
 */
function sanitizeSafetyTranslations(raw, safety) {
  const ids = new Set((safety || []).map((i) => i.id));
  const out = {};
  for (const t of Array.isArray(raw) ? raw : []) {
    if (!t || !ids.has(t.id) || out[t.id]) continue;
    const entry = {
      title: cleanText(t.title, 160),
      action: cleanText(t.action, 560),
      why: cleanText(t.why, 560),
      impact: cleanText(t.impact, 400),
    };
    if (!entry.title || !entry.action || !entry.why || !entry.impact) continue;
    if (UNSAFE.test(`${entry.title} ${entry.action} ${entry.why} ${entry.impact}`)) continue;
    out[t.id] = entry;
  }
  return out;
}

/**
 * Validate and bound the model's plan. Sections with fewer than 2 valid items fall back
 * to the rules engine's items, so the user always gets all three sections.
 * @returns {{headline:string,summary:string,localInsights:string[],sections:object[]}|null}
 */
function sanitizeAiPlan(raw, rulesSections, safety = []) {
  const parsed = typeof raw === 'string' ? parseJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return null;
  const byId = new Map();
  for (const sec of Array.isArray(parsed.sections) ? parsed.sections : []) {
    if (sec && SECTION_IDS.includes(sec.id) && !byId.has(sec.id)) byId.set(sec.id, sec);
  }
  let aiSections = 0;
  const sections = rulesSections.map((fallback) => {
    const sec = byId.get(fallback.id);
    const items = (sec && Array.isArray(sec.items) ? sec.items : [])
      .slice(0, 8)
      .map((it, i) => sanitizeItem(it, `ai-${fallback.id}-${i + 1}`))
      .filter(Boolean);
    if (items.length >= 2) {
      aiSections += 1;
      items.sort(byUrgency);
      return { id: fallback.id, title: fallback.title, items };
    }
    return fallback;
  });
  if (aiSections === 0) return null;
  const localInsights = (Array.isArray(parsed.localInsights) ? parsed.localInsights : [])
    .slice(0, 3)
    .map((t) => cleanText(t, 260))
    .filter((t) => t && !UNSAFE.test(t));
  return {
    headline: cleanText(parsed.headline, 140),
    summary: cleanText(parsed.summary, 520),
    localInsights,
    sections,
    safetyTranslations: sanitizeSafetyTranslations(parsed.safetyTranslations, safety),
    disclaimer: cleanText(parsed.disclaimer, 700),
  };
}

module.exports = { sanitizeAiPlan, sanitizeSafetyTranslations, UNSAFE };
