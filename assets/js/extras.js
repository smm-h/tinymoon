// tinymoon — extras barrel: app-level modules (wiki, networking, settings)
// that sit above the core primitives. Import from "tinymoon/extras" (npm)
// or "./extras.js" (standalone).

export { api, post } from "./net.js";
export { createSettings } from "./settings.js";
export { renderDocMd, createWikiView } from "./wiki.js";
