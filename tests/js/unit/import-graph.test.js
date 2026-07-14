import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Static import-graph cycle detection. Parses every ES module in assets/js/
// and asserts the dependency graph is a DAG (directed acyclic graph). This is
// a permanent guard against circular imports — even cycles that happen to
// work today via function-declaration hoisting are architectural hazards that
// break the moment any export is refactored to const/arrow.

const ASSETS_DIR = resolve(import.meta.dirname, "../../../assets/js");

// extractImports(source) → array of relative specifiers (e.g. "./dom.js").
function extractImports(source) {
  const re = /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  const imports = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

// buildGraph() → Map<filename, Set<filename>> of local-module edges.
function buildGraph() {
  const files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));
  const graph = new Map();
  for (const file of files) {
    const source = readFileSync(join(ASSETS_DIR, file), "utf8");
    const deps = new Set();
    for (const spec of extractImports(source)) {
      // Only local relative imports form cycles; skip bare specifiers.
      if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
      // Normalize "./foo.js" → "foo.js"
      const dep = spec.replace(/^\.\//, "");
      if (files.includes(dep)) deps.add(dep);
    }
    graph.set(file, deps);
  }
  return graph;
}

// findCycle(graph) → null | [a, b, ..., a] cycle path.
function findCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const node of graph.keys()) color.set(node, WHITE);

  function dfs(node, path) {
    color.set(node, GRAY);
    path.push(node);
    for (const dep of graph.get(node) || []) {
      if (color.get(dep) === GRAY) {
        // Found a back edge — extract the cycle.
        const start = path.indexOf(dep);
        return path.slice(start).concat(dep);
      }
      if (color.get(dep) === WHITE) {
        const cycle = dfs(dep, path);
        if (cycle) return cycle;
      }
    }
    path.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      const cycle = dfs(node, []);
      if (cycle) return cycle;
    }
  }
  return null;
}

describe("import graph", () => {
  it("has no circular dependencies among assets/js/ modules", () => {
    const graph = buildGraph();
    const cycle = findCycle(graph);
    if (cycle) {
      const arrow = " -> ";
      expect.unreachable(
        "Circular import detected: " + cycle.join(arrow),
      );
    }
  });
});
