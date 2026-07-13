import { el } from "./dom.js";

const picker = el("select", "my-picker");
const dlg = document.createElement("dialog");
const box = document.createElement("input");
box.type = "checkbox";
const r = el("input");
r.setAttribute("type", "radio");
export { picker, dlg, box, r };
