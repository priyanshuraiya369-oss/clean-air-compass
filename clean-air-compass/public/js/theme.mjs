import { $, store } from './dom.mjs';

const label = (theme) => (theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('theme-toggle').setAttribute('aria-label', label(theme));
  store((ls) => ls.setItem('cac:theme', theme));
}

export function initTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  $('theme-toggle').setAttribute('aria-label', label(current));
  $('theme-toggle').addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
}
