'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

/** Fake upstreams so tests never touch the network. */
function fakeFetch({ aqi = 185, fail = false } = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    if (fail) throw new Error('network down');
    const u = String(url);
    if (u.includes('geocoding-api')) {
      return { ok: true, json: async () => (u.includes('Nowhereville')
        ? { results: [] }
        : { results: [{ name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2 }] }) };
    }
    if (u.includes('nominatim') && u.includes('/reverse')) {
      return { ok: true, json: async () => ({ address: { city: 'Jaipur', state: 'Rajasthan' } }) };
    }
    if (u.includes('nominatim') && u.includes('/search')) {
      if (u.includes('Nowhereville')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [{ lat: '26.91', lon: '75.79', display_name: 'Jaipur, Rajasthan, India' }] };
    }
    if (u.includes('api.waqi.info')) {
      return { ok: true, json: async () => ({ status: 'ok', data: { aqi: 240, iaqi: { pm25: { v: 190 } } } }) };
    }
    if (u.includes('air-quality-api')) {
      return { ok: true, json: async () => ({ current: { us_aqi: aqi, pm2_5: 95.2, pm10: 160 } }) };
    }
    return { ok: false, status: 404 };
  };
  impl.calls = calls;
  return impl;
}

async function withServer(opts, fn) {
  const server = createApp({ quiet: true, env: {}, ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const post = (base, path, body, headers = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('serves the app with strict security headers', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    const html = await res.text();
    assert.match(html, /<html lang="en"/);
    assert.ok(!/<script>[^<]/.test(html), 'no inline scripts allowed by CSP');
  });
});

test('static assets are gzip-compressed and cacheable with ETag', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    const res = await fetch(base + '/js/app.mjs', { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(res.status, 200);
    const etag = res.headers.get('etag');
    assert.ok(etag);
    const again = await fetch(base + '/js/app.mjs', { headers: { 'if-none-match': etag } });
    assert.equal(again.status, 304);
  });
});

test('path traversal and unknown paths return 404', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    for (const p of ['/../server.js', '/%2e%2e/package.json', '/nope', '/src/engine.js']) {
      const res = await fetch(base + p);
      assert.equal(res.status, 404, p);
    }
  });
});

test('health endpoint', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    const res = await fetch(base + '/api/health');
    assert.deepEqual(await res.json(), { status: 'ok', ai: false, models: [] });
  });
});

test('POST /api/plan returns a full plan from live (mocked) data', async () => {
  const f = fakeFetch({ aqi: 185 });
  await withServer({ fetchImpl: f }, async (base) => {
    const res = await post(base, '/api/plan', { city: 'Delhi', children: true, commute: 'car' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.plan.air.aqi, 185);
    assert.equal(body.plan.air.label, 'Unhealthy');
    assert.equal(body.plan.air.source, 'open-meteo');
    assert.equal(body.ai.used, false);
    assert.equal(body.plan.sections.length, 3);
    assert.ok(f.calls.some((u) => u.includes('geocoding-api')));
  });
});

test('air quality lookups are cached', async () => {
  const f = fakeFetch();
  await withServer({ fetchImpl: f }, async (base) => {
    await post(base, '/api/plan', { city: 'Delhi' });
    await post(base, '/api/plan', { city: 'Delhi' });
    assert.equal(f.calls.filter((u) => u.includes('air-quality-api')).length, 1);
    assert.equal(f.calls.filter((u) => u.includes('geocoding-api')).length, 1);
  });
});

test('manual AQI works with no network at all', async () => {
  await withServer({ fetchImpl: fakeFetch({ fail: true }) }, async (base) => {
    const res = await post(base, '/api/plan', { manualAqi: 320 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.plan.air.label, 'Hazardous');
    assert.equal(body.plan.air.source, 'manual');
  });
});

test('upstream failure gives a helpful 502, unknown city a 404', async () => {
  await withServer({ fetchImpl: fakeFetch({ fail: true }) }, async (base) => {
    const res = await post(base, '/api/plan', { city: 'Delhi' });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /manually/i);
  });
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    const res = await post(base, '/api/plan', { city: 'Nowhereville' });
    assert.equal(res.status, 404);
  });
});

