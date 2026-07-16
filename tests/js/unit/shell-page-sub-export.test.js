import { describe, it, expect } from "vitest";
import * as core from "../../../assets/js/index.js";
import * as shell from "../../../assets/js/shell.js";

// The shell's standalone page-subtitle setter is part of the public core
// barrel, alongside its sibling `announce`. Plain-object views (that do not go
// through createView) rely on it to set #tm-page-sub without touching the DOM
// node directly. This locks the barrel re-export so it cannot silently regress.
describe("core barrel: setPageSub", () => {
  it("is exported as a function", () => {
    expect(typeof core.setPageSub).toBe("function");
  });

  it("is the same reference as shell.js's setPageSub", () => {
    expect(core.setPageSub).toBe(shell.setPageSub);
  });

  it("sits alongside its sibling announce", () => {
    expect(typeof core.announce).toBe("function");
  });
});
