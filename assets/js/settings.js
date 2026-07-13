// tinymoon — schema-parameterized settings store (localStorage) and theme
// application. Create the store and call load() + applyTheme() before the
// first paint of the app shell, so the theme attribute is already on <html>
// when content appears.

// Read a CSS custom property off :root — canvas rendering and layout math
// pull live token values from the active theme through this.
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// createSettings({storageKey, defaults}) → {get, set, load, applyTheme}.
// Both parameters are required: storageKey is the localStorage key, defaults
// is the schema — its keys are the only settable keys, its values the
// defaults. set() persists and dispatches "tm:setting" (CustomEvent with
// {key, value} detail); setting "theme" also re-applies it. applyTheme()
// mirrors the "theme" value onto <html data-theme> and dispatches
// "tm:theme".
export function createSettings({ storageKey, defaults } = {}) {
  if (!storageKey) throw new Error("createSettings: storageKey is required");
  if (!defaults || typeof defaults !== "object") throw new Error("createSettings: defaults is required");
  const data = { ...defaults };

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
      data[key] = value;
      localStorage.setItem(storageKey, JSON.stringify(data));
      if (key === "theme") store.applyTheme();
      window.dispatchEvent(new CustomEvent("tm:setting", { detail: { key, value } }));
    },

    applyTheme() {
      if (!("theme" in data)) throw new Error("applyTheme: no \"theme\" key in the settings schema");
      document.documentElement.dataset.theme = data.theme;
      window.dispatchEvent(new Event("tm:theme"));
    },
  };
  return store;
}
