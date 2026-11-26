import { $, setStatus } from './dom.mjs';

const MESSAGES = [
  'Reading live air quality\u2026',
  'Gemini is tailoring your plan. This can take up to 30 seconds\u2026',
  'Running safety checks\u2026',
];
const STEP_DELAYS_MS = [2200, 14000];
let timers = [];

function setStep(index) {
  [...$('loader-steps').children].forEach((li, i) => {
    li.classList.toggle('done', i < index);
    li.classList.toggle('active', i === index);
  });
  setStatus(MESSAGES[index]);
}

/** Show the three-step loading animation. */
export function startLoader() {
  $('loader').hidden = false;
  setStep(0);
  timers = STEP_DELAYS_MS.map((delay, i) => setTimeout(() => setStep(i + 1), delay));
}

export function stopLoader() {
  timers.forEach(clearTimeout);
  timers = [];
  $('loader').hidden = true;
}
