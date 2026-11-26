'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEnvFile } = require('../src/env');

function tmpEnv(text) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'env-')), '.env');
  fs.writeFileSync(file, text);
  return file;
}

test('loads KEY=VALUE pairs, ignores comments, blanks and empty values', () => {
  const env = {};
  const n = loadEnvFile(tmpEnv('# c\nGEMINI_API_KEY=abc123\nPORT="9000"\r\nEMPTY=\n\nbad line\n'), env);
  assert.equal(n, 2);
  assert.equal(env.GEMINI_API_KEY, 'abc123');
  assert.equal(env.PORT, '9000');
  assert.equal(env.EMPTY, undefined);
});

test('never overrides existing variables and tolerates a missing file', () => {
  const env = { PORT: '1' };
  loadEnvFile(tmpEnv('PORT=2\n'), env);
  assert.equal(env.PORT, '1');
  assert.equal(loadEnvFile('/no/such/file', env), 0);
});
