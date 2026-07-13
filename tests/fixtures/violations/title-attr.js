import { el } from "./dom.js";

const btn = el("button", "save");
btn.title = "Save the file";
btn.setAttribute("title", "Save the file");
document.title = "My page title";
export { btn };
