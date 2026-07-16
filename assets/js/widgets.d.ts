// tinymoon — TypeScript declarations for the widgets barrel: the data-display
// story (badges, stats, data table, virtual list).

// -- badge.js -----------------------------------------------------------------

/** The five sanctioned badge variants. */
export type BadgeVariant = "ok" | "warn" | "err" | "muted" | "neutral";

/**
 * Create a one-shot status chip: a bare, pre-styled `<span class="badge
 * badge-<variant>">`. Not a component instance — there is nothing to update or
 * destroy. `variant` defaults to `"neutral"`; an unknown variant throws.
 */
export function badge(text: unknown, variant?: BadgeVariant): HTMLElement;

// -- stats.js -----------------------------------------------------------------

/** Explicit trend direction. Never inferred: the widget cannot know whether a
 * metric is higher- or lower-is-better. */
export type StatTrend = "good" | "bad" | "neutral";

export interface StatOptions {
  /** The stat's label (required). */
  label: string;
  /** The initial value; coerced to a string. */
  value?: unknown;
  /** An optional dimmed unit suffix. */
  unit?: string;
  /** Optional explicit trend direction driving the delta indicator. */
  trend?: StatTrend;
}

export interface Stat {
  /** The `.stat` tile element. */
  el: HTMLElement;
  /** Replace the displayed value. */
  set(value: unknown): void;
  /** Set (or clear with `null`) the trend direction. */
  setTrend(trend: StatTrend | null): void;
  /** Detach the tile. */
  destroy(): void;
}

/** Create a single key/value stat tile. */
export function createStat(opts: StatOptions): Stat;

export interface StatsRow {
  /** The `.report-stats` grid element. */
  el: HTMLElement;
  /** The stat instances, in order. */
  stats: Stat[];
  /** Destroy every tile and detach the row. */
  destroy(): void;
}

/** Build a `.report-stats` row from an array of stat options. */
export function renderStats(items: StatOptions[]): StatsRow;

// -- table.js -----------------------------------------------------------------

/** The direction reported by a sort cycle. */
export type SortDirection = "none" | "ascending" | "descending";

export interface TableColumn<Row = Record<string, unknown>> {
  /** Property name, or a function extracting the cell value from the row. */
  key: string | ((row: Row) => unknown);
  /** The header label. */
  label: string;
  /** CSS text-align for the column's header and cells. */
  align?: string;
  /** Whether the header is sortable (cycles aria-sort and calls onSort). */
  sortable?: boolean;
  /** Render the cell. May return a string or a live DOM Node. */
  format?(value: unknown, row: Row): string | Node;
  /**
   * Optional per-cell class hook. The returned class(es) are APPENDED to the
   * cell's framework classes, never replacing them; a space-separated string
   * adds several. Return null/undefined/"" for no class.
   */
  cellClass?(value: unknown, row: Row): string | null | undefined;
}

export interface TableOptions<Row = Record<string, unknown>> {
  /** Column definitions (required). */
  columns: TableColumn<Row>[];
  /** Initial rows. */
  rows?: Row[];
  /** Cap the rendered body; extra rows collapse into a footer note. */
  maxRows?: number;
  /**
   * Called when a sortable header is activated. The table never sorts the rows
   * itself — the caller re-sorts its data and calls setRows(). `key` is the
   * column's `key`; `direction` is the new aria-sort state.
   */
  onSort?(key: string | ((row: Row) => unknown), direction: SortDirection): void;
  /** Optional table caption. */
  caption?: string;
  /**
   * Optional per-row class hook, applied at render and on setRows. The returned
   * class(es) are APPENDED to the row's framework classes, never replacing them;
   * a space-separated string adds several. Return null/undefined/"" for no class.
   */
  rowClass?(row: Row): string | null | undefined;
}

export interface Table<Row = Record<string, unknown>> {
  /** The `<table class="data tm-table">` element. */
  el: HTMLElement;
  /** Re-render the body wholesale from a new rows array (never mutated). */
  setRows(rows: Row[]): void;
  /** Remove listeners and detach the table. */
  destroy(): void;
}

/** Create a declarative, keyboard-navigable data table with caller-side sort. */
export function createTable<Row = Record<string, unknown>>(
  opts: TableOptions<Row>,
): Table<Row>;

// -- virtuallist.js -----------------------------------------------------------

