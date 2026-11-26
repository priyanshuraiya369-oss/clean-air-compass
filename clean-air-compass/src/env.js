'use strict';

const fs = require('node:fs');

/**
 * Minimal .env loader (no dependency). Existing environment variables always win,
 * so real deployment settings are never overridden by a local file.
 * @param {string} file
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number} number of variables set
 */
function loadEnvFile(file, env = process.env) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return 0;
  }
  let count = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (value !== '' && env[key] === undefined) {
      env[key] = value;
      count += 1;
    }
  }
  return count;
}

module.exports = { loadEnvFile };
