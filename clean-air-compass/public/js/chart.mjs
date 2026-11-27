import { $, h, s, clear } from './dom.mjs';
import { LEVEL_NAMES } from './labels.mjs';
import { tools } from './state.mjs';

const W = 720;
const H = 230;
const PAD = { left: 36, right: 8, top: 22, bottom: 28 };

function summaryText(forecast) {
  const { best, worst } = forecast;
  const worstText = `Worst: ${worst.day} ${worst.from} to ${worst.to} (AQI around ${worst.aqi}).`;
  return best
    ? `Best time outside ${best.day}: ${best.from} to ${best.to} (AQI around ${best.aqi}). ${worstText}`
    : worstText;
}

/** Index of the first hour of the "best" window within the hourly series, or -1. */
export function bestIndex(hours, best) {
  if (!best) return -1;
  const firstDay = hours[0].t.slice(0, 10);
  return hours.findIndex(
    (x) =>
      x.t.slice(11, 16) === best.from &&
      (best.day === 'today' ? x.t.slice(0, 10) === firstDay : x.t.slice(0, 10) !== firstDay),
  );
}

function buildSvg(hours, forecast) {
  const top = Math.ceil(Math.max(150, ...hours.map((x) => x.aqi)) / 50) * 50;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v) => PAD.top + plotH * (1 - v / top);
  const bw = (W - PAD.left - PAD.right) / hours.length;
  const level = tools().levelOf;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': 'chart-title chart-desc' });
  svg.append(
    s('desc', { id: 'chart-desc', text: `Bar chart of hourly US AQI for the next 24 hours. ${summaryText(forecast)}` }),
  );

  for (let v = 0; v <= top; v += 50) {
    svg.append(
      s('line', { class: 'grid-line', x1: PAD.left, x2: W - PAD.right, y1: y(v), y2: y(v) }),
      s('text', { class: 'axis', x: PAD.left - 6, y: y(v) + 4, 'text-anchor': 'end', text: String(v) }),
    );
  }

  const idx = bestIndex(hours, forecast.best);
  if (idx >= 0) {
    const x = PAD.left + idx * bw;
    svg.append(
      s('rect', { class: 'best-band', x, y: PAD.top - 4, width: bw * 2, height: plotH + 4, rx: 6 }),
      s('text', { class: 'best-label', x: x + bw, y: PAD.top - 8, 'text-anchor': 'middle', text: 'Best' }),
    );
  }

  hours.forEach((hour, i) => {
    const bar = s(
      'rect',
      {
        class: `bar lvl-${level(hour.aqi)}`,
        x: PAD.left + i * bw + 2,
        y: y(hour.aqi),
        width: bw - 4,
        height: Math.max(2, y(0) - y(hour.aqi)),
        rx: 3,
      },
      s('title', { text: `${hour.t.slice(11, 16)}: AQI ${hour.aqi}` }),
    );
    bar.style.setProperty('--i', String(i));
    svg.append(bar);
    if (i % 3 === 0) {
      svg.append(
        s('text', {
          class: 'axis',
          x: PAD.left + i * bw + bw / 2,
          y: H - 8,
          'text-anchor': 'middle',
          text: hour.t.slice(11, 13),
        }),
      );
    }
  });
  return svg;
}

function buildTable(hours) {
  const level = tools().levelOf;
  return h(
    'table',
    {},
    h('caption', { class: 'help', text: 'Hourly US AQI for the next 24 hours (local time)' }),
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        ['Hour', 'AQI', 'Category'].map((name) => h('th', { scope: 'col', text: name })),
      ),
    ),
    h(
      'tbody',
      {},
      hours.map((hour) =>
        h(
          'tr',
          {},
          h('td', { text: hour.t.slice(11, 16) }),
          h('td', { text: String(hour.aqi) }),
          h('td', { text: LEVEL_NAMES[level(hour.aqi)] }),
        ),
      ),
    ),
  );
}

/** Render the 24-hour bar chart (plus a table alternative), or hide the card when there is no forecast. */
export function renderChart(air) {
  const card = $('chart-card');
  const forecast = air.forecast;
  if (!forecast || !Array.isArray(forecast.hours) || forecast.hours.length < 6) {
    card.hidden = true;
    return;
  }
  $('forecast').textContent = summaryText(forecast);
  clear($('chart'));
  $('chart').append(buildSvg(forecast.hours, forecast));
  clear($('chart-table'));
  $('chart-table').append(buildTable(forecast.hours));
  card.hidden = false;
}
