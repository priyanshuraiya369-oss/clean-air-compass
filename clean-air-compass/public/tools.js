'use strict';

/**
 * Pure helpers shared by the page and the unit tests (no DOM access here).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CleanAirTools = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const BANDS = [50, 100, 150, 200, 300, 500];
  const FLOOR = [0, 51, 101, 151, 201, 301];

  /** Equal-width gauge position (0-180 degrees) so every AQI band gets the same arc. */
  function gaugeAngle(aqi) {
    const v = Math.min(500, Math.max(0, Number(aqi) || 0));
    let level = BANDS.findIndex((max) => v <= max);
    if (level < 0) level = 5;
    const lo = level === 0 ? 0 : FLOOR[level] - 1;
    const hi = BANDS[level];
    const fraction = (v - lo) / (hi - lo);
    return Math.min(180, (level + fraction) * 30);
  }

  /** AQI level 0-5 for colouring. */
  function levelOf(aqi) {
    const level = BANDS.findIndex((max) => aqi <= max);
    return level < 0 ? 5 : level;
  }

  /**
   * Recommended purifier size. Uses 4.8 air changes per hour of the room volume,
   * which matches the common "CADR = two thirds of floor area (sq ft, 8 ft ceiling)" rule.
   * @returns {{areaM2:number,volumeM3:number,cadrM3h:number,cadrCfm:number}|null}
   */
  function purifierSizing({ lengthM, widthM, heightM = 2.7, ach = 4.8 }) {
    const [l, w, h] = [lengthM, widthM, heightM].map(Number);
    if (![l, w, h, ach].every((n) => Number.isFinite(n) && n > 0)) return null;
    if (l > 30 || w > 30 || h > 6) return null;
    const volume = l * w * h;
    const m3h = volume * ach;
    return {
      areaM2: Math.round(l * w * 10) / 10,
      volumeM3: Math.round(volume * 10) / 10,
      cadrM3h: Math.round(m3h),
      cadrCfm: Math.round(m3h / 1.699),
    };
  }

  /** Progress percentage, safe for zero totals. */
  function percent(done, total) {
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  return { gaugeAngle, levelOf, purifierSizing, percent };
});
