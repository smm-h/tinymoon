import { el } from "./dom.js";

export async function load(id) {
  const mod = await import(`https://cdn.example.com/mod.js`);
  const data = await fetch(`http://api.example.com/item`);
  return { mod, data };
}