test('validation, content-type and size limits are enforced', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    assert.equal((await post(base, '/api/plan', { city: 'Delhi', commute: 'rocket' })).status, 400);
    assert.equal((await post(base, '/api/plan', '{not json')).status, 400);
    assert.equal((await post(base, '/api/plan', '{}', { 'content-type': 'text/plain' })).status, 415);
    const big = await post(base, '/api/plan', { city: 'Delhi', notes: 'x'.repeat(40000) }).catch((e) => ({ status: 0, e }));
    assert.ok([413, 0].includes(big.status));
    assert.equal((await fetch(base + '/api/plan')).status, 405);
    assert.equal((await fetch(base + '/api/unknown')).status, 404);
  });
});

test('POST /api/ask answers offline using the rules fallback', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    const res = await post(base, '/api/ask', { question: 'Should my child wear a mask?', context: { aqi: 200, city: 'Delhi' } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'rules');
    assert.ok(body.answer.length > 20);
    assert.equal((await post(base, '/api/ask', { question: 'a' })).status, 400);
  });
});

const aiPlanBody = JSON.stringify({
  headline: 'AI headline',
  summary: 'AI summary',
  localInsights: ['Local note'],
  sections: ['routine', 'indoor', 'sustainable'].map((id) => ({
    id,
    items: [1, 2, 3].map((n) => ({ title: `T${n}`, action: `A${n}`, why: `W${n}`, impact: `I${n}`, when: 'today', cost: 'free', exposure: 'high' })),
  })),
});

test('Gemini authors the plan when a key is configured, with safety items still guaranteed', async () => {
  const f = fakeFetch({ aqi: 220 });
  const wrapped = async (url, init) => {
    if (String(url).includes('generativelanguage')) {
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: aiPlanBody }] } }] }) };
    }
    return f(url, init);
  };
  await withServer({ fetchImpl: wrapped, env: { GEMINI_API_KEY: 'test-key' } }, async (base) => {
    const body = await (await post(base, '/api/plan', { city: 'Delhi' })).json();
    assert.equal(body.ai.used, true);
    assert.equal(body.ai.model, 'gemini-3.5-flash');
    assert.equal(body.plan.generatedBy, 'gemini');
    assert.equal(body.plan.headline, 'AI headline');
    assert.equal(body.plan.sections[0].items[0].by, 'gemini');
    assert.deepEqual(body.plan.localInsights, ['Local note']);
    assert.ok(body.plan.safety.some((i) => i.id === 'wear-n95'), 'rules-based safety block is kept');
  });
});

test('if Gemini fails the rules plan is returned instead of an error', async () => {
  const f = fakeFetch();
  const wrapped = async (url, init) => {
    if (String(url).includes('generativelanguage')) return { ok: false, status: 503 };
    return f(url, init);
  };
  await withServer({ fetchImpl: wrapped, env: { GEMINI_API_KEY: 'test-key' } }, async (base) => {
    const res = await post(base, '/api/plan', { city: 'Delhi' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ai.used, false);
    assert.equal(body.ai.available, true);
    assert.equal(body.plan.generatedBy, 'rules');
  });
});

test('GEMINI_MODEL and GEMINI_FALLBACK_MODELS configure the model chain', async () => {
  await withServer({ fetchImpl: fakeFetch(), env: { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.6-flash', GEMINI_FALLBACK_MODELS: 'gemini-2.5-flash, bad model!' } }, async (base) => {
    const body = await (await fetch(base + '/api/health')).json();
    assert.deepEqual(body.models, ['gemini-3.6-flash', 'gemini-2.5-flash']);
  });
});

test('rate limiting returns 429 with Retry-After', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    let last;
    for (let i = 0; i < 31; i++) last = await fetch(base + '/api/health');
    assert.equal(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
  });
});

test('GET /api/reverse turns coordinates into a place name', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    const res = await fetch(base + '/api/reverse?lat=26.9124&lon=75.7873');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { name: 'Jaipur, Rajasthan' });
    assert.equal((await fetch(base + '/api/reverse?lat=abc&lon=1')).status, 400);
    assert.equal((await fetch(base + '/api/reverse?lat=999&lon=1')).status, 400);
  });
});

test('reverse lookup failure still returns 200 with a null name', async () => {
  await withServer({ fetchImpl: fakeFetch({ fail: true }) }, async (base) => {
    const res = await fetch(base + '/api/reverse?lat=26.9&lon=75.8');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { name: null });
  });
});

test('plan works with coordinates and keeps the supplied place name', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    const body = await (await post(base, '/api/plan', { city: 'Jaipur, Rajasthan', lat: 26.9124, lon: 75.7873 })).json();
    assert.equal(body.plan.air.city, 'Jaipur, Rajasthan');
    assert.equal(body.plan.air.aqi, 185);
  });
});

