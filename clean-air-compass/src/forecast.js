'use strict';

/**
 * Find the cleanest 2-hour daytime window (06:00-20:00 local) and the dirtiest 2-hour
 * window in the next 24 hours of hourly US AQI values.
 * @param {string[]} times local ISO times ("YYYY-MM-DDTHH:MM")
 * @param {Array<number|null>} values hourly AQI values
 * @param {string} nowIso current local time in the same format
 */
function summarizeForecast(times, values, nowIso) {
  if (!Array.isArray(times) || !Array.isArray(values) || !nowIso) return null;
  const rows = [];
  for (let i = 0; i < times.length && rows.length < 26; i++) {
    if (times[i] >= nowIso.slice(0, 13) + ':00' && Number.isFinite(values[i])) rows.push({ t: times[i], v: values[i] });
  }
  const windows = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (new Date(b.t) - new Date(a.t) !== 3600 * 1000) continue;
    windows.push({ start: a.t, end: b.t, aqi: Math.round((a.v + b.v) / 2) });
  }
  if (windows.length === 0) return null;
  const hour = (t) => Number(t.slice(11, 13));
  const daytime = windows.filter((w) => hour(w.start) >= 6 && hour(w.start) <= 18);
  const pick = (list, better) => list.reduce((best, w) => (better(w, best) ? w : best), list[0]);
  const best = daytime.length ? pick(daytime, (w, b) => w.aqi < b.aqi) : null;
  const worst = pick(windows, (w, b) => w.aqi > b.aqi);
  const day = (t) => (t.slice(0, 10) === nowIso.slice(0, 10) ? 'today' : 'tomorrow');
  const fmt = (w) => ({
    day: day(w.start),
    from: w.start.slice(11, 16),
    to: `${String((hour(w.start) + 2) % 24).padStart(2, '0')}:00`,
    aqi: w.aqi,
  });
  const hours = rows.slice(0, 24).map((r) => ({ t: r.t, aqi: Math.round(r.v) }));
  return { best: best ? fmt(best) : null, worst: fmt(worst), hours };
}

module.exports = { summarizeForecast };
