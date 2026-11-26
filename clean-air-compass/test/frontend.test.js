'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Tools = require('../public/tools.js');

const publicDir = path.join(__dirname, '..', 'public');
const read = (f) => fs.readFileSync(path.join(publicDir, f), 'utf8');
const modules = fs.readdirSync(path.join(publicDir, 'js')).filter((f) => f.endsWith('.mjs'));
const allModuleSource = () => modules.map((f) => read(`js/${f}`)).join('\n');

test('gaugeAngle gives every AQI band an equal 30 degree arc', () => {
  assert.equal(Tools.gaugeAngle(0), 0);
  assert.equal(Tools.gaugeAngle(50), 30);
  assert.equal(Tools.gaugeAngle(100), 60);
  assert.equal(Tools.gaugeAngle(150), 90);
  assert.equal(Tools.gaugeAngle(200), 120);
  assert.equal(Tools.gaugeAngle(300), 150);
  assert.equal(Tools.gaugeAngle(500), 180);
  assert.equal(Tools.gaugeAngle(9999), 180);
  assert.equal(Tools.gaugeAngle(NaN), 0);
  assert.ok(Tools.gaugeAngle(75) > Tools.gaugeAngle(60));
});

test('levelOf matches the AQI categories', () => {
  assert.deepEqual([0, 50, 51, 100, 150, 151, 200, 201, 300, 301, 500].map(Tools.levelOf), [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5]);
});

test('purifierSizing uses 4.8 air changes per hour and validates input', () => {
  const r = Tools.purifierSizing({ lengthM: 4, widthM: 3.5, heightM: 2.7 });
  assert.equal(r.areaM2, 14);
  assert.equal(r.volumeM3, 37.8);
  assert.equal(r.cadrM3h, 181);
  assert.equal(r.cadrCfm, 107);
  assert.equal(Tools.purifierSizing({ lengthM: 0, widthM: 3 }), null);
  assert.equal(Tools.purifierSizing({ lengthM: 'x', widthM: 3 }), null);
  assert.equal(Tools.purifierSizing({ lengthM: 100, widthM: 3 }), null);
});

test('percent handles zero totals', () => {
  assert.equal(Tools.percent(0, 0), 0);
  assert.equal(Tools.percent(3, 12), 25);
  assert.equal(Tools.percent(12, 12), 100);
});

test('every element id that the modules look up exists in index.html', () => {
  const html = read('index.html');
  const js = allModuleSource();
  const used = new Set([...js.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]));
  assert.ok(used.size > 30);
  const missing = [...used].filter((id) => !new RegExp(`id="${id}"`).test(html));
  assert.deepEqual(missing, []);
});

test('page is CSP-safe: no inline scripts, handlers or style attributes; scripts exist', () => {
  const html = read('index.html');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'inline <script> found');
  assert.ok(!/\son\w+\s*=/.test(html), 'inline event handler found');
  assert.ok(!/\sstyle\s*=/.test(html), 'inline style attribute found');
  assert.ok(!/<style[\s>]/.test(html), 'inline <style> found');
  for (const m of html.matchAll(/(?:src|href)="\/([\w./-]+)(?:\?[^"]*)?"/g)) {
    assert.ok(fs.existsSync(path.join(publicDir, m[1])), `missing asset ${m[1]}`);
  }
});

test('front-end code never uses innerHTML, eval or document.write', () => {
  const js = allModuleSource() + read('tools.js') + read('theme.js');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|document\.write|new Function/.test(js));
});

test('reduced-motion and dark-theme support are present in the stylesheet', () => {
  const css = read('styles.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /@media print/);
});

test('every named import in the front-end modules is exported by its source module', () => {
  for (const file of modules) {
    const src = read(`js/${file}`);
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([\w.-]+)'/g)) {
      const target = read(`js/${m[2]}`);
      for (const name of m[1].split(',').map((n) => n.trim()).filter(Boolean)) {
        const escaped = name.replace(/[$]/g, '\\$&');
        const exported = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${escaped}(?![\\w$])`).test(target);
        assert.ok(exported, `${file} imports ${name} which ${m[2]} does not export`);
      }
    }
  }
});

test('no front-end module is larger than 200 lines (keeps files focused)', () => {
  for (const file of modules) {
    const lines = read(`js/${file}`).split('\n').length;
    assert.ok(lines <= 200, `${file} has ${lines} lines`);
  }
});
