'use strict';

/**
 * Frontend for Clean Air Compass.
 * Security: all server data is rendered with textContent and createElement, never as HTML strings.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const Tools = window.CleanAirTools;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WHEN_LABEL = { today: 'Do today', 'this-week': 'This week', 'long-term': 'Long term' };
  const COST_LABEL = { free: 'Free', low: 'Low cost', medium: 'Medium cost', high: 'Higher cost' };
  const EXPOSURE_LABEL = { high: 'Big cut in exposure', medium: 'Moderate cut in exposure', low: 'Small cut in exposure' };
  const SOURCE_LABEL = {
    manual: 'Source: value you entered',
    'open-meteo': 'Source: Open-Meteo live data',
    waqi: 'Source: aqicn.org nearest monitoring station',
  };
  const LEVEL_NAMES = ['Good', 'Moderate', 'Unhealthy for sensitive groups', 'Unhealthy', 'Very unhealthy', 'Hazardous'];
  const LEVEL_RANGES = ['0 to 50', '51 to 100', '101 to 150', '151 to 200', '201 to 300', '301 and above'];
  const RING_CIRCUMFERENCE = 213.63;
  const STORE_KEY = 'cac:done:v1';

  const state = { plan: null, ai: null, doneKey: '', done: new Set(), uid: 0 };

  /* ---------- tiny DOM helpers ---------- */
  function build(ns, tag, attrs, children) {
    const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.setAttribute('class', value);
      else if (key === 'text') el.textContent = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }
  const h = (tag, attrs, ...children) => build(null, tag, attrs, children);
  const s = (tag, attrs, ...children) => build(SVG_NS, tag, attrs, children);

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function setStatus(message) {
    $('form-status').textContent = message || '';
  }
  function showErrors(list) {
    const box = $('form-errors');
    clear(box);
    for (const message of list || []) box.append(h('li', { text: message }));
    box.hidden = !(list && list.length);
  }
  function store(fn) {
    try {
      return fn(window.localStorage);
    } catch (_) {
      return undefined;
    }
  }

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    store((ls) => ls.setItem('cac:theme', theme));
  }
  function initTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    $('theme-toggle').setAttribute('aria-label', current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    $('theme-toggle').addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------- scroll reveal ---------- */
  let revealObserver = null;
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    els.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- form ---------- */
  function readProfile() {
    const form = $('plan-form');
    const data = new FormData(form);
    const val = (name) => String(data.get(name) || '').trim();
    const num = (name) => (val(name) === '' ? undefined : Number(val(name)));
    return {
      city: val('city'),
      manualAqi: num('manualAqi'),
      lat: form.dataset.lat ? Number(form.dataset.lat) : undefined,
      lon: form.dataset.lon ? Number(form.dataset.lon) : undefined,
      children: data.has('children'),
      elderly: data.has('elderly'),
      sensitive: data.has('sensitive'),
      hasPurifier: data.has('hasPurifier'),
      commute: val('commute'),
      commuteKm: num('commuteKm'),
      cooking: val('cooking'),
      heating: val('heating'),
      homeType: val('homeType'),
      budget: val('budget'),
      language: val('language') || 'en',
      notes: val('notes'),
    };
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let payload = {};
    try {
      payload = await res.json();
    } catch (_) {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const err = new Error(payload.error || 'Request failed.');
      err.details = Array.isArray(payload.details) ? payload.details : [];
      throw err;
    }
    return payload;
  }

  /* ---------- loader ---------- */
  const loader = { timers: [] };
  function setLoaderStep(index) {
    document.querySelectorAll('#loader .loader-steps li').forEach((li, i) => {
      li.classList.toggle('done', i < index);
      li.classList.toggle('active', i === index);
    });
    const messages = ['Reading live air quality\u2026', 'Gemini is tailoring your plan. This can take up to 30 seconds\u2026', 'Running safety checks\u2026'];
    setStatus(messages[index]);
  }
  function startLoader() {
    $('loader').hidden = false;
    setLoaderStep(0);
    loader.timers = [setTimeout(() => setLoaderStep(1), 2200), setTimeout(() => setLoaderStep(2), 14000)];
  }
  function stopLoader() {
    loader.timers.forEach(clearTimeout);
    loader.timers = [];
    $('loader').hidden = true;
  }

  /* ---------- gauge ---------- */
  function arcPath(cx, cy, r, a0, a1) {
    const pt = (a) => {
      const rad = (a * Math.PI) / 180;
      return [cx - r * Math.cos(rad), cy - r * Math.sin(rad)];
    };
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function countUp(el, to) {
    if (reduceMotion) {
      el.textContent = String(to);
      return;
    }
    const start = performance.now();
    const duration = 1400;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderGauge(air) {
    const card = $('air-card');
    clear(card);
    card.dataset.level = String(air.level);
    const segments = [0, 1, 2, 3, 4, 5].map((l) => s('path', { class: `seg seg-${l}`, d: arcPath(110, 110, 90, l * 30 + 1.5, (l + 1) * 30 - 1.5) }));
    const needle = s('line', { class: 'needle', x1: 110, y1: 110, x2: 110, y2: 34 });
    const svg = s(
      'svg',
      { class: 'gauge', viewBox: '0 0 220 124', role: 'img', 'aria-label': `AQI gauge: ${air.aqi}, ${air.label}` },
      segments,
      needle,
      s('circle', { class: 'hub', cx: 110, cy: 110, r: 8 }),
    );
    const number = h('div', { class: 'air-number', 'aria-hidden': 'true', text: reduceMotion ? String(air.aqi) : '0' });
    card.append(
      svg,
      number,
      h('div', {}, h('span', { class: 'air-badge', text: `AQI ${air.aqi}: ${air.label}` })),
      h(
        'div',
        { class: 'air-meta' },
        h('p', { class: 'place', text: air.city }),
        air.pm25 !== null ? h('p', { text: `PM2.5 ${air.pm25} \u00b5g/m\u00b3` }) : null,
        h('p', { text: SOURCE_LABEL[air.source] || 'Source: live data' }),
      ),
    );
    const rotation = Tools.gaugeAngle(air.aqi) - 90;
    setTimeout(() => {
      needle.style.transform = `rotate(${rotation}deg)`;
      countUp(number, air.aqi);
    }, 120);
  }

  function renderGroupRisk(groups) {
    const list = $('group-risk');
    clear(list);
    const fills = [];
    for (const g of groups) {
      const fill = h('div', { class: `meter-fill r${g.risk}` });
      fill.style.setProperty('--w', `${((g.risk + 1) / 5) * 100}%`);
      fills.push(fill);
      list.append(
        h(
          'li',
          { class: 'risk-row' },
          h('div', { class: 'risk-head' }, h('span', { text: g.label }), h('span', { class: 'risk-level', text: g.riskLabel })),
          h('div', { class: 'meter', role: 'img', 'aria-label': `${g.label}: ${g.riskLabel} risk` }, fill),
        ),
      );
    }
    setTimeout(() => fills.forEach((f) => f.classList.add('go')), 150);
  }

  /* ---------- hourly chart ---------- */
  function renderChart(air) {
    const card = $('chart-card');
    const f = air.forecast;
    if (!f || !Array.isArray(f.hours) || f.hours.length < 6) {
      card.hidden = true;
      return;
    }
    const hours = f.hours;
    const W = 720, H = 230, L = 36, R = 8, T = 22, B = 28;
    const top = Math.ceil(Math.max(150, ...hours.map((x) => x.aqi)) / 50) * 50;
    const plotH = H - T - B;
    const y = (v) => T + plotH * (1 - v / top);
    const bw = (W - L - R) / hours.length;

    const summary = f.best
      ? `Cleanest time ${f.best.day}: ${f.best.from} to ${f.best.to}, AQI around ${f.best.aqi}. Worst: ${f.worst.day} ${f.worst.from} to ${f.worst.to}, AQI around ${f.worst.aqi}.`
      : `Worst time ${f.worst.day}: ${f.worst.from} to ${f.worst.to}, AQI around ${f.worst.aqi}.`;
    $('forecast').textContent = f.best
      ? `Best time outside ${f.best.day}: ${f.best.from} to ${f.best.to} (AQI around ${f.best.aqi}). Worst: ${f.worst.day} ${f.worst.from} to ${f.worst.to} (AQI around ${f.worst.aqi}).`
      : summary;

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': 'chart-title chart-desc' });
    svg.append(s('desc', { id: 'chart-desc', text: `Bar chart of hourly US AQI for the next 24 hours. ${summary}` }));

    for (let v = 0; v <= top; v += 50) {
      svg.append(
        s('line', { class: 'grid-line', x1: L, x2: W - R, y1: y(v), y2: y(v) }),
        s('text', { class: 'axis', x: L - 6, y: y(v) + 4, 'text-anchor': 'end', text: String(v) }),
      );
    }

    if (f.best) {
      const firstDay = hours[0].t.slice(0, 10);
      const idx = hours.findIndex(
        (x) => x.t.slice(11, 16) === f.best.from && (f.best.day === 'today' ? x.t.slice(0, 10) === firstDay : x.t.slice(0, 10) !== firstDay),
      );
      if (idx >= 0) {
        const x = L + idx * bw;
        svg.append(
          s('rect', { class: 'best-band', x, y: T - 4, width: bw * 2, height: plotH + 4, rx: 6 }),
          s('text', { class: 'best-label', x: x + bw, y: T - 8, 'text-anchor': 'middle', text: 'Best' }),
        );
      }
    }

    hours.forEach((hr, i) => {
      const bar = s(
        'rect',
        { class: `bar lvl-${Tools.levelOf(hr.aqi)}`, x: L + i * bw + 2, y: y(hr.aqi), width: bw - 4, height: Math.max(2, y(0) - y(hr.aqi)), rx: 3 },
        s('title', { text: `${hr.t.slice(11, 16)}: AQI ${hr.aqi}` }),
      );
      bar.style.setProperty('--i', String(i));
      svg.append(bar);
      if (i % 3 === 0) {
        svg.append(s('text', { class: 'axis', x: L + i * bw + bw / 2, y: H - 8, 'text-anchor': 'middle', text: hr.t.slice(11, 13) }));
      }
    });

    const chart = $('chart');
    clear(chart);
    chart.append(svg);

    const table = h(
      'table',
      {},
      h('caption', { class: 'help', text: 'Hourly US AQI for the next 24 hours (local time)' }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Hour' }), h('th', { scope: 'col', text: 'AQI' }), h('th', { scope: 'col', text: 'Category' }))),
      h(
        'tbody',
        {},
        hours.map((hr) => h('tr', {}, h('td', { text: hr.t.slice(11, 16) }), h('td', { text: String(hr.aqi) }), h('td', { text: LEVEL_NAMES[Tools.levelOf(hr.aqi)] }))),
      ),
    );
    clear($('chart-table'));
    $('chart-table').append(table);
    card.hidden = false;
  }

  /* ---------- checklist + progress ---------- */
  function loadDone(key) {
    const saved = store((ls) => JSON.parse(ls.getItem(STORE_KEY) || '{}'));
    const titles = saved && Array.isArray(saved[key]) ? saved[key] : [];
    return new Set(titles.filter((t) => typeof t === 'string').slice(0, 100));
  }
  function saveDone() {
    store((ls) => {
      const saved = JSON.parse(ls.getItem(STORE_KEY) || '{}');
      saved[state.doneKey] = [...state.done];
      const keys = Object.keys(saved);
      while (keys.length > 5) delete saved[keys.shift()];
      ls.setItem(STORE_KEY, JSON.stringify(saved));
    });
  }

  function updateProgress() {
    const boxes = document.querySelectorAll('#results .plan-item input[type="checkbox"]');
    const done = [...boxes].filter((b) => b.checked).length;
    const pct = Tools.percent(done, boxes.length);
    $('ring-fg').style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct / 100));
    $('ring-text').textContent = `${pct}%`;
    $('progress-text').textContent =
      done === 0
        ? 'Tick actions as you do them to track your progress.'
        : pct === 100
          ? 'All done. Your family is breathing easier!'
          : `${done} of ${boxes.length} actions done. Keep going!`;
    $('results').querySelector('.progress-card').classList.toggle('complete', pct === 100 && boxes.length > 0);
  }

  function renderItem(item, index) {
    state.uid += 1;
    const id = `chk-${state.uid}`;
    const box = h('input', { type: 'checkbox', id, checked: state.done.has(item.title) });
    const li = h('li', { class: 'plan-item' });
    li.style.setProperty('--i', String(Math.min(index, 12)));
    li.classList.toggle('is-done', box.checked);
    box.addEventListener('change', () => {
      li.classList.toggle('is-done', box.checked);
      if (box.checked) state.done.add(item.title);
      else state.done.delete(item.title);
      saveDone();
      updateProgress();
    });
    li.append(
      h(
        'ul',
        { class: 'tags', 'aria-label': 'Action details' },
        h('li', { class: `tag t-${item.when}`, text: WHEN_LABEL[item.when] || item.when }),
        h('li', { class: 'tag', text: COST_LABEL[item.cost] || item.cost }),
        item.impact.exposure ? h('li', { class: 'tag', text: EXPOSURE_LABEL[item.impact.exposure] }) : null,
        item.by === 'gemini' ? h('li', { class: 'tag t-ai', text: 'Gemini' }) : null,
      ),
      h('div', { class: 'item-head' }, box, h('h4', {}, h('label', { for: id, text: item.title }))),
      h('p', { text: item.action }),
      h('p', {}, h('span', { class: 'label', text: 'Why it matters: ' }), item.why),
      h('p', { class: 'impact' }, h('span', { class: 'label', text: 'Your impact: ' }), item.impact.text),
      item.en
        ? h(
            'details',
            {},
            h('summary', { text: 'Show the English original' }),
            h('p', {}, h('strong', { text: item.en.title }), ` ${item.en.action}`),
            h('p', { text: `Why: ${item.en.why} Impact: ${item.en.impact}` }),
          )
        : null,
    );
    return li;
  }

  function renderSection(section, offset) {
    const headingId = `sec-${section.id}`;
    return h(
      'section',
      { class: 'plan-section', 'aria-labelledby': headingId },
      h('h3', { id: headingId, text: section.title }),
      h('ul', { class: 'plan-list' }, section.items.map((item, i) => renderItem(item, offset + i))),
    );
  }

  /* ---------- plan rendering ---------- */
  function renderPlan(payload) {
    const { plan } = payload;
    state.plan = plan;
    state.ai = payload.ai;
    state.doneKey = `${plan.air.city}|${new Date().toISOString().slice(0, 10)}|${plan.language || 'en'}`;
    state.done = loadDone(state.doneKey);

    renderGauge(plan.air);
    renderGroupRisk(plan.groupRisk || []);
    $('headline').textContent = plan.headline;
    $('summary').textContent = plan.summary;
    renderChart(plan.air);

    const ai = $('ai-box');
    clear(ai);
    if (payload.ai && payload.ai.used) {
      ai.append(h('h3', { text: 'Personalised by Gemini' }), h('p', { class: 'help', text: `Model: ${payload.ai.model}. CO2 figures are calculated by the app, not by the AI.` }));
      if (plan.localInsights && plan.localInsights.length) {
        ai.append(h('p', { class: 'label', text: 'Local considerations' }), h('ul', {}, plan.localInsights.map((t) => h('li', { text: t }))));
      }
    } else {
      ai.append(
        h('h3', { text: 'Built-in expert rules' }),
        h('p', {
          text:
            payload.ai && payload.ai.available
              ? 'Gemini did not respond this time, so this plan comes from the built-in rules engine. Try again for a fully AI-personalised plan.'
              : 'No Gemini key is configured, so this plan comes from the built-in rules engine.',
        }),
      );
    }
    ai.hidden = false;

    const safetyList = $('safety-list');
    clear(safetyList);
    (plan.safety || []).forEach((item, i) => safetyList.append(renderItem(item, i)));
    $('safety').hidden = !(plan.safety && plan.safety.length);

    $('impact-total').textContent =
      plan.totals.co2KgPerMonth > 0
        ? `Calculated from your inputs: the swaps in this plan could save roughly ${plan.totals.co2KgPerMonth} kg CO2e a month.`
        : `${plan.totals.actions} actions tailored to your household.`;

    const sections = $('sections');
    clear(sections);
    let offset = 0;
    plan.sections.forEach((sec) => {
      sections.append(renderSection(sec, offset));
      offset += sec.items.length;
    });

    const myths = $('myths');
    clear(myths);
    plan.myths.forEach((m) => myths.append(h('dt', { text: `Myth: ${m.myth}` }), h('dd', { text: `Fact: ${m.fact}` })));

    $('disclaimer').textContent = plan.disclaimer;
    $('results').hidden = false;
    $('ask-section').hidden = false;
    $('answer').textContent = '';
    document.querySelectorAll('#results .reveal, #ask-section.reveal').forEach((el) => {
      if (reduceMotion || !revealObserver) el.classList.add('in');
      else if (!el.classList.contains('in')) revealObserver.observe(el);
    });
    updateProgress();
    $('results-title').focus({ preventScroll: true });
    $('results').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ---------- share / copy ---------- */
  function todayActions(plan) {
    const all = [...(plan.safety || []), ...plan.sections.flatMap((sec) => sec.items)];
    return all.filter((i) => i.when === 'today').slice(0, 4);
  }
  function shareText(plan) {
    const lines = [`Clean Air Compass | ${plan.air.city}: AQI ${plan.air.aqi} (${plan.air.label})`, plan.headline, '', 'Do today:'];
    todayActions(plan).forEach((i) => lines.push(`- ${i.title}`));
    lines.push('', `Get a plan for your family: ${window.location.origin}`);
    return lines.join('\n');
  }
  function planToText(plan) {
    const lines = [`Clean Air Compass plan for ${plan.air.city}`, `AQI ${plan.air.aqi} (${plan.air.label})`, plan.headline, '', 'SAFETY ESSENTIALS'];
    for (const i of plan.safety || []) lines.push(`- ${i.title}: ${i.action}`);
    lines.push('');
    for (const sec of plan.sections) {
      lines.push(sec.title.toUpperCase());
      for (const i of sec.items) lines.push(`- ${i.title}: ${i.action} Impact: ${i.impact.text}`);
      lines.push('');
    }
    lines.push(plan.disclaimer);
    return lines.join('\n');
  }
  async function onShare() {
    if (!state.plan) return;
    const text = shareText(state.plan);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Clean Air Compass', text });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
  async function onCopy() {
    if (!state.plan) return;
    try {
      await navigator.clipboard.writeText(planToText(state.plan));
      $('progress-text').textContent = 'Plan copied to clipboard.';
    } catch (_) {
      $('progress-text').textContent = 'Copy is not available in this browser. Use Print instead.';
    }
  }

  /* ---------- form handlers ---------- */
  async function onSubmit(event) {
    event.preventDefault();
    showErrors([]);
    const button = $('submit');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    startLoader();
    try {
      const payload = await postJson('/api/plan', readProfile());
      setStatus('Your plan is ready.');
      renderPlan(payload);
    } catch (err) {
      setStatus('');
      showErrors([err.message, ...(err.details || [])]);
      if (/manually/i.test(err.message)) $('manualAqi').closest('details').open = true;
    } finally {
      stopLoader();
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  const GEO_ERRORS = {
    1: 'Location permission was denied. Allow location for this site in your browser, or type your city.',
    2: 'Your device could not work out its location. On Windows, turn on Settings > Privacy > Location, or type your city.',
    3: 'Finding your location took too long. Try again, or type your city.',
  };

  function onLocate() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location. Type your city instead.');
      return;
    }
    const button = $('locate');
    button.disabled = true;
    setStatus('Asking your device for its location\u2026');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        const form = $('plan-form');
        form.dataset.lat = lat;
        form.dataset.lon = lon;
        $('city').value = `My location (${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)})`;
        setStatus('Location found. Looking up the place name\u2026');
        try {
          const res = await fetch(`/api/reverse?lat=${lat}&lon=${lon}`);
          const payload = await res.json();
          if (payload && payload.name) $('city').value = payload.name;
        } catch (_) {
          /* keep the coordinates label */
        }
        setStatus(`Location set to ${$('city').value}. Press "Build my plan".`);
        button.disabled = false;
      },
      (err) => {
        setStatus(GEO_ERRORS[err.code] || 'Could not get your location. Type your city instead.');
        button.disabled = false;
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }

  function clearCoords() {
    const form = $('plan-form');
    delete form.dataset.lat;
    delete form.dataset.lon;
  }

  function onDemo() {
    const form = $('plan-form');
    clearCoords();
    $('city').value = 'Delhi';
    $('manualAqi').value = '';
    form.elements.children.checked = true;
    form.elements.elderly.checked = true;
    form.elements.sensitive.checked = false;
    form.elements.commute.value = 'car';
    form.elements.commuteKm.value = '12';
    form.elements.cooking.value = 'lpg';
    form.elements.heating.value = 'electric_heater';
    form.elements.budget.value = 'low';
    setStatus('Example filled in. Press "Build my plan".');
    $('submit').focus();
  }

  async function onAsk(event) {
    event.preventDefault();
    const out = $('answer');
    out.textContent = 'Thinking\u2026';
    try {
      const air = state.plan ? state.plan.air : null;
      const payload = await postJson('/api/ask', {
        question: $('question').value,
        language: $('language').value,
        context: { city: air ? air.city : '', aqi: air ? air.aqi : null },
      });
      out.textContent = payload.source === 'gemini' ? `${payload.answer}\n\n(Gemini, ${payload.model})` : payload.answer;
    } catch (err) {
      out.textContent = [err.message, ...(err.details || [])].join(' ');
    }
  }

  /* ---------- toolbox ---------- */
  function initToolbox() {
    const legend = $('legend');
    LEVEL_NAMES.forEach((name, i) => {
      legend.append(h('li', {}, h('span', { class: `swatch sw-${i}`, 'aria-hidden': 'true' }), h('span', {}, h('strong', { text: `${LEVEL_RANGES[i]}: ` }), name)));
    });
    $('tool-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const out = $('tool-result');
      const r = Tools.purifierSizing({ lengthM: Number($('roomL').value), widthM: Number($('roomW').value), heightM: Number($('roomH').value) });
      out.textContent = r
        ? `Your room is about ${r.areaM2} m\u00b2 (${r.volumeM3} m\u00b3). Look for a purifier with a CADR of at least ${r.cadrM3h} m\u00b3/h (about ${r.cadrCfm} cfm). A higher rating cleans the room faster on smoggy days.`
        : 'Please enter sensible room sizes (length and width 1 to 30 m, height 2 to 6 m).';
    });
  }

  /* ---------- init ---------- */
  initTheme();
  initReveal();
  initToolbox();
  $('plan-form').addEventListener('submit', onSubmit);
  $('locate').addEventListener('click', onLocate);
  $('city').addEventListener('input', clearCoords);
  $('demo').addEventListener('click', onDemo);
  $('ask-form').addEventListener('submit', onAsk);
  $('copy').addEventListener('click', onCopy);
  $('share').addEventListener('click', onShare);
  $('print').addEventListener('click', () => window.print());
})();
