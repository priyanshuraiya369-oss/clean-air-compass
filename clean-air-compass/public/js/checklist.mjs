import { $, store } from './dom.mjs';
import { state, tools } from './state.mjs';

const STORE_KEY = 'cac:done:v1';
const RING_CIRCUMFERENCE = 213.63;
const MAX_REMEMBERED_PLANS = 5;

/** Titles the user already ticked for this plan (kept only in this browser). */
export function loadDone(key) {
  const saved = store((ls) => JSON.parse(ls.getItem(STORE_KEY) || '{}'));
  const titles = saved && Array.isArray(saved[key]) ? saved[key] : [];
  return new Set(titles.filter((t) => typeof t === 'string').slice(0, 100));
}

function saveDone() {
  store((ls) => {
    const saved = JSON.parse(ls.getItem(STORE_KEY) || '{}');
    saved[state.doneKey] = [...state.done];
    const keys = Object.keys(saved);
    while (keys.length > MAX_REMEMBERED_PLANS) delete saved[keys.shift()];
    ls.setItem(STORE_KEY, JSON.stringify(saved));
  });
}

function progressMessage(done, total, pct) {
  if (done === 0) return 'Tick actions as you do them to track your progress.';
  if (pct === 100) return 'All done. Your family is breathing easier!';
  return `${done} of ${total} actions done. Keep going!`;
}

/** Refresh the progress ring and text from the checkboxes on screen. */
export function updateProgress() {
  const total = state.boxes.length;
  const done = state.boxes.filter((box) => box.checked).length;
  const pct = tools().percent(done, total);
  $('ring-fg').style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct / 100));
  $('ring-text').textContent = `${pct}%`;
  $('progress-text').textContent = progressMessage(done, total, pct);
  $('progress-card').classList.toggle('complete', pct === 100 && total > 0);
}

/** Wire a checkbox to the saved checklist and progress ring. */
export function bindCheckbox(box, title, li) {
  state.boxes.push(box);
  li.classList.toggle('is-done', box.checked);
  box.addEventListener('change', () => {
    li.classList.toggle('is-done', box.checked);
    if (box.checked) state.done.add(title);
    else state.done.delete(title);
    saveDone();
    updateProgress();
  });
}
