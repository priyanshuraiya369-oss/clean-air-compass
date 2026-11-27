'use strict';

const DEFAULT_MAX_ENTRIES = 500;

/** Tiny TTL cache with a hard size cap (oldest entry evicted first). */
class TtlCache {
  constructor(ttlMs, max = DEFAULT_MAX_ENTRIES, now = Date.now) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.now = now;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, expires: this.now() + this.ttlMs });
  }
}

module.exports = { TtlCache };
