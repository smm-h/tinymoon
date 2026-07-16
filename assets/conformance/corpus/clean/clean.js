// Comment mentioning https://example.com/in-comment is fine.
import { el } from "./dom.js";
import { cssVar } from "../settings.js";

export async function run(url) {
  const data = await fetch(url).then((r) => r.json());
  const input = el("input");
  input.type = "text";
  const box = el("div", "box");
  box.style.color = cssVar("--accent");
  box.style.background = "var(--surface)";
  box.style.borderRadius = "0";
  document.title = "Setting the page title is fine";
  const label = box.title;
  return { data, label };
}

// Private fields that look like hex colors must NOT fire raw-color.
class ColorStore {
  #face;
  #deed;
  #fab;
  constructor() {
    this.#face = "stored";
    this.#deed = "done";
    this.#fab = "good";
  }
}

// location.hash assignments must NOT fire raw-color.
function navigate() {
  location.hash = "#abc123";
  window.location.hash = "#def456";
}

// Non-DOM .title assignments must NOT fire title-attr.
function setupRoutes(route, config, options) {
  route.title = "Home";
  config.title = "App settings";
  options.title = "Preferences";
  window.title = "My window";
}
