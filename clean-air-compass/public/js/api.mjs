/** POST JSON and return the parsed body. Throws an Error with `.details` on a non-2xx response. */
export async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let payload = {};
  try {
    payload = await res.json();
  } catch {
    // non-JSON error body (for example a platform error page)
  }
  if (!res.ok) {
    const err = new Error(payload.error || `Request failed (HTTP ${res.status}).`);
    err.details = Array.isArray(payload.details) ? payload.details : [];
    throw err;
  }
  return payload;
}

export async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}
