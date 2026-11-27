'use strict';

const { pm25ToAqi } = require('./aqi');
const { TtlCache } = require('./cache');
const { summarizeForecast } = require('./forecast');

const OPEN_METEO_GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const WAQI = 'https://api.waqi.info/feed';
const USER_AGENT = 'CleanAirCompass/1.0 (PromptWars educational project)';
const TIMEOUT_MS = 12000;
const AIR_TTL_MS = 10 * 60 * 1000;
const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

/** Keep only characters the app accepts in place names. */
function safePlaceName(value) {
  return String(value || '')
    .replace(/[^\p{L}\p{M}0-9 .,'’()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * @param {{fetchImpl?:typeof fetch, now?:()=>number, waqiToken?:string}} [opts]
 */
function createGeoClient({ fetchImpl = globalThis.fetch, now = Date.now, waqiToken = '' } = {}) {
  const geoCache = new TtlCache(GEO_TTL_MS, MAX_CACHE_ENTRIES, now);
  const airCache = new TtlCache(AIR_TTL_MS, MAX_CACHE_ENTRIES, now);
  const reverseCache = new TtlCache(GEO_TTL_MS, MAX_CACHE_ENTRIES, now);

  async function getJson(url) {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    });
    if (!res.ok) throw new Error(`Upstream responded with ${res.status}`);
    return res.json();
  }

  async function geocodeOpenMeteo(name) {
    const url = `${OPEN_METEO_GEOCODE}?${new URLSearchParams({ name, count: '1', language: 'en', format: 'json' })}`;
    const data = await getJson(url);
    const hit = data && Array.isArray(data.results) ? data.results[0] : null;
    return hit
      ? { name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude }
      : null;
  }

  async function geocodeNominatim(name) {
    const url = `${NOMINATIM}/search?${new URLSearchParams({ q: name, format: 'jsonv2', limit: '1', 'accept-language': 'en' })}`;
    const data = await getJson(url);
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      name: safePlaceName(
        String(hit.display_name || name)
          .split(',')
          .slice(0, 3)
          .join(','),
      ),
      lat,
      lon,
    };
  }

  /** @returns {Promise<{name:string,lat:number,lon:number}|null>} */
  async function geocode(name) {
    const key = name.toLowerCase();
    const cached = geoCache.get(key);
    if (cached !== undefined) return cached;
    let firstError = null;
    for (const lookup of [geocodeOpenMeteo, geocodeNominatim]) {
      try {
        const result = await lookup(name);
        if (result) {
          geoCache.set(key, result);
          return result;
        }
      } catch (err) {
        firstError = firstError || err;
      }
    }
    if (firstError) throw firstError;
    geoCache.set(key, null);
    return null;
  }

  async function airOpenMeteo(lat, lon) {
    const url = `${OPEN_METEO_AIR}?${new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'us_aqi,pm2_5,pm10',
      hourly: 'us_aqi',
      forecast_days: '2',
      timezone: 'auto',
    })}`;
    const data = (await getJson(url)) || {};
    const cur = data.current;
    if (!cur) return null;
    const pm25 = Number.isFinite(cur.pm2_5) ? cur.pm2_5 : null;
    const pm10 = Number.isFinite(cur.pm10) ? cur.pm10 : null;
    const aqi = Number.isFinite(cur.us_aqi) ? cur.us_aqi : pm25 !== null ? pm25ToAqi(pm25) : null;
    if (aqi === null) return null;
    const forecast = data.hourly ? summarizeForecast(data.hourly.time, data.hourly.us_aqi, cur.time) : null;
    return { aqi, pm25, pm10, forecast, source: 'open-meteo' };
  }

  /** Optional fallback: nearest monitoring station from aqicn.org (needs a free token). */
  async function airWaqi(lat, lon) {
    const url = `${WAQI}/geo:${lat};${lon}/?${new URLSearchParams({ token: waqiToken })}`;
    const body = await getJson(url);
    const d = body && body.status === 'ok' ? body.data : null;
    const aqi = d ? Number(d.aqi) : NaN;
    if (!Number.isFinite(aqi)) return null;
    const num = (v) => (v && Number.isFinite(Number(v.v)) ? Number(v.v) : null);
    return {
      aqi,
      pm25: d.iaqi ? num(d.iaqi.pm25) : null,
      pm10: d.iaqi ? num(d.iaqi.pm10) : null,
      forecast: null,
      source: 'waqi',
    };
  }

  /** @returns {Promise<{aqi:number,pm25:number|null,pm10:number|null,source:string}|null>} */
  async function airQuality(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = airCache.get(key);
    if (cached !== undefined) return cached;
    const providers = [airOpenMeteo, ...(waqiToken ? [airWaqi] : [])];
    let firstError = null;
    for (const provider of providers) {
      try {
        const result = await provider(lat, lon);
        if (result) {
          airCache.set(key, result);
          return result;
        }
      } catch (err) {
        firstError = firstError || err;
      }
    }
    if (firstError) throw firstError;
    return null;
  }

  /** Turn coordinates into a human place name. @returns {Promise<string|null>} */
  async function reverse(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = reverseCache.get(key);
    if (cached !== undefined) return cached;
    const url = `${NOMINATIM}/reverse?${new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      zoom: '10',
      'accept-language': 'en',
    })}`;
    const data = await getJson(url);
    const a = (data && data.address) || {};
    const name = safePlaceName(
      [a.city || a.town || a.village || a.suburb || a.county || a.state_district, a.state].filter(Boolean).join(', '),
    );
    const result = name || null;
    reverseCache.set(key, result);
    return result;
  }

  return { geocode, airQuality, reverse };
}

module.exports = { createGeoClient };