export interface VirtualListOptions<Item = unknown> {
  /** Fixed pixel height of every row (variable heights are out of scope). */
  rowHeight: number;
  /** Initial items. */
  items?: Item[];
  /** Build a row's content node for `item` at `index`. */
  renderRow(item: Item, index: number): Node;
  /** Stable key for node reuse across renders; defaults to the item index. */
  getKey?(item: Item, index: number): unknown;
  /** Rows of overscan rendered beyond each viewport edge (default 3). */
  overscan?: number;
}

export interface VirtualList<Item = unknown> {
  /** The scrolling container element (give it a height via CSS). */
  el: HTMLElement;
  /** Replace the item set and redraw the window. */
  setItems(items: Item[]): void;
  /** Scroll so `index` is at the top of the viewport. */
  scrollToIndex(index: number): void;
  /** Remove listeners and detach the container. */
  destroy(): void;
}

/** Create a windowed list for long, flat, fixed-row-height data. */
export function createVirtualList<Item = unknown>(
  opts: VirtualListOptions<Item>,
): VirtualList<Item>;

/** Pure windowing math: the half-open [start, end) index range that should be
 * live for a scroll position, clamped and widened by `overscan`. */
export function windowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  itemCount: number,
  overscan?: number,
): { start: number; end: number };

// -- tree.js ------------------------------------------------------------------

export interface TreeNode {
  /** Stable key; expand/collapse address nodes by it. */
  id: string | number;
  /** The row's text label. */
  label: string;
  /** Nested child nodes (synchronous only — no lazy/async loading). */
  children?: TreeNode[];
  /** Seed the initial expanded state of a parent node. */
  open?: boolean;
}

export interface TreeOptions {
  /** The recursive node forest (required). */
  nodes: TreeNode[];
  /** Optional accessible name for the role="tree" container. */
  label?: string;
  /** Called when a treeitem is activated (Enter/Space or a row click). */
  onSelect?(node: TreeNode): void;
}

export interface Tree {
  /** The `<ul role="tree">` element. */
  el: HTMLElement;
  /** Rebuild the tree from a new node forest. */
  setNodes(nodes: TreeNode[]): void;
  /** Expand a node by id, or by a path (array of ids from the root). */
  expand(idOrPath: string | number | Array<string | number>): void;
  /** Collapse a node by id, or by a path (array of ids from the root). */
  collapse(idOrPath: string | number | Array<string | number>): void;
  /** Remove listeners and detach the tree. */
  destroy(): void;
}

/** Create a keyboard-navigable APG TreeView. */
export function createTree(opts: TreeOptions): Tree;

// -- filterbar.js -------------------------------------------------------------

/** A filter-bar slot: a DOM node or a component instance carrying an `.el`. */
export type FilterSlot = Node | { el: Node };

export interface FilterBarOptions {
  /** The controls to lay out (existing tabs/segmented/combobox/etc.). */
  slots?: FilterSlot[];
  /** Optional accessible name for the group. */
  label?: string;
}

export interface FilterBar {
  /** The `.tm-filterbar` strip element. */
  el: HTMLElement;
  /** Replace the laid-out controls. */
  setSlots(slots: FilterSlot[]): void;
  /** Detach the bar. */
  destroy(): void;
}

/** Create a layout-only filter strip (owns no filter state — that is app state). */
export function createFilterBar(opts?: FilterBarOptions): FilterBar;

/** A chip item: a plain string, a `{ label }`, or a `{ key, value }` pair. */
export type ChipItem = string | { label: string } | { key: string; value: string };

export interface ChipsOptions {
  /** Initial chip items. */
  items?: ChipItem[];
  /** Called when a chip's × is activated. The caller updates state + setItems. */
  onRemove?(item: ChipItem, index: number): void;
  /** Called when Clear-all is activated (shown only when >1 chip). */
  onClearAll?(): void;
}

export interface Chips {
  /** The `.tm-chips` strip element. */
  el: HTMLElement;
  /** Replace the chips from a new items array. */
  setItems(items: ChipItem[]): void;
  /** Detach the strip. */
  destroy(): void;
}

/** Create presentation-only removable chips over caller state. */
export function createChips(opts?: ChipsOptions): Chips;

// -- paginate.js --------------------------------------------------------------

export interface Page<Item = unknown> {
  /** This page's items. */
  items: Item[];
  /** The cursor for the next page, or null at the end. */
  nextCursor: unknown;
}

export interface LoadMoreOptions<Item = unknown> {
  /** Fetch a page for the given cursor (null on the first page). */
  fetchPage(cursor: unknown, pageSize?: number): Promise<Page<Item>>;
  /** Receives each page's items in order. */
  onItems(items: Item[]): void;
  /** Optional page-size hint forwarded to fetchPage. */
  pageSize?: number;
}

