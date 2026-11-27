'use strict';

// Usage: npm run diagnose   (reads .env automatically)
// Checks every outside service the app uses and prints the real reason when one fails.
const path = require('node:path');
require('node:dns').setDefaultResultOrder('ipv4first');
require('../src/env').loadEnvFile(path.join(__dirname, '..', '.env'));
const { viaPublicDns } = require('../src/net');
const { DEFAULT_MODELS } = require('../src/gemini');

const checks = [
  ['Open-Meteo geocoding', 'https://geocoding-api.open-meteo.com/v1/search?name=Jaipur&count=1', {}],
  [
    'Open-Meteo air quality',
    'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=26.91&longitude=75.79&current=us_aqi,pm2_5',
    {},
  ],
  [
    'OpenStreetMap Nominatim',
    'https://nominatim.openstreetmap.org/search?q=Jaipur&format=jsonv2&limit=1',
    { 'user-agent': 'CleanAirCompass/1.0 (diagnose)' },
  ],
];
if (process.env.WAQI_TOKEN) {
  checks.push([
    'WAQI (aqicn.org)',
    `https://api.waqi.info/feed/geo:26.91;75.79/?token=${encodeURIComponent(process.env.WAQI_TOKEN)}`,
    {},
  ]);
}
if (process.env.GEMINI_API_KEY) {
  const models = [process.env.GEMINI_MODEL, ...String(process.env.GEMINI_FALLBACK_MODELS || '').split(',')]
    .map((m) => String(m || '').trim())
    .filter(Boolean);
  for (const m of models.length ? models : DEFAULT_MODELS) {
    checks.push([
      `Gemini model ${m}`,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}`,
      { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    ]);
  }
}

const describe = (err) => `${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ''}`;

(async () => {
  console.log(`Node ${process.version}`);
  let failures = 0;
  for (const [name, url, headers] of checks) {
    const started = Date.now();
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) failures += 1;
      console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${name}: HTTP ${res.status} in ${Date.now() - started} ms`);
    } catch (err) {
      const direct = describe(err);
      try {
        const res = await viaPublicDns(url, { headers, signal: AbortSignal.timeout(10000) });
        console.log(
          `WARN ${name}: your system DNS failed (${direct}) but public DNS works (HTTP ${res.status}). The app auto-falls back, but fixing your DNS is better: set it to 8.8.8.8 and 1.1.1.1.`,
        );
        if (!res.ok) failures += 1;
      } catch (err2) {
        failures += 1;
        console.log(`FAIL ${name}: ${direct}; public-DNS retry also failed (${describe(err2)})`);
      }
    }
  }
  console.log(
    process.env.GEMINI_API_KEY
      ? 'GEMINI_API_KEY: found'
      : 'GEMINI_API_KEY: NOT set (add it to .env for AI-powered plans)',
  );
  console.log(process.env.WAQI_TOKEN ? 'WAQI_TOKEN: found' : 'WAQI_TOKEN: not set (optional fallback)');
  process.exitCode = failures ? 1 : 0;
})();
