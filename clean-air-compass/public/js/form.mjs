import { $, setStatus, showErrors } from './dom.mjs';
import { postJson, getJson } from './api.mjs';
import { startLoader, stopLoader } from './loader.mjs';
import { renderPlan } from './plan.mjs';

const GEO_ERRORS = {
  1: 'Location permission was denied. Allow location for this site in your browser, or type your city.',
  2: 'Your device could not work out its location. On Windows, turn on Settings > Privacy > Location, or type your city.',
  3: 'Finding your location took too long. Try again, or type your city.',
};

/** Read the form into the JSON the API expects. */
function readProfile() {
  const form = $('plan-form');
  const data = new FormData(form);
  const text = (name) => String(data.get(name) || '').trim();
  const number = (name) => (text(name) === '' ? undefined : Number(text(name)));
  return {
    city: text('city'),
    manualAqi: number('manualAqi'),
    lat: form.dataset.lat ? Number(form.dataset.lat) : undefined,
    lon: form.dataset.lon ? Number(form.dataset.lon) : undefined,
    children: data.has('children'),
    elderly: data.has('elderly'),
    sensitive: data.has('sensitive'),
    hasPurifier: data.has('hasPurifier'),
    commute: text('commute'),
    commuteKm: number('commuteKm'),
    cooking: text('cooking'),
    heating: text('heating'),
    homeType: text('homeType'),
    budget: text('budget'),
    language: text('language') || 'en',
    notes: text('notes'),
  };
}

export function clearCoords() {
  const form = $('plan-form');
  delete form.dataset.lat;
  delete form.dataset.lon;
}

export async function onSubmit(event) {
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

async function useCoordinates(position, button) {
  const lat = position.coords.latitude.toFixed(4);
  const lon = position.coords.longitude.toFixed(4);
  const form = $('plan-form');
  form.dataset.lat = lat;
  form.dataset.lon = lon;
  $('city').value = `My location (${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)})`;
  setStatus('Location found. Looking up the place name\u2026');
  try {
    const payload = await getJson(`/api/reverse?lat=${lat}&lon=${lon}`);
    if (payload && payload.name) $('city').value = payload.name;
  } catch {
    // keep the coordinates label
  }
  setStatus(`Location set to ${$('city').value}. Press "Build my plan".`);
  button.disabled = false;
}

export function onLocate() {
  if (!navigator.geolocation) {
    setStatus('Your browser does not support location. Type your city instead.');
    return;
  }
  const button = $('locate');
  button.disabled = true;
  setStatus('Asking your device for its location\u2026');
  navigator.geolocation.getCurrentPosition(
    (position) => useCoordinates(position, button),
    (err) => {
      setStatus(GEO_ERRORS[err.code] || 'Could not get your location. Type your city instead.');
      button.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
  );
}

/** Fill the form with a realistic example household. */
export function onDemo() {
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
