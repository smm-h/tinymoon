import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(
  resolve(import.meta.dirname, "../../../assets/css/primitives.css"),
  "utf8",
);
const TOKENS = readFileSync(
  resolve(import.meta.dirname, "../../../assets/css/tokens.css"),
  "utf8",
);

// The destructive .btn.danger variant. Pins that it exists, is wired to the red
// ladder tokens (never a raw color), and that the ladder tokens are defined.
describe(".btn.danger", () => {
  it("defines .btn.danger and .btn.danger:hover", () => {
    expect(CSS).toContain(".btn.danger {");
    expect(CSS).toContain(".btn.danger:hover {");
  });

  it("uses the red-ladder tokens, not raw colors", () => {
    expect(CSS).toContain("var(--red-solid)");
    expect(CSS).toContain("var(--red-solid-hi)");
    expect(CSS).toContain("var(--on-red)");
    expect(CSS).toContain("var(--red-glow)");
  });

  it("tokens.css defines the red ladder", () => {
    for (const tok of ["--red-solid:", "--red-solid-hi:", "--on-red:", "--red-glow:"]) {
      expect(TOKENS).toContain(tok);
    }
  });
});
