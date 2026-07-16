import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";

// Exports-map conformance: the package.json "exports" field must expose a
// per-module subpath for every shipped JS module in assets/js/, and every
// export target must point at a file that actually exists on disk.
//
// There is no build step and no tree-shaking, so per-module subpaths are the
// ONLY import-what-you-use mechanism (e.g. `import { createSelect } from
// "tinymoon/select"`). This test locks the exports map to the module set
// forever: add a module and forget its subpath, or delete a module and leave
// a dangling target, and this test fails.

const REPO = resolve(import.meta.dirname, "../../..");
const ASSETS_JS = join(REPO, "assets", "js");
const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));

// The barrels are exposed via the root, "./extras", "./state", and "./widgets"
// keys, NOT via a per-module subpath. Every other module must have its own
// subpath.
const BARRELS = new Set(["index.js", "extras.js", "state.js", "widgets.js"]);

// All shipped JS modules on disk (excludes .d.ts type declarations).
function diskModules() {
  return readdirSync(ASSETS_JS).filter((f) => f.endsWith(".js"));
}

// Resolve every export entry to the set of relative targets it references.
// Object entries contribute their "types" and "default" targets; string
// entries contribute themselves. The "./assets/*" wildcard is skipped where a
// concrete file is required.
function exportTargets(value) {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value).filter((v) => typeof v === "string");
  }
  return [];
}

// Map of module-basename -> subpath key, for every subpath whose default
// target is a file under assets/js/. Excludes the "./assets/*" wildcard.
function subpathModuleMap() {
  const map = new Map();
  // Barrel keys map to index.js / extras.js / state.js / widgets.js, not to a
  // per-module subpath.
  const BARREL_KEYS = new Set([".", "./extras", "./state", "./widgets", "./assets/*"]);
  for (const [key, value] of Object.entries(pkg.exports)) {
    if (BARREL_KEYS.has(key)) continue;
    const target = typeof value === "string" ? value : value?.default;
    if (typeof target !== "string") continue;
    if (!target.startsWith("./assets/js/") || !target.endsWith(".js")) continue;
    map.set(basename(target), key);
  }
  return map;
}

describe("package.json exports map", () => {
  it("defines an exports field", () => {
    expect(pkg.exports).toBeTypeOf("object");
  });

  it("every non-barrel module has a dedicated subpath export", () => {
    const covered = subpathModuleMap();
    const missing = diskModules().filter(
      (m) => !BARRELS.has(m) && !covered.has(m),
    );
    expect(missing, `modules without a subpath export: ${missing.join(", ")}`).toEqual([]);
  });

  it("every subpath export target maps to its matching module file", () => {
    // "./select" must map to ./assets/js/select.js, not some other file.
    for (const [mod, key] of subpathModuleMap()) {
      expect(key, `subpath ${key} -> ${mod}`).toBe(`./${mod.replace(/\.js$/, "")}`);
    }
  });

  it("every export target file exists on disk", () => {
    const dangling = [];
    for (const value of Object.values(pkg.exports)) {
      for (const target of exportTargets(value)) {
        if (target.includes("*")) continue; // wildcard, not a concrete file
        if (!existsSync(join(REPO, target))) dangling.push(target);
      }
    }
    expect(dangling, `export targets with no file: ${dangling.join(", ")}`).toEqual([]);
  });

  it("the barrels are exposed via the root, ./extras, ./state, and ./widgets keys", () => {
    const rootTarget = pkg.exports["."]?.default ?? pkg.exports["."];
    const extrasTarget = pkg.exports["./extras"]?.default ?? pkg.exports["./extras"];
    const stateTarget = pkg.exports["./state"]?.default ?? pkg.exports["./state"];
    const widgetsTarget = pkg.exports["./widgets"]?.default ?? pkg.exports["./widgets"];
    expect(basename(rootTarget)).toBe("index.js");
    expect(basename(extrasTarget)).toBe("extras.js");
    expect(basename(stateTarget)).toBe("state.js");
    expect(basename(widgetsTarget)).toBe("widgets.js");
  });

  // Prove the map actually RESOLVES, not just that the JSON looks right. Node
  // (and vitest) support package self-referencing via the "exports" field, so
  // "tinymoon/<sub>" resolves to assets/js/<sub>.js. dom and select both run
  // under happy-dom (they touch document/window).
  it("subpaths resolve at runtime via package self-reference", async () => {
    const dom = await import("tinymoon/dom");
    expect(dom.el, "tinymoon/dom exports el()").toBeTypeOf("function");
    const select = await import("tinymoon/select");
    expect(select.createSelect, "tinymoon/select exports createSelect()").toBeTypeOf("function");
    const store = await import("tinymoon/store");
    expect(store.createStore, "tinymoon/store exports createStore()").toBeTypeOf("function");
    const state = await import("tinymoon/state");
    expect(state.reconcile, "tinymoon/state exports reconcile()").toBeTypeOf("function");
    const widgets = await import("tinymoon/widgets");
    expect(widgets.createTable, "tinymoon/widgets exports createTable()").toBeTypeOf("function");
    const table = await import("tinymoon/table");
    expect(table.createTable, "tinymoon/table exports createTable()").toBeTypeOf("function");
  });
});
