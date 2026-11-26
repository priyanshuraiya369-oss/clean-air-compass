'use strict';

/**
 * Fixed-window in-memory rate limiter. Memory is bounded: expired windows are
 * purged lazily and the table is capped.
 * @param {{limit:number, windowMs:number, maxKeys?:number, now?:()=>number}} opts
 */
function createRateLimiter({ limit, windowMs, maxKeys = 10000, now = Date.now }) {
  const hits = new Map();

  function purge(t) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= t) hits.delete(key);
    }
  }

  /** @returns {{allowed:boolean, remaining:number, retryAfterSec:number}} */
  function check(key) {
    const t = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (hits.size >= maxKeys) {
        purge(t);
        if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
      }
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    const allowed = entry.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)),
    };
  }

  return { check, size: () => hits.size };
}

module.exports = { createRateLimiter };
