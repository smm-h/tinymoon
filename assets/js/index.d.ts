// tinymoon — TypeScript declarations for the core barrel.

// -- dom.js -------------------------------------------------------------------

/** querySelector shorthand. */
export function $(sel: string, root?: Element | Document): Element | null;
/** querySelectorAll shorthand, returns a real array. */
export function $$(sel: string, root?: Element | Document): Element[];
/** Create an element with optional class and text content. */
export function el(tag: string, cls?: string | null, text?: string): HTMLElement;

// -- icons.js -----------------------------------------------------------------

/** Map of icon name to inline SVG markup. */
export const ICONS: Record<string, string>;
/** Return the SVG markup for the named icon. */
export function icon(name: string): string;
/** Register additional icons, merging into ICONS. */
export function registerIcons(icons: Record<string, string>): void;

// -- kernel.js ----------------------------------------------------------------

/** Read a CSS custom property from :root. */
export function cssVar(name: string): string;
/** Create or return a singleton root element with the given id. */
export function ensureRoot(id: string, attrs?: Record<string, string>): HTMLElement;
/** Position `panel` below `anchor`, flipping above if clipped. */
export function placeBelow(
  anchor: HTMLElement,
  panel: HTMLElement,
  opts?: { gap?: number },
): void;
/** Register an element as copyable (Ctrl+C interception). */
export function registerCopyable(element: HTMLElement, getData: () => string): void;
/** Remove a copyable registration. */
export function unregisterCopyable(element: HTMLElement): void;
/** Get the copy data for a registered element, or null. */
export function getCopyData(element: HTMLElement): string | null;

// -- controls.js --------------------------------------------------------------

export interface SwitchOpts {
  label: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
}
export interface SwitchInstance {
  el: HTMLElement;
  set(value: boolean): void;
  destroy(): void;
}
export function createSwitch(opts: SwitchOpts): SwitchInstance;

export interface CheckboxOpts {
  name: string;
  label: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
}
export interface CheckboxInstance {
  el: HTMLElement;
  get(): boolean;
  set(value: boolean): void;
  destroy(): void;
}
export function createCheckbox(opts: CheckboxOpts): CheckboxInstance;

export interface RadioOpts {
  name: string;
  label: string;
  value: string;
  checked?: boolean;
  onChange?: (value: string) => void;
}
export interface RadioInstance {
  el: HTMLElement;
  get(): string;
  set(value: string): void;
  destroy(): void;
}
export function createRadio(opts: RadioOpts): RadioInstance;

export interface FileInputOpts {
  name: string;
  label: string;
  accept?: string;
  multiple?: boolean;
  onChange?: (files: FileList) => void;
}
export interface FileInputInstance {
  el: HTMLElement;
  getFiles(): FileList;
  destroy(): void;
}
export function createFileInput(opts: FileInputOpts): FileInputInstance;

export interface SegmentedItem {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}
export interface SegmentedOpts {
  name: string;
  label: string;
  items: SegmentedItem[];
  value?: string;
  onChange?: (value: string) => void;
}
export interface SegmentedInstance {
  el: HTMLElement;
  set(value: string): void;
  readonly value: string;
  destroy(): void;
}
export function createSegmented(opts: SegmentedOpts): SegmentedInstance;

export interface TabsOpts {
  label: string;
  items: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
}
export interface TabsInstance {
  el: HTMLElement;
  set(value: string): void;
  readonly value: string;
  destroy(): void;
}
export function createTabs(opts: TabsOpts): TabsInstance;

/** Copy-to-clipboard icon button. */
export function copyButton(getText: () => string, tipText?: string): HTMLElement;
/** Kebab (three-dot) menu button. */
export function kebabButton(
  itemsFn: () => Array<{ label: string; icon?: string; action: () => void }>,
  tip?: string,
): HTMLElement;

// -- select.js ----------------------------------------------------------------

