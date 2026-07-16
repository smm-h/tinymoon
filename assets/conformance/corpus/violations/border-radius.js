import { el } from "./dom.js";

const card = el("div", "card");
card.style.borderRadius = "6px";
card.style.setProperty("border-radius", "50%");
const sharp = el("div");
sharp.style.borderRadius = "0";
export { card, sharp };
