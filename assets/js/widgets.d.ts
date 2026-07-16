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
