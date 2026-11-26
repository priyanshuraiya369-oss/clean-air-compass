'use strict';

/**
 * Transparent, approximate impact model. All numbers are rough, rounded planning
 * estimates (not measurements) and are labelled as such in the UI.
 */

// kg CO2e per passenger-km (typical urban averages).
const EMISSION_KG_PER_KM = Object.freeze({
  car: 0.18,
  two_wheeler: 0.07,
  public: 0.04,
  walk: 0,
  cycle: 0,
  work_from_home: 0,
});

const WORKING_DAYS_PER_MONTH = 26;
// Approximate grid intensity (kg CO2e per kWh). Varies by region and year.
const GRID_KG_PER_KWH = 0.7;
const HEATER_KW = 1.5;

const round1 = (n) => Math.round(n * 10) / 10;

/** Monthly CO2e for a daily round trip of `km` each way using `mode`. */
function commuteMonthlyKg(mode, km) {
  const factor = EMISSION_KG_PER_KM[mode] ?? 0;
  return round1(factor * km * 2 * WORKING_DAYS_PER_MONTH);
}

/** Monthly CO2e saved by switching the commute from one mode to another. */
function commuteSavingKg(fromMode, toMode, km) {
  return Math.max(0, round1(commuteMonthlyKg(fromMode, km) - commuteMonthlyKg(toMode, km)));
}

/** Monthly CO2e saved by running an electric heater `hoursLess` fewer hours per day. */
function heaterSavingKg(hoursLess) {
  return round1(HEATER_KW * hoursLess * 30 * GRID_KG_PER_KWH);
}

module.exports = { commuteMonthlyKg, commuteSavingKg, heaterSavingKg };
