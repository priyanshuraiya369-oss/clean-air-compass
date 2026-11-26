'use strict';

const { validateProfile, validateQuestion } = require('./validate');
const { buildPlan } = require('./engine');
const { applyAiToPlan } = require('./merge');
const { fallbackAnswer } = require('./faq');
const { categorize } = require('./aqi');
const { HttpError, readJsonBody, sendJson } = require('./http');

const MANUAL_HINT = 'Enter an AQI value manually to continue.';

/**
 * Route handlers, built around injected clients so they can be tested without a network.
 * @param {{geo:object, gemini:object, warn?:(entry:object)=>void}} deps
 */
function createHandlers({ geo, gemini, warn = () => {} }) {
  /** Work out the air-quality reading for a validated profile. */
  async function resolveAir(profile) {
    if (Number.isFinite(profile.manualAqi)) {
      return { aqi: profile.manualAqi, pm25: null, pm10: null, city: profile.city, source: 'manual' };
    }
    try {
      let { lat, lon } = profile;
      let name = profile.city;
      if (!(Number.isFinite(lat) && Number.isFinite(lon))) {
        const place = await geo.geocode(profile.city);
        if (!place) throw new HttpError(404, `Could not find "${profile.city}". Check the spelling or enter an AQI value manually.`);
        ({ lat, lon } = place);
        name = place.name;
      }
      const air = await geo.airQuality(lat, lon);
      if (!air) throw new HttpError(502, `No air-quality reading is available for that place. ${MANUAL_HINT}`);
      return { ...air, city: name || 'Your location' };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      const cause = err && err.cause ? err.cause.code || err.cause.message : '';
      warn({ level: 'warn', where: 'air-quality lookup', message: String(err && err.message), cause });
      throw new HttpError(502, `Live air-quality data is unavailable right now. ${MANUAL_HINT}`);
    }
  }

  async function handlePlan(req, res) {
    const parsed = validateProfile(await readJsonBody(req));
    if (!parsed.ok) throw new HttpError(400, 'Invalid input.', parsed.errors);
    const profile = parsed.value;
    const plan = buildPlan(profile, await resolveAir(profile));
    const ai = await gemini.generatePlan(profile, plan);
    applyAiToPlan(plan, ai, profile.language);
    sendJson(res, 200, {
      plan,
      ai: { used: Boolean(ai), model: ai ? ai.model : null, available: gemini.enabled },
    });
  }

  async function handleAsk(req, res) {
    const parsed = validateQuestion(await readJsonBody(req));
    if (!parsed.ok) throw new HttpError(400, 'Invalid input.', parsed.errors);
    const { question, context, language } = parsed.value;
    const ai = await gemini.answer(question, { ...context, language }, null);
    sendJson(res, 200, {
      answer: ai ? ai.text : fallbackAnswer(question),
      source: ai ? 'gemini' : 'rules',
      model: ai ? ai.model : null,
      category: context.aqi === null ? null : categorize(context.aqi).label,
    });
  }

  async function handleReverse(req, res) {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new HttpError(400, 'Valid "lat" and "lon" query parameters are required.');
    }
    let name = null;
    try {
      name = await geo.reverse(lat, lon);
    } catch (err) {
      warn({ level: 'warn', where: 'reverse geocode', message: String(err && err.message) });
    }
    sendJson(res, 200, { name });
  }

  function handleHealth(_req, res) {
    sendJson(res, 200, { status: 'ok', ai: gemini.enabled, models: gemini.enabled ? gemini.models : [] });
  }

  return { handlePlan, handleAsk, handleReverse, handleHealth };
}

module.exports = { createHandlers };
