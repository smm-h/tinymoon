import { describe, it, expect } from "vitest";

// Unit tests for createEmbed: the isolation boundary primitive. Two explicit
// modes (iframe, shadow), the static tm-embed marker the checker/auditor key
// on, required a11y label, the test-only open-shadow seam, and destroy().

async function load() {
  return (await import("../../../assets/js/embed.js")).createEmbed;
}

describe("createEmbed — contract", () => {
  it("throws without a label (a11y is mandatory)", async () => {
    const createEmbed = await load();
    expect(() => createEmbed({ mode: "iframe" })).toThrow("label is required");
  });

  it("throws when mode is absent (no default — caller must choose)", async () => {
    const createEmbed = await load();
    expect(() => createEmbed({ label: "X" })).toThrow(/mode must be/);
  });

  it("throws on an unknown mode", async () => {
    const createEmbed = await load();
    expect(() => createEmbed({ label: "X", mode: "popup" })).toThrow(/mode must be/);
  });

  it("carries the static marker: data-tm-embed attribute + tm-embed class", async () => {
    const createEmbed = await load();
    const e = createEmbed({ mode: "shadow", label: "X" });
    expect(e.el.getAttribute("data-tm-embed")).not.toBeNull();
    expect(e.el.classList.contains("tm-embed")).toBe(true);
    expect(e.el.getAttribute("role")).toBe("group");
    expect(e.el.getAttribute("aria-label")).toBe("X");
  });

  it("renders a label strip by default, suppressible with showLabel:false", async () => {
    const createEmbed = await load();
    const withLabel = createEmbed({ mode: "shadow", label: "Region A" });
    expect(withLabel.el.querySelector(".tm-embed-label").textContent).toBe("Region A");
    const without = createEmbed({ mode: "shadow", label: "Region B", showLabel: false });
    expect(without.el.querySelector(".tm-embed-label")).toBeNull();
  });
});

describe("createEmbed — iframe mode", () => {
  // NOTE: happy-dom eagerly "navigates" an iframe whose src is a fetchable
  // URL. The unit tests only care that the attribute is written, so they use
  // about:blank (non-fetching); a real same-origin src is exercised in e2e.
  it("renders a sandboxed iframe with the default sandbox baseline", async () => {
    const createEmbed = await load();
    const e = createEmbed({ mode: "iframe", label: "Map", src: "about:blank" });
    expect(e.mode).toBe("iframe");
    const frame = e.el.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame.getAttribute("src")).toBe("about:blank");
    const sandbox = frame.getAttribute("sandbox");
    expect(sandbox).toContain("allow-scripts");
    // The default sandbox does NOT grant same-origin (opaque origin isolation).
    expect(sandbox).not.toContain("allow-same-origin");
    // Accessible name via aria-label, never a banned title= attribute.
    expect(frame.getAttribute("aria-label")).toBe("Map");
    expect(frame.hasAttribute("title")).toBe(false);
  });

  it("lets the caller replace the sandbox token list explicitly", async () => {
    const createEmbed = await load();
    const e = createEmbed({
      mode: "iframe",
      label: "Map",
      sandbox: ["allow-scripts", "allow-same-origin"],
    });
    expect(e.el.querySelector("iframe").getAttribute("sandbox"))
      .toBe("allow-scripts allow-same-origin");
  });

  it("[] sandbox produces a fully-locked frame", async () => {
    const createEmbed = await load();
    const e = createEmbed({ mode: "iframe", label: "Locked", sandbox: [] });
    expect(e.el.querySelector("iframe").getAttribute("sandbox")).toBe("");
  });

  it("setSrc updates the frame; destroy clears src and detaches", async () => {
    const createEmbed = await load();
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const e = createEmbed({ mode: "iframe", label: "Map" });
    parent.appendChild(e.el);
    e.setSrc("about:blank");
    expect(e.el.querySelector("iframe").getAttribute("src")).toBe("about:blank");
    e.destroy();
    expect(e.el.querySelector("iframe").hasAttribute("src")).toBe(false);
    expect(parent.contains(e.el)).toBe(false);
    parent.remove();
  });
});

describe("createEmbed — shadow mode", () => {
  it("hosts a CLOSED shadow root in production (no shadowRoot handle)", async () => {
    const createEmbed = await load();
    const e = createEmbed({ mode: "shadow", label: "Widget" });
    expect(e.mode).toBe("shadow");
    // Closed root: neither the instance nor the host element exposes it.
    expect(e.shadowRoot).toBeUndefined();
    const host = e.el.querySelector(".tm-embed-body");
    expect(host.shadowRoot).toBeNull();
  });

  it("openForTest exposes an OPEN shadow root (test-only seam)", async () => {
    const createEmbed = await load();
    const e = createEmbed({
      mode: "shadow",
      label: "Widget",
      openForTest: true,
      content: "<p class='foreign'>hi</p>",
    });
    expect(e.shadowRoot).toBeDefined();
    expect(e.shadowRoot.querySelector(".foreign").textContent).toBe("hi");
  });

  it("setContent replaces foreign content inside the shadow root", async () => {
    const createEmbed = await load();
    const e = createEmbed({ mode: "shadow", label: "Widget", openForTest: true });
    e.setContent("<style>span{color:hotpink}</style><span>a</span>");
    expect(e.shadowRoot.querySelector("span").textContent).toBe("a");
    e.setContent(Object.assign(document.createElement("b"), { textContent: "b" }));
    expect(e.shadowRoot.querySelector("b").textContent).toBe("b");
  });

  it("foreign content stays inside the shadow boundary (not in light DOM)", async () => {
    const createEmbed = await load();
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const e = createEmbed({
      mode: "shadow",
      label: "Widget",
      openForTest: true,
      content: "<div class='foreign-node'>x</div>",
    });
    parent.appendChild(e.el);
    // The foreign node is reachable through the shadow root...
    expect(e.shadowRoot.querySelector(".foreign-node")).not.toBeNull();
    // ...but NOT through a light-DOM query that stops at the boundary.
    expect(parent.querySelector(".foreign-node")).toBeNull();
    e.destroy();
    parent.remove();
  });

  it("destroy empties the shadow root and detaches the host", async () => {
    const createEmbed = await load();
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const e = createEmbed({ mode: "shadow", label: "W", openForTest: true, content: "<i>x</i>" });
    parent.appendChild(e.el);
    e.destroy();
    expect(e.shadowRoot.childNodes.length).toBe(0);
    expect(parent.contains(e.el)).toBe(false);
    parent.remove();
  });
});