test('geocoding falls back to OpenStreetMap when Open-Meteo geocoding is down', async () => {
  const f = fakeFetch();
  const wrapped = async (url, init) => {
    if (String(url).includes('geocoding-api')) throw new Error('blocked');
    return f(url, init);
  };
  await withServer({ fetchImpl: wrapped }, async (base) => {
    const res = await post(base, '/api/plan', { city: 'Jaipur' });
    assert.equal(res.status, 200);
    assert.match((await res.json()).plan.air.city, /Jaipur/);
  });
});

test('air data falls back to WAQI when Open-Meteo is down and a token is set', async () => {
  const f = fakeFetch();
  const wrapped = async (url, init) => {
    if (String(url).includes('air-quality-api')) throw new Error('blocked');
    return f(url, init);
  };
  await withServer({ fetchImpl: wrapped, env: { WAQI_TOKEN: 'tok' } }, async (base) => {
    const body = await (await post(base, '/api/plan', { city: 'Delhi' })).json();
    assert.equal(body.plan.air.aqi, 240);
    assert.equal(body.plan.air.source, 'waqi');
    assert.equal(body.plan.air.pm25, 190);
  });
  await withServer({ fetchImpl: wrapped }, async (base) => {
    assert.equal((await post(base, '/api/plan', { city: 'Delhi' })).status, 502);
  });
});

test('translated safety items keep structure and expose the English original', async () => {
  const f = fakeFetch({ aqi: 220 });
  const wrapped = async (url, init) => {
    if (String(url).includes('generativelanguage')) {
      const prompt = JSON.parse(init.body).contents[0].parts[0].text;
      const ids = [...prompt.matchAll(/"id":"([a-z0-9-]+)","title"/g)].map((m) => m[1]);
      const body = JSON.parse(aiPlanBody);
      body.safetyTranslations = ids.map((id) => ({ id, title: 'HI title', action: 'HI action', why: 'HI why', impact: 'HI impact' }));
      body.disclaimer = 'HI disclaimer';
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) };
    }
    return f(url, init);
  };
  await withServer({ fetchImpl: wrapped, env: { GEMINI_API_KEY: 'k' } }, async (base) => {
    const body = await (await post(base, '/api/plan', { city: 'Delhi', language: 'hi' })).json();
    assert.equal(body.plan.language, 'hi');
    assert.equal(body.plan.disclaimer, 'HI disclaimer');
    const wear = body.plan.safety.find((i) => i.id === 'wear-n95');
    assert.equal(wear.title, 'HI title');
    assert.match(wear.en.title, /N95/);
    assert.equal(wear.safety, true);
    assert.ok(body.plan.safety.length >= 3);
  });
});

test('hourly forecast reaches the plan when Open-Meteo returns it', async () => {
  const times = [];
  const vals = [];
  const start = Date.UTC(2026, 10, 24, 0);
  for (let h = 0; h < 48; h++) {
    times.push(new Date(start + h * 3600e3).toISOString().slice(0, 16));
    vals.push(150 + (h % 24));
  }
  const wrapped = async (url) => {
    const u = String(url);
    if (u.includes('geocoding-api')) return { ok: true, json: async () => ({ results: [{ name: 'Delhi', latitude: 28.6, longitude: 77.2 }] }) };
    if (u.includes('air-quality-api')) {
      return { ok: true, json: async () => ({ current: { time: '2026-11-24T08:00', us_aqi: 170, pm2_5: 80, pm10: 120 }, hourly: { time: times, us_aqi: vals } }) };
    }
    return { ok: false, status: 404 };
  };
  await withServer({ fetchImpl: wrapped }, async (base) => {
    const body = await (await post(base, '/api/plan', { city: 'Delhi' })).json();
    const f = body.plan.air.forecast;
    assert.equal(f.hours.length, 24);
    assert.ok(f.best && f.worst);
    assert.equal(f.hours[0].t, '2026-11-24T08:00');
  });
});

test('all front-end assets are served with correct types', async () => {
  await withServer({ fetchImpl: fakeFetch() }, async (base) => {
    for (const [file, type] of [['/tools.js', /javascript/], ['/theme.js', /javascript/], ['/styles.css', /css/], ['/js/app.mjs?v=5', /javascript/], ['/js/dom.mjs', /javascript/]]) {
      const res = await fetch(base + file);
      assert.equal(res.status, 200, file);
      assert.match(res.headers.get('content-type'), type);
    }
  });
});
