'use strict';

const RISK_LABELS = Object.freeze(['Low', 'Moderate', 'High', 'Very high', 'Severe']);
// Risk index (0-4) per AQI level (0-5). Sensitive groups reach higher risk at lower AQI.
const RISK_BY_LEVEL = Object.freeze({
  healthy: [0, 0, 1, 2, 3, 4],
  children: [0, 1, 2, 3, 4, 4],
  elderly: [0, 1, 2, 3, 4, 4],
  conditions: [0, 2, 3, 4, 4, 4],
});
const RISK_GROUPS = Object.freeze([
  ['healthy', 'Healthy adults'],
  ['children', 'Children'],
  ['elderly', 'Older adults'],
  ['conditions', 'Asthma, heart or lung conditions'],
]);

/** Indicative risk for each group at an AQI level. Not a medical assessment. */
function groupRisk(level) {
  const lvl = Math.min(5, Math.max(0, level));
  return RISK_GROUPS.map(([id, label]) => ({
    id,
    label,
    risk: RISK_BY_LEVEL[id][lvl],
    riskLabel: RISK_LABELS[RISK_BY_LEVEL[id][lvl]],
  }));
}

module.exports = { groupRisk };
