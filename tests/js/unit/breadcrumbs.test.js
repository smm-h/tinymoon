import { describe, it, expect } from "vitest";

// Unit tests for breadcrumbs.js: createBreadcrumbs -> {el, setItems, destroy}.
// Pins the nav/ol semantics, aria-current on the current page, link vs. button
// vs. static rendering, onNavigate, and the middle-ellipsis collapse.

function trail(n) {
  return Array.from({ length: n }, (_, i) => ({ label: "L" + i, href: "#/l" + i }));
}

describe("createBreadcrumbs", () => {
  it("throws without an items array", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    expect(() => createBreadcrumbs({})).toThrow(/items array is required/);
  });

  it("renders nav[aria-label] > ol with one li per item", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const b = createBreadcrumbs({ items: [{ label: "Home", href: "#/" }, { label: "Now" }] });
    expect(b.el.tagName).toBe("NAV");
    expect(b.el.getAttribute("aria-label")).toBe("Breadcrumb");
    expect(b.el.querySelectorAll("ol > li").length).toBe(2);
  });

  it("marks the last item as the current page (aria-current) and never a link", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const b = createBreadcrumbs({ items: [{ label: "Home", href: "#/" }, { label: "Current", href: "#/c" }] });
    const last = b.el.querySelector("li:last-child .tm-crumb-current");
    expect(last).not.toBeNull();
    expect(last.getAttribute("aria-current")).toBe("page");
    expect(last.tagName).toBe("SPAN");
  });

  it("renders an <a> for href items and a <button> for href-less navigable items", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const b = createBreadcrumbs({
      items: [{ label: "Link", href: "#/x" }, { label: "Btn" }, { label: "End" }],
      onNavigate: () => {},
    });
    const first = b.el.querySelector("li:nth-child(1) .tm-crumb-link");
    const second = b.el.querySelector("li:nth-child(2) .tm-crumb-link");
    expect(first.tagName).toBe("A");
    expect(first.getAttribute("href")).toBe("#/x");
    expect(second.tagName).toBe("BUTTON");
  });

  it("fires onNavigate(item, index) on a crumb activation", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const nav = [];
    const b = createBreadcrumbs({
      items: [{ label: "Home", href: "#/" }, { label: "Reports", href: "#/r" }, { label: "Now" }],
      onNavigate: (item, i) => nav.push([item.label, i]),
    });
    b.el.querySelector("li:nth-child(1) .tm-crumb-link").click();
    expect(nav).toEqual([["Home", 0]]);
  });

  it("collapses the middle into an expandable ellipsis beyond ~6 items", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const b = createBreadcrumbs({ items: trail(8) });
    // first + ellipsis + last 4 = 6 list items.
    const lis = b.el.querySelectorAll("ol > li");
    expect(lis.length).toBe(6);
    const ellipsis = b.el.querySelector(".tm-crumb-more");
    expect(ellipsis).not.toBeNull();
    expect(ellipsis.tagName).toBe("BUTTON");
    // Expanding shows the full trail.
    ellipsis.click();
    expect(b.el.querySelectorAll("ol > li").length).toBe(8);
    expect(b.el.querySelector(".tm-crumb-more")).toBeNull();
  });

  it("does not collapse at or below the threshold", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const b = createBreadcrumbs({ items: trail(6) });
    expect(b.el.querySelectorAll("ol > li").length).toBe(6);
    expect(b.el.querySelector(".tm-crumb-more")).toBeNull();
  });

  it("setItems replaces the trail and resets the expanded state", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const b = createBreadcrumbs({ items: trail(8) });
    b.el.querySelector(".tm-crumb-more").click(); // expand
    b.setItems(trail(8)); // fresh set -> collapsed again
    expect(b.el.querySelector(".tm-crumb-more")).not.toBeNull();
    expect(b.el.querySelectorAll("ol > li").length).toBe(6);
  });

  it("destroy detaches the nav", async () => {
    const { createBreadcrumbs } = await import("../../../assets/js/breadcrumbs.js");
    const parent = document.createElement("div");
    const b = createBreadcrumbs({ items: trail(3) });
    parent.appendChild(b.el);
    b.destroy();
    expect(parent.children.length).toBe(0);
  });
});
