// Tiny DOM helpers. All page content is built with createElement/textContent, never HTML strings.
const SVG_NS = 'http://www.w3.org/2000/svg';

export const $ = (id) => document.getElementById(id);

export const reduceMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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

/** HTML element builder: h('p', {class: 'x'}, 'text', childNode). */
export const h = (tag, attrs, ...children) => build(null, tag, attrs, children);

/** SVG element builder. */
export const s = (tag, attrs, ...children) => build(SVG_NS, tag, attrs, children);

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Run a localStorage operation, returning undefined if storage is unavailable. */
export function store(fn) {
  try {
    return fn(window.localStorage);
  } catch {
    return undefined;
  }
}

export function setStatus(message) {
  $('form-status').textContent = message || '';
}

export function showErrors(list) {
  const box = $('form-errors');
  clear(box);
  for (const message of list || []) box.append(h('li', { text: message }));
  box.hidden = !(list && list.length);
}
