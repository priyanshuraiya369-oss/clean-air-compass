import { $, h, clear, reduceMotion } from './dom.mjs';
import { state } from './state.mjs';
import { renderGauge } from './gauge.mjs';
import { renderGroupRisk } from './risk.mjs';
import { renderChart } from './chart.mjs';
import { renderItem, renderSection } from './items.mjs';
import { loadDone, updateProgress } from './checklist.mjs';
import { observeReveal } from './reveal.mjs';

const REVEAL_IDS = [
  'overview',
  'headline',
  'summary',
  'chart-card',
  'ai-box',
  'safety',
  'progress-card',
  'myths-card',
  'ask-section',
];

function renderAiBox(plan, ai) {
  const box = $('ai-box');
  clear(box);
  if (ai && ai.used) {
    box.append(
      h('h3', { text: 'Personalised by Gemini' }),
      h('p', { class: 'help', text: `Model: ${ai.model}. CO2 figures are calculated by the app, not by the AI.` }),
    );
    if (plan.localInsights && plan.localInsights.length) {
      box.append(
        h('p', { class: 'label', text: 'Local considerations' }),
        h(
          'ul',
          {},
          plan.localInsights.map((t) => h('li', { text: t })),
        ),
      );
    }
  } else {
    const message =
      ai && ai.available
        ? 'Gemini did not respond this time, so this plan comes from the built-in rules engine. Try again for a fully AI-personalised plan.'
        : 'No Gemini key is configured, so this plan comes from the built-in rules engine.';
    box.append(h('h3', { text: 'Built-in expert rules' }), h('p', { text: message }));
  }
  box.hidden = false;
}

function renderSafety(plan) {
  const list = $('safety-list');
  clear(list);
  (plan.safety || []).forEach((item, i) => list.append(renderItem(item, i)));
  $('safety').hidden = !(plan.safety && plan.safety.length);
}

function renderSections(plan) {
  const container = $('sections');
  clear(container);
  let offset = 0;
  for (const section of plan.sections) {
    container.append(renderSection(section, offset));
    offset += section.items.length;
  }
}

function renderMyths(plan) {
  const list = $('myths');
  clear(list);
  plan.myths.forEach((m) => list.append(h('dt', { text: `Myth: ${m.myth}` }), h('dd', { text: `Fact: ${m.fact}` })));
}

function impactSummary(plan) {
  return plan.totals.co2KgPerMonth > 0
    ? `Calculated from your inputs: the swaps in this plan could save roughly ${plan.totals.co2KgPerMonth} kg CO2e a month.`
    : `${plan.totals.actions} actions tailored to your household.`;
}

/** Render a full plan response into the page. */
export function renderPlan(payload) {
  const { plan } = payload;
  state.plan = plan;
  state.ai = payload.ai;
  state.doneKey = `${plan.air.city}|${new Date().toISOString().slice(0, 10)}|${plan.language || 'en'}`;
  state.done = loadDone(state.doneKey);
  state.boxes = [];

  renderGauge(plan.air);
  renderGroupRisk(plan.groupRisk || []);
  $('headline').textContent = plan.headline;
  $('summary').textContent = plan.summary;
  renderChart(plan.air);
  renderAiBox(plan, payload.ai);
  renderSafety(plan);
  $('impact-total').textContent = impactSummary(plan);
  renderSections(plan);
  renderMyths(plan);
  $('disclaimer').textContent = plan.disclaimer;

  $('results').hidden = false;
  $('ask-section').hidden = false;
  $('answer').textContent = '';
  REVEAL_IDS.forEach((id) => observeReveal($(id)));
  updateProgress();
  $('results-title').focus({ preventScroll: true });
  $('results').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
}
