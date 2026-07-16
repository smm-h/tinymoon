import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

// Lint guard: no framework or gallery code may reach the shell's private
// topbar/content nodes (#tm-page-sub, #tm-content) DIRECTLY. Views set the
// page subtitle through the createView ctx.setSub(text) / setPageSub() seam and
// let the router own the content region. This keeps the shell's internal DOM
// encapsulated: the ids can change without breaking consumers.
//
// Exclusions:
//   - shell.js OWNS these nodes (creates them, wires the seam).
//   - view.js is the ctx plumbing (its ctx.setSub delegates to setPageSub);
//     it references the ids only in comments, never as DOM access.
//   - lazy.js resolves #tm-content as the DEFAULT IntersectionObserver root so
//     that consumers never have to reach for the shell scroller themselves —
//     it is sanctioned framework infrastructure doing the encapsulation, not a
//     consumer breaching it. The resolution is internal and overridable.
//
// The check targets actual DOM-access calls, not doc/comment mentions, so a
// wiki string like `#tm-content` is fine.

const REPO = resolve(import.meta.dirname, "../../..");
const ASSETS_JS = join(REPO, "assets", "js");
const EXCLUDE = new Set(["shell.js", "view.js", "lazy.js"]);

// getElementById("tm-page-sub" | "tm-content"), or a querySelector[All] whose
// selector string contains "#tm-page-sub" / "#tm-content".
const ACCESS_RE =
  /getElementById\(\s*["'](tm-page-sub|tm-content)["']|querySelector(?:All)?\(\s*["'][^"']*#(tm-page-sub|tm-content)/;

function sources() {
  const files = [];
  for (const f of readdirSync(ASSETS_JS)) {
    if (f.endsWith(".js") && !EXCLUDE.has(f)) {
      files.push([`assets/js/${f}`, readFileSync(join(ASSETS_JS, f), "utf8")]);
    }
  }
  files.push(["gallery/gallery.js", readFileSync(join(REPO, "gallery", "gallery.js"), "utf8")]);
  return files;
}

describe("no direct shell-node access", () => {
  it("no module (outside shell.js/view.js) reads #tm-page-sub or #tm-content directly", () => {
    const offenders = sources()
      .filter(([, src]) => ACCESS_RE.test(src))
      .map(([name]) => name);
    expect(offenders, `direct shell-node access found in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("shell.js DOES own those nodes (guards against the check going stale)", () => {
    const shell = readFileSync(join(ASSETS_JS, "shell.js"), "utf8");
    // shell.js assigns the ids — proves the nodes still exist to be encapsulated.
    expect(shell).toContain('"tm-page-sub"');
    expect(shell).toContain('"tm-content"');
  });
});
