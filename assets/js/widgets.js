// tinymoon — widgets barrel: the data-display story. The Phase 5A core (badges,
// stats, data table, virtual list) plus the Phase 5B completion (tree,
// filter bar + chips, load-more pagination, breadcrumbs, sparkline, chart
// container, live feed). Import from "tinymoon/widgets" (npm) or "./widgets.js"
// (standalone), or pull a single widget from its own subpath (e.g.
// "tinymoon/table"). These render DATA — they are optional, linked alongside
// widgets.css only by apps that show tables, stats, trees, and status chips.

export { badge } from "./badge.js";
export { createStat, renderStats } from "./stats.js";
export { createTable } from "./table.js";
export { createVirtualList, windowRange } from "./virtuallist.js";
export { createTree } from "./tree.js";
export { createFilterBar, createChips } from "./filterbar.js";
export { createLoadMore } from "./paginate.js";
export { createBreadcrumbs } from "./breadcrumbs.js";
export { createSparkline, sparklinePoints } from "./sparkline.js";
export { createChartContainer } from "./chart.js";
export { createFeed } from "./feed.js";
