'use strict';

/**
 * Frontend for Clean Air Compass.
 * Security: all server data is rendered with textContent / createElement. innerHTML is never used.
 */
(function () {
  const $ = (id) => document.getElementById(id);

  const WHEN_LABEL = { today: 'Do today', 'this-week': 'This week', 'long-term': 'Long term' };
  const COST_LABEL = { free: 'Free', low: 'Low cost', medium: 'Medium cost', high: 'Higher cost' };
  const EXPOSURE_LABEL = {
    high: 'Big cut in exposure',
    medium: 'Moderate cut in exposure',
    low: 'Small cut in exposure',
  };

  let lastPlan = null;
  let lastAir = null;

  /** Tiny element builder. Children may be strings or nodes. */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined) continue;
      el.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }

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

  function renderItem(item) {
    const tags = h(
      'ul',
      { class: 'tags', 'aria-label': 'Action details' },
      h('li', { class: 'tag', text: WHEN_LABEL[item.when] || item.when }),
      h('li', { class: 'tag', text: COST_LABEL[item.cost] || item.cost }),
      item.impact.exposure ? h('li', { class: 'tag', text: EXPOSURE_LABEL[item.impact.exposure] }) : null,
    );
    return h(
      'li',
      { class: 'plan-item' },
      tags,
      h('h4', { text: item.title }),
      h('p', { text: item.action }),
      h('p', {}, h('span', { class: 'label', text: 'Why it matters: ' }), item.why),
      h('p', { class: 'impact' }, h('span', { class: 'label', text: 'Your impact: ' }), item.impact.text),
    );
  }

  function renderSection(section) {
    const headingId = `sec-${section.id}`;
    return h(
      'section',
      { class: 'plan-section', 'aria-labelledby': headingId },
      h('h3', { id: headingId, text: section.title }),
      h('ul', { class: 'plan-list' }, section.items.map(renderItem)),
    );
  }

  function renderPlan(payload) {
    const { plan, enhancement } = payload;
    lastPlan = plan;
    lastAir = plan.air;

    const card = $('air-card');
    card.dataset.level = String(plan.air.level);
    clear(card);
    card.append(
      h('div', { class: 'air-number', 'aria-hidden': 'true', text: String(plan.air.aqi) }),
      h(
        'div',
        { class: 'air-meta' },
        h('p', { class: 'air-label', text: `AQI ${plan.air.aqi}: ${plan.air.label}` }),
        h('p', { text: plan.air.city }),
        plan.air.pm25 !== null ? h('p', { text: `PM2.5 ${plan.air.pm25} \u00b5g/m\u00b3` }) : null,
        h('p', { text: plan.air.source === 'manual' ? 'Source: value you entered' : 'Source: Open-Meteo live data' }),
      ),
    );

    $('headline').textContent = plan.headline;
    $('summary').textContent = plan.summary;

    const ai = $('ai-box');
    clear(ai);
    if (enhancement) {
      ai.append(h('h3', { text: 'Personalised by Gemini' }));
      if (enhancement.summary) ai.append(h('p', { text: enhancement.summary }));
      if (enhancement.extraTips.length) {
        ai.append(
          h(
            'ul',
            {},
            enhancement.extraTips.map((t) =>
              h('li', {}, h('strong', { text: `${t.title}: ` }), `${t.action} `, h('em', { text: t.why })),
            ),
          ),
        );
      }
      ai.hidden = false;
    } else {
      ai.hidden = true;
    }

    const total = $('impact-total');
    total.textContent =
      plan.totals.co2KgPerMonth > 0
        ? `${plan.totals.actions} actions. The sustainable swaps above could save roughly ${plan.totals.co2KgPerMonth} kg of CO2e a month (a rounded estimate).`
        : `${plan.totals.actions} actions tailored to your household.`;

    const sections = $('sections');
    clear(sections);
    plan.sections.forEach((s) => sections.append(renderSection(s)));

    const myths = $('myths');
    clear(myths);
    plan.myths.forEach((m) => {
      myths.append(h('dt', { text: `Myth: ${m.myth}` }), h('dd', { text: `Fact: ${m.fact}` }));
    });

    $('disclaimer').textContent = plan.disclaimer;
    $('results').hidden = false;
    $('ask-section').hidden = false;
    $('answer').textContent = '';
    $('results-title').focus();
    $('results').scrollIntoView({ block: 'start' });
  }

  function planToText(plan) {
    const lines = [`Clean Air Compass plan for ${plan.air.city}`, `AQI ${plan.air.aqi} (${plan.air.label})`, plan.headline, ''];
    for (const s of plan.sections) {
      lines.push(s.title.toUpperCase());
      for (const i of s.items) lines.push(`- ${i.title}: ${i.action} Impact: ${i.impact.text}`);
      lines.push('');
    }
    lines.push(plan.disclaimer);
    return lines.join('\n');
  }

  async function onSubmit(event) {
    event.preventDefault();
    showErrors([]);
    const button = $('submit');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setStatus('Fetching live air quality and building your plan\u2026');
    try {
      const payload = await postJson('/api/plan', readProfile());
      setStatus('Your plan is ready.');
      renderPlan(payload);
    } catch (err) {
      setStatus('');
      showErrors([err.message, ...(err.details || [])]);
      if (/manually/i.test(err.message)) $('manualAqi').closest('details').open = true;
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function onLocate() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location. Type your city instead.');
      return;
    }
    setStatus('Asking your device for its location\u2026');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const form = $('plan-form');
        form.dataset.lat = pos.coords.latitude.toFixed(4);
        form.dataset.lon = pos.coords.longitude.toFixed(4);
        $('city').value = '';
        setStatus('Location captured. Press "Build my plan".');
      },
      () => setStatus('Could not get your location. Type your city instead.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  }

  function onCityInput() {
    const form = $('plan-form');
    delete form.dataset.lat;
    delete form.dataset.lon;
  }

  function onDemo() {
    const form = $('plan-form');
    delete form.dataset.lat;
    delete form.dataset.lon;
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
    const input = $('question');
    const out = $('answer');
    out.textContent = 'Thinking\u2026';
    try {
      const payload = await postJson('/api/ask', {
        question: input.value,
        context: { city: lastAir ? lastAir.city : '', aqi: lastAir ? lastAir.aqi : null },
      });
      out.textContent = payload.answer;
    } catch (err) {
      out.textContent = [err.message, ...(err.details || [])].join(' ');
    }
  }

  async function onCopy() {
    if (!lastPlan) return;
    try {
      await navigator.clipboard.writeText(planToText(lastPlan));
      setStatus('Plan copied to clipboard.');
    } catch (_) {
      setStatus('Copy is not available in this browser. Use Print instead.');
    }
  }

  $('plan-form').addEventListener('submit', onSubmit);
  $('locate').addEventListener('click', onLocate);
  $('city').addEventListener('input', onCityInput);
  $('demo').addEventListener('click', onDemo);
  $('ask-form').addEventListener('submit', onAsk);
  $('copy').addEventListener('click', onCopy);
  $('print').addEventListener('click', () => window.print());
})();
