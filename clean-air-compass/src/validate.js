'use strict';

/** Strict allow-list validation. Anything unknown is rejected or defaulted, never trusted. */

const ENUMS = Object.freeze({
  commute: ['walk', 'cycle', 'public', 'two_wheeler', 'car', 'work_from_home'],
  cooking: ['lpg', 'induction', 'electric', 'biomass', 'png'],
  heating: ['none', 'electric_heater', 'gas', 'biomass'],
  homeType: ['apartment', 'house'],
  budget: ['low', 'medium', 'high'],
});

const LANGUAGES = Object.freeze({
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu',
  pa: 'Punjabi',
  ur: 'Urdu',
});

const DEFAULTS = Object.freeze({
  commute: 'public',
  cooking: 'lpg',
  heating: 'none',
  homeType: 'apartment',
  budget: 'low',
  commuteKm: 10,
});

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function toBool(value) {
  return value === true || value === 'true' || value === 'on' || value === 1;
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return NaN;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * @param {unknown} body Raw parsed JSON.
 * @returns {{ok:true,value:object}|{ok:false,errors:string[]}}
 */
function validateProfile(body) {
  const errors = [];
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  const value = {
    city: cleanText(body.city, 80),
    lat: toNumber(body.lat),
    lon: toNumber(body.lon),
    manualAqi: toNumber(body.manualAqi),
    household: {
      children: toBool(body.children),
      elderly: toBool(body.elderly),
      sensitive: toBool(body.sensitive),
    },
    hasPurifier: toBool(body.hasPurifier),
    notes: cleanText(body.notes, 200),
  };

  for (const [key, allowed] of Object.entries(ENUMS)) {
    const raw = body[key];
    if (raw === undefined || raw === null || raw === '') {
      value[key] = DEFAULTS[key];
    } else if (typeof raw === 'string' && allowed.includes(raw)) {
      value[key] = raw;
    } else {
      errors.push(`"${key}" must be one of: ${allowed.join(', ')}.`);
    }
  }

  if (body.language === undefined || body.language === null || body.language === '') value.language = 'en';
  else if (typeof body.language === 'string' && Object.hasOwn(LANGUAGES, body.language)) value.language = body.language;
  else errors.push(`"language" must be one of: ${Object.keys(LANGUAGES).join(', ')}.`);

  const km = toNumber(body.commuteKm);
  if (Number.isNaN(km)) value.commuteKm = DEFAULTS.commuteKm;
  else if (km < 0 || km > 200) errors.push('"commuteKm" must be between 0 and 200.');
  else value.commuteKm = Math.round(km * 10) / 10;

  const hasCoords = Number.isFinite(value.lat) && Number.isFinite(value.lon);
  if (hasCoords && (Math.abs(value.lat) > 90 || Math.abs(value.lon) > 180)) {
    errors.push('Coordinates are out of range.');
  }
  if (!Number.isNaN(value.manualAqi) && (value.manualAqi < 0 || value.manualAqi > 500)) {
    errors.push('"manualAqi" must be between 0 and 500.');
  }
  if (!hasCoords && !value.city && Number.isNaN(value.manualAqi)) {
    errors.push('Provide a city, use your location, or enter an AQI value.');
  }
  if (value.city && !/^[\p{L}\p{M}0-9 .,'’()-]+$/u.test(value.city)) {
    errors.push('City contains unsupported characters.');
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function validateQuestion(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const question = cleanText(body.question, 300);
  if (question.length < 3) return { ok: false, errors: ['Please enter a question (3+ characters).'] };
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  const aqi = toNumber(ctx.aqi);
  const language = typeof body.language === 'string' && Object.hasOwn(LANGUAGES, body.language) ? body.language : 'en';
  return {
    ok: true,
    value: {
      question,
      language,
      context: {
        city: cleanText(ctx.city, 80),
        aqi: Number.isFinite(aqi) ? Math.min(500, Math.max(0, Math.round(aqi))) : null,
      },
    },
  };
}

module.exports = { validateProfile, validateQuestion, cleanText, LANGUAGES };
