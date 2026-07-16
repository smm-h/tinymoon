// tinymoon — widgets barrel: the data-display story (badges, stats, data table,
// virtual list). Import from "tinymoon/widgets" (npm) or "./widgets.js"
// (standalone), or pull a single widget from its own subpath (e.g.
// "tinymoon/table"). These render DATA — they are optional, linked alongside
// widgets.css only by apps that show tables, stats, and status chips.

export { badge } from "./badge.js";
export { createStat, renderStats } from "./stats.js";
export { createTable } from "./table.js";
export { createVirtualList, windowRange } from "./virtuallist.js";
