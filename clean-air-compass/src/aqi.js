'use strict';

/**
 * AQI helpers based on the US EPA scale (the scale Open-Meteo reports as `us_aqi`).
 * PM2.5 breakpoints follow the 2024 EPA revision (µg/m³).
 */

const CATEGORIES = Object.freeze([
  { level: 0, max: 50, id: 'good', label: 'Good' },
  { level: 1, max: 100, id: 'moderate', label: 'Moderate' },
  { level: 2, max: 150, id: 'usg', label: 'Unhealthy for sensitive groups' },
  { level: 3, max: 200, id: 'unhealthy', label: 'Unhealthy' },
  { level: 4, max: 300, id: 'very-unhealthy', label: 'Very unhealthy' },
  { level: 5, max: Infinity, id: 'hazardous', label: 'Hazardous' },
]);

// [pmLow, pmHigh, aqiLow, aqiHigh]
const PM25_BREAKPOINTS = Object.freeze([
  [0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
]);

/** @param {number} aqi @returns {{level:number,id:string,label:string}} */
function categorize(aqi) {
  const value = Number.isFinite(aqi) ? Math.max(0, aqi) : 0;
  const found = CATEGORIES.find((c) => value <= c.max) || CATEGORIES[CATEGORIES.length - 1];
  return { level: found.level, id: found.id, label: found.label };
}

/** Convert a PM2.5 concentration (µg/m³) to a US AQI value. Returns null for invalid input. */
function pm25ToAqi(pm25) {
  if (!Number.isFinite(pm25) || pm25 < 0) return null;
  const truncated = Math.floor(pm25 * 10) / 10;
  if (truncated > 325.4) return 500;
  const bp =
    PM25_BREAKPOINTS.find(([lo, hi]) => truncated >= lo && truncated <= hi) ||
    PM25_BREAKPOINTS.find(([, hi]) => truncated <= hi);
  const [pmLo, pmHi, aqiLo, aqiHi] = bp;
  return Math.round(((aqiHi - aqiLo) / (pmHi - pmLo)) * (truncated - pmLo) + aqiLo);
}

module.exports = { categorize, pm25ToAqi };
