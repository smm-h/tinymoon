import { widget } from "https://cdn.example.com/widget.js";
import "//cdn.example.com/polyfill.js";

export async function load() {
  const mod = await import("https://cdn.example.com/lazy.js");
  const data = await fetch("http://api.example.com/data").then((r) => r.json());
  return { mod, data, widget };
}
