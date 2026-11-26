'use strict';

/** Items that are always shown in the guaranteed "Safety essentials" block. */
const SAFETY_IDS = new Set([
  'wear-n95',
  'stay-indoors-severe',
  'medical-signs',
  'children-indoor-play',
  'elderly-routine',
  'clean-room',
  'cooking-biomass',
  'heating-biomass',
  'heating-gas',
]);

module.exports = { SAFETY_IDS };
