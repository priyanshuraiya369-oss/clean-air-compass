import { reduceMotion } from './dom.mjs';

let observer = null;

/** Fade elements in as they scroll into view. Shows everything immediately if motion is reduced. */
export function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('in'));
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1 },
  );
  elements.forEach((el) => observer.observe(el));
}

/** Register an element that became visible after page load. */
export function observeReveal(el) {
  if (reduceMotion || !observer) el.classList.add('in');
  else if (!el.classList.contains('in')) observer.observe(el);
}
