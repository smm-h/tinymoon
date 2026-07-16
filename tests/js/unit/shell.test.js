import { describe, it, expect } from "vitest";
import { mountShell } from "../../../assets/js/shell.js";

// mountShell route-view contract. A route `view` must be a () => viewObj
// factory, an HTML string, or an Element. Passing a BUILT view object (a plain
// object with .build) is the classic footgun — it used to render nothing
// silently. It is now a hard error that names the fix.

function host() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

describe("mountShell route view guard", () => {
  it("hard-errors when a route view is a non-function object (a built view, not a factory)", () => {
    const builtView = { root: null, built: false, build() {}, refresh() {} };
    expect(() =>
      mountShell({
        root: host(),
        brand: { name: "Test", logoHTML: "<span>T</span>" },
        routes: { home: { title: "Home", icon: "info", view: builtView } },
        defaultRoute: "home",
      }),
    ).toThrow(/wrap it: \(\) => view/);
  });

  it("accepts a factory, an HTML string, and an Element as a route view", () => {
    const tpl = document.createElement("template");
    tpl.innerHTML = "<p>element view</p>";
    expect(() =>
      mountShell({
        root: host(),
        brand: { name: "Test", logoHTML: "<span>T</span>" },
        routes: {
          a: { title: "A", icon: "info", view: () => ({ root: null, built: false, build() {}, refresh() {} }) },
          b: { title: "B", icon: "info", view: "<p>string view</p>" },
          c: { title: "C", icon: "info", view: tpl },
        },
        defaultRoute: "a",
      }),
    ).not.toThrow();
  });
});
