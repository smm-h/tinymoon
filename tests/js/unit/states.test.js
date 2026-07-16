import { describe, it, expect, vi } from "vitest";
import { loadingBlock, emptyBlock, errorBlock, renderAsync } from "../../../assets/js/states.js";

describe("states — block factories", () => {
  it("loadingBlock is a .empty block with a spinner, aria-busy, and a label", () => {
    const box = loadingBlock();
    expect(box).toBeInstanceOf(HTMLElement);
    expect(box.classList.contains("empty")).toBe(true);
    expect(box.getAttribute("aria-busy")).toBe("true");
    expect(box.querySelector("svg.spin")).not.toBeNull();
    expect(box.querySelector(".empty-title").textContent).toBe("Loading…");
  });

  it("loadingBlock honors a custom label", () => {
    expect(loadingBlock({ label: "Fetching" }).querySelector(".empty-title").textContent).toBe("Fetching");
  });

  it("emptyBlock requires a title", () => {
    expect(() => emptyBlock()).toThrow(/title is required/);
    expect(() => emptyBlock({})).toThrow(/title is required/);
  });

  it("emptyBlock renders title and optional sub", () => {
    const box = emptyBlock({ title: "Nothing", sub: "try again" });
    expect(box.querySelector(".empty-title").textContent).toBe("Nothing");
    expect(box.querySelector(".empty-sub").textContent).toBe("try again");
  });

  it("emptyBlock omits the sub line when not given", () => {
    expect(emptyBlock({ title: "x" }).querySelector(".empty-sub")).toBeNull();
  });

  it("errorBlock requires a message and is role=alert", () => {
    expect(() => errorBlock()).toThrow(/message is required/);
    const box = errorBlock({ message: "boom" });
    expect(box.getAttribute("role")).toBe("alert");
    expect(box.querySelector(".empty-title").textContent).toBe("boom");
  });

  it("errorBlock wires an onRetry button", () => {
    const onRetry = vi.fn();
    const box = errorBlock({ message: "boom", onRetry });
    const btn = box.querySelector("button");
    expect(btn.textContent).toBe("Retry");
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("errorBlock has no button without onRetry", () => {
    expect(errorBlock({ message: "x" }).querySelector("button")).toBeNull();
  });
});

describe("renderAsync — state swaps", () => {
  it("shows loading immediately, then the data Element on resolve", async () => {
    const container = document.createElement("div");
    const node = document.createElement("p");
    node.textContent = "data";
    const p = renderAsync(container, Promise.resolve({ n: 1 }), { onData: () => node });
    // Synchronously, the loading block is present.
    expect(container.querySelector("[aria-busy]")).not.toBeNull();
    await p;
    expect(container.firstChild).toBe(node);
  });

  it("shows the empty block when onData returns a falsy value", async () => {
    const container = document.createElement("div");
    await renderAsync(container, Promise.resolve([]), {
      onData: (rows) => rows.length > 0,
      empty: { title: "No rows" },
    });
    expect(container.querySelector(".empty-title").textContent).toBe("No rows");
  });

  it("leaves the container untouched when onData returns a truthy non-node", async () => {
    const container = document.createElement("div");
    await renderAsync(container, Promise.resolve("ok"), {
      onData: (data) => { container.replaceChildren(document.createTextNode(data)); return true; },
    });
    expect(container.textContent).toBe("ok");
  });

  it("shows the error block on rejection, using the error message", async () => {
    const container = document.createElement("div");
    await renderAsync(container, Promise.reject(new Error("nope")), {});
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector(".empty-title").textContent).toBe("nope");
  });

  it("merges error opts (onRetry) into the error block", async () => {
    const container = document.createElement("div");
    const onRetry = vi.fn();
    await renderAsync(container, Promise.reject(new Error("x")), { error: { onRetry } });
    container.querySelector("button").click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("resolves to the data on success", async () => {
    const container = document.createElement("div");
    const out = await renderAsync(container, Promise.resolve(42), { onData: () => true });
    expect(out).toBe(42);
  });
});
