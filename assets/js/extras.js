// tinymoon — extras barrel: app-level modules (wiki, networking, realtime,
// formatting, settings) that sit above the core primitives. Import from
// "tinymoon/extras" (npm) or "./extras.js" (standalone).

export { api, post, ApiError, setAuthHeader } from "./net.js";
export { sse, socket } from "./realtime.js";
export { fmtTime, relativeTime, liveRelativeTime } from "./format.js";
export { createSettings } from "./settings.js";
export { renderDocMd, createWikiView } from "./wiki.js";
