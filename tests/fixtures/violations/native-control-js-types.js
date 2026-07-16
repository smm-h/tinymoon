import { el } from "./dom.js";

// Bare el("input")/createElement("input") with no literal type assignment is a
// KNOWN JS bypass (see checker doctrine header): the bare-creation lines below
// do NOT fire. Only the explicit type-literal assignments and the native
// <textarea> creations DO fire.
const a = el("input");
a.type = "text";
const b = el("input");
b.setAttribute("type", "email");
const c = document.createElement("input");
c.type = "number";
const d = el("textarea");
const e = document.createElement("textarea");
const r = el("input");
r.type = "range";
export { a, b, c, d, e, r };
