import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as core from "../../../assets/js/index.js";
import * as extras from "../../../assets/js/extras.js";
import * as state from "../../../assets/js/state.js";

// Type-declaration parity guard.
//
// Every runtime export of a barrel must have a matching declaration in its
// sibling .d.ts. This makes "shipped an export without types" a hard test
// failure forever -- complementing the tsc fixture (tests/types), which proves
// the declarations are *accurate*; this proves they are *complete*.

const ASSETS = resolve(import.meta.dirname, "../../../assets/js");

// declaredNames(source) -> Set of value-level names declared with an `export`
// modifier (functions, consts, classes, lets, vars). Interfaces and type
// aliases are intentionally excluded: they have no runtime counterpart.
function declaredNames(source) {
  const re = /export\s+(?:declare\s+)?(?:function|const|let|var|class)\s+([$\w]+)/g;
  const names = new Set();
  let m;
  while ((m = re.exec(source)) !== null) names.add(m[1]);
  return names;
}

function readDecl(name) {
  return declaredNames(readFileSync(resolve(ASSETS, name), "utf8"));
}

describe("type declaration parity", () => {
  it("every runtime export of the core barrel is declared in index.d.ts", () => {
    const declared = readDecl("index.d.ts");
    const missing = Object.keys(core).filter((n) => !declared.has(n));
    expect(missing, `core exports missing from index.d.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("every runtime export of the extras barrel is declared in extras.d.ts", () => {
    const declared = readDecl("extras.d.ts");
    const missing = Object.keys(extras).filter((n) => !declared.has(n));
    expect(missing, `extras exports missing from extras.d.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("every runtime export of the state barrel is declared in state.d.ts", () => {
    const declared = readDecl("state.d.ts");
    const missing = Object.keys(state).filter((n) => !declared.has(n));
    expect(missing, `state exports missing from state.d.ts: ${missing.join(", ")}`).toEqual([]);
  });
});
