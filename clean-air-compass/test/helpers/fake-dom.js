'use strict';

/**
 * A minimal fake DOM, just big enough to run the page's render modules in Node.
 * It supports element creation, attributes, classList, style, events and text content.
 */
const fs = require('node:fs');
const path = require('node:path');

class FakeText {
  constructor(data) {
    this.data = String(data);
    this.parent = null;
  }
  get textContent() {
    return this.data;
  }
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.classes = new Set();
    this.dataset = {};
    this.listeners = {};
    this.hidden = false;
    this.checked = false;
    this.disabled = false;
    this.value = '';
    const props = {};
    this.style = {
      props,
      setProperty: (k, v) => {
        props[k] = v;
      },
      strokeDashoffset: '',
      transform: '',
    };
    const self = this;
    this.classList = {
      add: (c) => self.classes.add(c),
      remove: (c) => self.classes.delete(c),
      contains: (c) => self.classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !self.classes.has(c) : Boolean(force);
        if (on) self.classes.add(c);
        else self.classes.delete(c);
        return on;
      },
    };
  }

  get firstChild() {
    return this.children[0] || null;
  }
  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1);
    child.parent = null;
    return child;
  }
  append(...nodes) {
    for (const n of nodes) {
      const node = typeof n === 'string' ? new FakeText(n) : n;
      node.parent = this;
      this.children.push(node);
    }
  }

  setAttribute(key, value) {
    this.attrs[key] = String(value);
    if (key === 'checked') this.checked = true;
    if (key === 'class') this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  getAttribute(key) {
    return key in this.attrs ? this.attrs[key] : null;
  }
  removeAttribute(key) {
    delete this.attrs[key];
  }

  set textContent(text) {
    this.children = [];
    if (text !== '') this.children.push(new FakeText(text));
  }
  get textContent() {
    return this.children.map((c) => c.textContent).join('');
  }

  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  fire(type, event = {}) {
    (this.listeners[type] || []).forEach((fn) => fn(event));
  }
  focus() {}
  scrollIntoView() {}
  closest() {
    return this;
  }
}

/** Collect every descendant element matching `predicate`. */
function findAll(root, predicate, out = []) {
  for (const child of root.children || []) {
    if (child instanceof FakeElement) {
      if (predicate(child)) out.push(child);
      findAll(child, predicate, out);
    }
  }
  return out;
}

const hasClass = (name) => (el) => el.classes.has(name);

/** Install `window` and `document` globals; every id in index.html becomes a pre-made element. */
function installFakeDom({ reducedMotion = true } = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  const registry = new Map();
  for (const [, id] of html.matchAll(/\bid="([\w-]+)"/g)) {
    const el = new FakeElement('div');
    el.setAttribute('id', id);
    registry.set(id, el);
  }
  const memory = new Map();
  const documentElement = new FakeElement('html');
  const fakeDocument = {
    documentElement,
    getElementById: (id) => registry.get(id) || null,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (_ns, tag) => new FakeElement(tag),
    createTextNode: (text) => new FakeText(text),
  };
  const fakeWindow = {
    matchMedia: () => ({ matches: reducedMotion }),
    localStorage: {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
    },
    CleanAirTools: require('../../public/tools.js'),
    location: { origin: 'http://localhost' },
  };
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  return { registry, window: fakeWindow, memory };
}

module.exports = { installFakeDom, FakeElement, FakeText, findAll, hasClass };
