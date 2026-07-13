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
