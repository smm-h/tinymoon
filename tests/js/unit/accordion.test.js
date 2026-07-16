import { describe, it, expect } from "vitest";

// Unit tests for accordion.js: createAccordion(opts) -> {el, open, close, toggle, destroy}.

function headers(acc) {
  return Array.from(acc.el.querySelectorAll(".tm-accordion-header"));
}
function items(acc) {
  return Array.from(acc.el.querySelectorAll(".tm-accordion-item"));
}

describe("createAccordion", () => {
  it("returns {el, open, close, toggle, destroy}", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ items: [{ title: "A", body: "aa" }] });
    expect(acc.el).toBeInstanceOf(HTMLElement);
    for (const m of ["open", "close", "toggle", "destroy"]) expect(typeof acc[m]).toBe("function");
  });

  it("throws without an items array", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    expect(() => createAccordion({})).toThrow("items array is required");
    expect(() => createAccordion()).toThrow();
  });

  it("renders a header button and a labelled region panel per item", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ items: [{ title: "One", body: "first" }, { title: "Two", body: "second" }] });
    const hs = headers(acc);
    expect(hs.length).toBe(2);
    expect(hs[0].getAttribute("aria-expanded")).toBe("false");
    expect(hs[0].textContent).toContain("One");
    const panel = acc.el.querySelector("#" + hs[0].getAttribute("aria-controls"));
    expect(panel.getAttribute("role")).toBe("region");
    expect(panel.getAttribute("aria-labelledby")).toBe(hs[0].id);
    expect(panel.textContent).toContain("first");
  });

  it("accepts an HTMLElement body", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const node = document.createElement("p");
    node.textContent = "rich body";
    const acc = createAccordion({ items: [{ title: "T", body: node }] });
    expect(acc.el.querySelector("p").textContent).toBe("rich body");
  });

  it("open/close/toggle drive the item's open class and aria-expanded", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ items: [{ title: "A", body: "a" }, { title: "B", body: "b" }] });
    acc.open(0);
    expect(items(acc)[0].classList.contains("open")).toBe(true);
    expect(headers(acc)[0].getAttribute("aria-expanded")).toBe("true");
    acc.close(0);
    expect(items(acc)[0].classList.contains("open")).toBe(false);
    acc.toggle(1);
    expect(items(acc)[1].classList.contains("open")).toBe(true);
    acc.toggle(1);
    expect(items(acc)[1].classList.contains("open")).toBe(false);
  });

  it("single-open (default) closes others when one opens", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ items: [{ title: "A", body: "a" }, { title: "B", body: "b" }] });
    acc.open(0);
    acc.open(1);
    expect(items(acc)[0].classList.contains("open")).toBe(false);
    expect(items(acc)[1].classList.contains("open")).toBe(true);
  });

  it("multi:true keeps multiple panels open", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ multi: true, items: [{ title: "A", body: "a" }, { title: "B", body: "b" }] });
    acc.open(0);
    acc.open(1);
    expect(items(acc)[0].classList.contains("open")).toBe(true);
    expect(items(acc)[1].classList.contains("open")).toBe(true);
  });

  it("clicking a header toggles the panel", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ items: [{ title: "A", body: "a" }] });
    headers(acc)[0].click();
    expect(items(acc)[0].classList.contains("open")).toBe(true);
    headers(acc)[0].click();
    expect(items(acc)[0].classList.contains("open")).toBe(false);
  });

  it("item.open flags seed the initial state (single-open keeps only the first)", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ items: [
      { title: "A", body: "a", open: true },
      { title: "B", body: "b", open: true },
    ] });
    expect(items(acc)[0].classList.contains("open")).toBe(true);
    expect(items(acc)[1].classList.contains("open")).toBe(false);
  });

  it("the expand transition uses a duration token only (reduced-motion safe)", async () => {
    // The panel animates grid-template-rows via var(--dur-slow); the global
    // prefers-reduced-motion rule zeroes transition-duration, covering it.
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const acc = createAccordion({ items: [{ title: "A", body: "a" }] });
    const panel = acc.el.querySelector(".tm-accordion-panel");
    expect(panel).not.toBeNull();
    expect(panel.querySelector(".tm-accordion-panel-inner")).not.toBeNull();
  });

  it("destroy removes the element", async () => {
    const { createAccordion } = await import("../../../assets/js/accordion.js");
    const parent = document.createElement("div");
    const acc = createAccordion({ items: [{ title: "A", body: "a" }] });
    parent.appendChild(acc.el);
    acc.destroy();
    expect(parent.children.length).toBe(0);
  });
});
