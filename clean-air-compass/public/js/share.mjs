import { $ } from './dom.mjs';
import { state } from './state.mjs';

function todayActions(plan) {
  const all = [...(plan.safety || []), ...plan.sections.flatMap((section) => section.items)];
  return all.filter((item) => item.when === 'today').slice(0, 4);
}

/** Short message for WhatsApp or the share sheet. */
export function shareText(plan, origin) {
  const lines = [
    `Clean Air Compass | ${plan.air.city}: AQI ${plan.air.aqi} (${plan.air.label})`,
    plan.headline,
    '',
    'Do today:',
  ];
  todayActions(plan).forEach((item) => lines.push(`- ${item.title}`));
  lines.push('', `Get a plan for your family: ${origin}`);
  return lines.join('\n');
}

/** The whole plan as plain text for copying. */
export function planToText(plan) {
  const lines = [
    `Clean Air Compass plan for ${plan.air.city}`,
    `AQI ${plan.air.aqi} (${plan.air.label})`,
    plan.headline,
    '',
    'SAFETY ESSENTIALS',
  ];
  for (const item of plan.safety || []) lines.push(`- ${item.title}: ${item.action}`);
  lines.push('');
  for (const section of plan.sections) {
    lines.push(section.title.toUpperCase());
    for (const item of section.items) lines.push(`- ${item.title}: ${item.action} Impact: ${item.impact.text}`);
    lines.push('');
  }
  lines.push(plan.disclaimer);
  return lines.join('\n');
}

export async function onShare() {
  if (!state.plan) return;
  const text = shareText(state.plan, window.location.origin);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Clean Air Compass', text });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export async function onCopy() {
  if (!state.plan) return;
  try {
    await navigator.clipboard.writeText(planToText(state.plan));
    $('progress-text').textContent = 'Plan copied to clipboard.';
  } catch {
    $('progress-text').textContent = 'Copy is not available in this browser. Use Print instead.';
  }
}
