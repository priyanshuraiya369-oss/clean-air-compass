'use strict';

// Usage: npm run check
// Syntax-checks every JavaScript file (CommonJS and ES modules) without any dependencies.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.vercel']);

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(c|m)?js$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = collect(ROOT);
const failures = files.filter((file) => spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }).status !== 0);
for (const file of failures) console.error(`Syntax error in ${path.relative(ROOT, file)}`);
console.log(`Checked ${files.length} files, ${failures.length} with errors.`);
process.exitCode = failures.length ? 1 : 0;