export interface SelectItem {
  value: string;
  label: string;
}
export interface SelectOpts {
  name: string;
  label: string;
  items?: SelectItem[];
  value?: string;
  width?: string;
  onChange?: (value: string) => void;
}
export interface SelectInstance {
  el: HTMLElement;
  set(value: string): void;
  readonly value: string;
  setItems(items: SelectItem[]): void;
  destroy(): void;
}
export function createSelect(opts: SelectOpts): SelectInstance;

// -- datepicker.js ------------------------------------------------------------

export interface DatePickerOpts {
  name: string;
  label: string;
  value?: string;
  min?: string;
  max?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}
export interface DatePickerInstance {
  el: HTMLElement;
  set(value: string): void;
  readonly value: string;
  destroy(): void;
}
export function createDatePicker(opts: DatePickerOpts): DatePickerInstance;

// -- modal.js -----------------------------------------------------------------

export interface ModalOpts {
  title: string;
  body: string | HTMLElement;
  actions?: HTMLElement[];
  onClose?: () => void;
}
/** Open a modal dialog. Returns a close() function. */
export function openModal(opts: ModalOpts): () => void;

// -- popover.js ---------------------------------------------------------------

/** Open a floating panel anchored below an element. */
export function openPopover(anchor: HTMLElement, build: (body: HTMLElement) => void): void;
/** Close the currently open popover. */
export function closePopover(): void;

// -- tooltip.js ---------------------------------------------------------------

/** Initialize the tooltip system (idempotent). */
export function ensureTooltip(): void;
/** Hide the active tooltip immediately. */
export function hideTip(): void;

// -- hovercard.js -------------------------------------------------------------

/** Initialize the hovercard system (idempotent). */
export function ensureHovercard(): void;
/** Hide the active hovercard immediately. */
export function hideHovercard(): void;

// -- ctxmenu.js ---------------------------------------------------------------

export interface CtxMenuItem {
  label?: string;
  icon?: string;
  action?: () => void;
  sep?: boolean;
  head?: string;
}
/** Register a context menu provider for a key. */
export function registerCtx(key: string, provider: (el: HTMLElement) => CtxMenuItem[]): void;
/** Register a footer provider appended to every context menu. */
export function registerCtxFooter(fn: (el: HTMLElement) => CtxMenuItem[]): void;
/** Show a context menu at (x, y). */
export function showCtxMenu(
  x: number,
  y: number,
  items: CtxMenuItem[],
  trigger?: HTMLElement,
): void;
/** Hide the active context menu. */
export function hideCtxMenu(): void;

// -- toast.js -----------------------------------------------------------------

export interface ToastOpts {
  duration?: number;
}
/** Show a toast notification. kind is "ok" (default) or "err". */
export function toast(msg: string, kind?: "ok" | "err", opts?: ToastOpts): void;
/** Register a hook called on every error toast. */
export function setToastErrorHook(fn: (msg: string, opts: ToastOpts) => void): void;

// -- markdown.js --------------------------------------------------------------

/** Render a mini-markdown string to an HTML string. */
export function renderMiniMd(text: string): string;

// -- shell.js -----------------------------------------------------------------

export interface ShellRoute {
  title: string;
  icon: string;
  view: (() => ShellView) | string | HTMLElement;
  tip?: string;
  hidden?: boolean;
}

export interface ShellView {
  root: HTMLElement | null;
  built: boolean;
  build(): void;
  refresh(): void;
  setSub?(sub: string): void;
}

export interface ShellConfig {
  root: HTMLElement;
  brand: { name: string; logoHTML: string };
  routes: Record<string, ShellRoute>;
  defaultRoute: string;
  legacyRoutes?: Record<string, string>;
  topbarActions?: Array<HTMLElement | { icon: string; tip: string; onClick: () => void }>;
  footer?: { height: string; node: HTMLElement };
  onRoute?: (routeKey: string, sub: string | null) => void;
}

export interface ShellInstance {
  navigate(route: string): void;
  setBusy(msg: string | null): void;
  setTitle(title: string, sub?: string): void;
  refreshCurrent(): void;
}

/** Mount the app shell into the given root element. */
export function mountShell(config: ShellConfig): ShellInstance;
