// tinymoon — schema-parameterized settings store (localStorage) and theme
// application. Create the store and call load() + applyTheme() before the
// first paint of the app shell, so the theme attribute is already on <html>
// when content appears.

// createSettings({storageKey, defaults}) → {get, set, load, subscribe,
// applyTheme}. Both parameters are required: storageKey is the localStorage
// key, defaults is the schema — its keys are the only settable keys, its
// values the defaults. set() persists and dispatches "tm:setting" (CustomEvent
// with {key, value} detail); setting "theme" also re-applies it. applyTheme()
// mirrors the "theme" value onto <html data-theme> and dispatches "tm:theme".
//
// subscribe(key|null, cb) → unsubscribe is an ADDITIVE, direct notification
// channel with the IDENTICAL contract to createStore.subscribe (see store.js):
// `cb(value, previousValue, key)`; `key === null` subscribes to any setting
// change; a subscriber is skipped when `Object.is(old, value)` (a no-op write
// notifies nobody). It sits alongside the window events — set() still
// dispatches "tm:setting" (and re-applies "theme", dispatching "tm:theme")
// unconditionally, because those are the framework-global signals canvas
// components and cross-cutting listeners rely on. Subscribe is for local,
// targeted listeners that want a callback instead of a global event.
export function createSettings({ storageKey, defaults } = {}) {
  if (!storageKey) throw new Error("createSettings: storageKey is required");
  if (!defaults || typeof defaults !== "object") throw new Error("createSettings: defaults is required");
  const data = { ...defaults };

  // key -> Set<cb>. The `null` any-change subscribers live in `anyChange`.
  const keyed = new Map();
  const anyChange = new Set();

  function emit(key, value, old) {
    const subs = keyed.get(key);
    if (subs) for (const cb of [...subs]) cb(value, old, key);
    for (const cb of [...anyChange]) cb(value, old, key);
  }

  const store = {
    load() {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey));
        if (stored && typeof stored === "object") {
          for (const k of Object.keys(data)) {
            if (k in stored) data[k] = stored[k];
          }
        }
      } catch { /* corrupted storage falls back to defaults */ }
    },

    get(key) {
      if (!(key in data)) throw new Error("unknown setting: " + key);
      return data[key];
    },

    set(key, value) {
      if (!(key in data)) throw new Error("unknown setting: " + key);
      const old = data[key];
      data[key] = value;
      localStorage.setItem(storageKey, JSON.stringify(data));
      if (key === "theme") store.applyTheme();
      // Framework-global signal: dispatched unconditionally (unchanged).
      window.dispatchEvent(new CustomEvent("tm:setting", { detail: { key, value } }));
      // Direct subscribers follow the store contract: skip on Object.is.
      if (!Object.is(old, value)) emit(key, value, old);
    },

    // subscribe(key|null, cb) → unsubscribe. Same contract as
    // createStore.subscribe: cb(value, previousValue, key); null = any change.
    // Unknown (non-null) keys are a hard error, matching get()/set().
    subscribe(key, cb) {
      if (typeof cb !== "function") throw new Error("subscribe: cb must be a function");
      if (key === null || key === undefined) {
        anyChange.add(cb);
        return () => anyChange.delete(cb);
      }
      if (!(key in data)) throw new Error("unknown setting: " + key);
      let subs = keyed.get(key);
      if (!subs) { subs = new Set(); keyed.set(key, subs); }
      subs.add(cb);
      return () => {
        const g = keyed.get(key);
        if (g) g.delete(cb);
      };
    },

    applyTheme() {
      if (!("theme" in data)) throw new Error("applyTheme: no \"theme\" key in the settings schema");
      document.documentElement.dataset.theme = data.theme;
      window.dispatchEvent(new CustomEvent("tm:theme"));
    },
  };
  return store;
}
