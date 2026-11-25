'use strict';
// Runs before first paint (loaded synchronously in <head>) so the page never flashes the wrong theme.
(function () {
  let theme = null;
  try {
    theme = localStorage.getItem('cac:theme');
  } catch (_) {
    /* storage unavailable */
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.add('js');
})();
