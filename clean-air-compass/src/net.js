'use strict';

const dns = require('node:dns');
const https = require('node:https');

/**
 * Resilient fetch for networks where the system DNS cannot resolve some hosts
 * (the "ENOTFOUND" error). It tries normal fetch first; on a DNS or connect failure
 * it retries once over HTTPS using public DNS resolvers (Google and Cloudflare).
 */

const DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];
const RETRYABLE = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']);

function isNetworkFailure(err) {
  const code = err && err.cause && err.cause.code;
  return Boolean(code && RETRYABLE.has(code)) || (err && err.name === 'PrimaryTimeout');
}

/** HTTPS request that resolves host names through public DNS. Returns a fetch-like response. */
function viaPublicDns(url, init = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const resolver = new dns.Resolver();
    resolver.setServers(DNS_SERVERS);
    const lookup = (hostname, options, callback) => {
      resolver.resolve4(hostname, (err, addresses) => {
        if (err) return callback(err);
        if (options && options.all) return callback(null, addresses.map((address) => ({ address, family: 4 })));
        return callback(null, addresses[0], 4);
      });
    };
    const req = https.request(
      target,
      { method: init.method || 'GET', headers: init.headers || {}, lookup, signal: init.signal },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => text,
            json: async () => JSON.parse(text),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

/**
 * @param {{primary?:typeof fetch, fallback?:typeof viaPublicDns, primaryTimeoutMs?:number}} [opts]
 * @returns {typeof fetch}
 */
function createResilientFetch({ primary = globalThis.fetch, fallback = viaPublicDns, primaryTimeoutMs = 6000 } = {}) {
  return async function resilientFetch(url, init = {}) {
    const callerSignal = init.signal;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const e = new Error('Primary attempt timed out');
      e.name = 'PrimaryTimeout';
      controller.abort(e);
    }, primaryTimeoutMs);
    const onCallerAbort = () => controller.abort(callerSignal.reason);
    if (callerSignal) {
      if (callerSignal.aborted) onCallerAbort();
      else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
    try {
      return await primary(url, { ...init, signal: controller.signal });
    } catch (err) {
      const primaryTimedOut = controller.signal.aborted && controller.signal.reason && controller.signal.reason.name === 'PrimaryTimeout';
      if (callerSignal && callerSignal.aborted) throw err;
      if (!(primaryTimedOut || isNetworkFailure(err))) throw err;
      return fallback(url, { ...init, signal: callerSignal });
    } finally {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
    }
  };
}

module.exports = { createResilientFetch, viaPublicDns, isNetworkFailure };
