'use strict';

const { DEFAULT_MODELS } = require('./gemini');

const MODEL_NAME = /^[a-z0-9][a-z0-9.-]{1,60}$/i;

/**
 * Read and sanitise runtime configuration from environment variables.
 * @param {NodeJS.ProcessEnv} env
 */
function readConfig(env) {
  const requested = [env.GEMINI_MODEL, ...String(env.GEMINI_FALLBACK_MODELS || '').split(',')]
    .map((name) => String(name || '').trim())
    .filter((name) => MODEL_NAME.test(name));
  return {
    geminiKey: env.GEMINI_API_KEY || '',
    models: requested.length ? requested : [...DEFAULT_MODELS],
    waqiToken: env.WAQI_TOKEN || '',
    trustedHops: Math.max(0, parseInt(env.TRUST_PROXY_HOPS || '0', 10) || 0),
  };
}

module.exports = { readConfig };
