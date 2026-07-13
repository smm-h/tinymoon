import { el } from "./dom.js";

const btn = el("button", "save");
btn.title = "Save the file";
btn.setAttribute("title", "Save the file");
document.title = "My page title";
mydocument.title = "An identifier merely ending in 'document' is not exempt";
export { btn };
