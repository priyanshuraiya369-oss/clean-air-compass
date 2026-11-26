'use strict';

/**
 * Shared JSDoc types (documentation only; no runtime code).
 *
 * @typedef {'today'|'this-week'|'long-term'} When
 * @typedef {'free'|'low'|'medium'|'high'} Cost
 * @typedef {'high'|'medium'|'low'} Exposure
 *
 * @typedef {object} Impact
 * @property {string} text Plain-language effect of the action.
 * @property {number|null} co2KgPerMonth Calculated (never AI-supplied) CO2e saving.
 * @property {Exposure|null} exposure How much the action cuts personal smog exposure.
 *
 * @typedef {object} PlanItem
 * @property {string} id
 * @property {string} title
 * @property {string} action
 * @property {string} why
 * @property {Impact} impact
 * @property {When} when
 * @property {Cost} cost
 * @property {boolean} [safety] True for items in the guaranteed safety block.
 * @property {'gemini'} [by] Present when the item was written by the model.
 *
 * @typedef {object} Profile Validated user input (see validate.js).
 * @typedef {object} Air Air-quality reading: aqi, pm25, pm10, forecast, city, source.
 */

module.exports = {};
