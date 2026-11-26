import { $ } from './dom.mjs';
import { postJson } from './api.mjs';
import { state } from './state.mjs';

export async function onAsk(event) {
  event.preventDefault();
  const out = $('answer');
  out.textContent = 'Thinking\u2026';
  try {
    const air = state.plan ? state.plan.air : null;
    const payload = await postJson('/api/ask', {
      question: $('question').value,
      language: $('language').value,
      context: { city: air ? air.city : '', aqi: air ? air.aqi : null },
    });
    out.textContent = payload.source === 'gemini' ? `${payload.answer}\n\n(Gemini, ${payload.model})` : payload.answer;
  } catch (err) {
    out.textContent = [err.message, ...(err.details || [])].join(' ');
  }
}