export interface LoadMore {
  /** The `.tm-loadmore` control element. */
  el: HTMLElement;
  /** Return to the first-page state (does not fetch). */
  reset(): void;
  /**
   * Programmatically trigger a page load — the same path the button click
   * takes (a no-op while loading or after the end). On a fresh or reset()
   * control this loads page one. Returns the underlying fetch promise.
   */
  load(): Promise<void>;
  /** Remove listeners and detach the control. */
  destroy(): void;
}

/** Create a transport-agnostic "Load more" control. */
export function createLoadMore<Item = unknown>(opts: LoadMoreOptions<Item>): LoadMore;

// -- breadcrumbs.js -----------------------------------------------------------

export interface Crumb {
  /** The crumb's label. */
  label: string;
  /** Optional href; present → rendered as a link. */
  href?: string;
}

export interface BreadcrumbsOptions {
  /** The trail (required). The last item is the current page. */
  items: Crumb[];
  /** Called when a crumb is activated (never preventDefaults). */
  onNavigate?(item: Crumb, index: number): void;
}

export interface Breadcrumbs {
  /** The `<nav aria-label="Breadcrumb">` element. */
  el: HTMLElement;
  /** Replace the trail. */
  setItems(items: Crumb[]): void;
  /** Detach the nav. */
  destroy(): void;
}

/** Create a router-agnostic breadcrumb trail with middle-ellipsis collapse. */
export function createBreadcrumbs(opts: BreadcrumbsOptions): Breadcrumbs;

// -- sparkline.js -------------------------------------------------------------

export interface SparklineOptions {
  /** The data series. */
  values?: number[];
  /** SVG viewBox width in user units (default 120). */
  width?: number;
  /** SVG viewBox height in user units (default 32). */
  height?: number;
  /** Add a filled area under the line. */
  area?: boolean;
  /** Accessible label; present → role="img", absent → aria-hidden. */
  label?: string;
}

export interface Sparkline {
  /** The inline `<svg>` element. */
  el: SVGElement;
  /** Repaint from a new series. */
  setData(values: number[]): void;
  /** Detach the SVG. */
  destroy(): void;
}

/** Create a tiny inline-SVG trend line (all colors from tokens via CSS). */
export function createSparkline(opts?: SparklineOptions): Sparkline;

/** Pure geometry: map a series to evenly-spaced {x, y} points in the viewBox. */
export function sparklinePoints(
  values: number[],
  width: number,
  height: number,
): Array<{ x: number; y: number }>;

// -- chart.js -----------------------------------------------------------------

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartContext {
  /** The element to draw into. */
  root: HTMLElement;
  /** Current content-box width. */
  width: number;
  /** Current content-box height. */
  height: number;
  /** Margin read from the --chart-margin-* tokens on the container. */
  margin: ChartMargin;
  /** Read a token resolved against the container. */
  cssVar(name: string): string;
}

export interface ChartContainerOptions {
  /** Full draw callback; runs on first paint and on redraw(). */
  render(ctx: ChartContext): void;
  /** Lighter resize-path callback; falls back to render when absent. */
  update?(ctx: ChartContext): void;
  /** Accessible name (required). */
  label: string;
}

export interface ChartContainer {
  /** The `.tm-chart` container element. */
  el: HTMLElement;
  /** Force a full render immediately. */
  redraw(): void;
  /** Disconnect the observer and detach the container. */
  destroy(): void;
}

/** Create a renderer-agnostic chart lifecycle (ships no charting). */
export function createChartContainer(opts: ChartContainerOptions): ChartContainer;

// -- feed.js ------------------------------------------------------------------

export interface FeedOptions<Item = unknown> {
  /** Build a row node for an item (set data-level to color by severity). */
  renderItem(item: Item): Node;
  /** Buffer cap; overflow prunes from the far end (default 200). */
  cap?: number;
  /** Called with pruned items when the cap overflows. */
  onPrune?(items: Item[]): void;
}

export interface Feed<Item = unknown> {
  /** The scrolling `.tm-feed` container. */
  el: HTMLElement;
  /** Append an item to the bottom (autoscrolls when stuck to bottom). */
  append(item: Item): void;
  /** Prepend an item to the top. */
  prepend(item: Item): void;
  /** Replace the buffer wholesale (keeps the last `cap` items). */
  setItems(items: Item[]): void;
  /** Remove listeners and detach the feed. */
  destroy(): void;
}

/** Create a presentation-only live feed / log viewer (no transport coupling). */
export function createFeed<Item = unknown>(opts: FeedOptions<Item>): Feed<Item>;
