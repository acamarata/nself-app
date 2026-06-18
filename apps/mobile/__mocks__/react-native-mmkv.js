/**
 * Jest manual mock for react-native-mmkv.
 * Uses an in-memory store — same interface as real MMKV.
 * Note: Do NOT call afterEach here; this file is require()d inside test code which
 * would cause "Hooks cannot be defined inside tests" errors in Jest Circus.
 * Tests that need a clean store should call clearAll() in their own beforeEach.
 */
const stores = {};

class MMKV {
  constructor(options) {
    const id = options?.id ?? 'default';
    if (!stores[id]) stores[id] = {};
    this._store = stores[id];
  }
  getString(key) { return this._store[key]; }
  set(key, value) { this._store[key] = value; }
  delete(key) { delete this._store[key]; }
  clearAll() { Object.keys(this._store).forEach(k => delete this._store[k]); }
  static _resetAll() { Object.keys(stores).forEach(k => delete stores[k]); }
}

module.exports = { MMKV };
