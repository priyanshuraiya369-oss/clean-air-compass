import { $, h, s, clear, reduceMotion } from './dom.mjs';
import { SOURCE_LABEL } from './labels.mjs';
import { tools } from './state.mjs';

/** SVG arc along the top half-circle from angle a0 to a1 (0 = left, 180 = right). */
export function arcPath(cx, cy, r, a0, a1) {
  const point = (angle) => {
    const rad = (angle * Math.PI) / 180;
    return [cx - r * Math.cos(rad), cy - r * Math.sin(rad)];
  };
  const [x0, y0] = point(a0);
  const [x1, y1] = point(a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Animate a number from 0 up to `to` (instant when motion is reduced). */
function countUp(el, to) {
  if (reduceMotion) {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  const duration = 1400;
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = String(Math.round(to * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** Render the AQI gauge card: six equal bands, a swinging needle, and the headline number. */
export function renderGauge(air) {
  const card = $('air-card');
  clear(card);
  card.dataset.level = String(air.level);

  const segments = [0, 1, 2, 3, 4, 5].map((level) =>
    s('path', { class: `seg seg-${level}`, d: arcPath(110, 110, 90, level * 30 + 1.5, (level + 1) * 30 - 1.5) }),
  );
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

  const rotation = tools().gaugeAngle(air.aqi) - 90;
  setTimeout(() => {
    needle.style.transform = `rotate(${rotation}deg)`;
    countUp(number, air.aqi);
  }, 120);
}
