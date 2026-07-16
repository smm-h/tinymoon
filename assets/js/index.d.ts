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

/** Read a CSS custom property. Defaults to :root; pass `scope` to resolve it
 * against a different element (e.g. a shadow host). */
export function cssVar(name: string, scope?: Element): string;
/** Create or return a singleton root element with the given id, inside `host`
 * (defaults to document.body; pass an element or shadow root to scope it). */
export function ensureRoot(
  id: string,
  attrs?: Record<string, string>,
  host?: Element | ShadowRoot,
): HTMLElement;
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
  get(): boolean;
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

// -- tabpanels.js -------------------------------------------------------------

export interface TabPanelItem {
  value: string;
  label: string;
  icon?: string;
  /** Build the panel body once, on first activation (lazy + idempotent). */
  build?(panel: HTMLElement): void;
}
export interface TabPanelsOpts {
  label: string;
  items: TabPanelItem[];
  value?: string;
}
export interface TabPanelsInstance {
  el: HTMLElement;
  set(value: string): void;
  readonly value: string;
  destroy(): void;
}
/** Tab bar (createTabs) composed with an APG-wired panel region: lazy per-panel
 * build, state-preserving hide on switch. */
export function createTabPanels(opts: TabPanelsOpts): TabPanelsInstance;

// -- grid.js ------------------------------------------------------------------

/** Rectangular grid presets (columns×rows). */
export type GridPreset = "1x1" | "2x1" | "1x2" | "2x2" | "2+1" | "1+2";
export interface GridOpts {
  preset: GridPreset;
  /** Nodes placed into the grid slots in order. */
  slots?: Node[];
}
export interface GridInstance {
  el: HTMLElement;
  /** The live slot elements (grows/shrinks when the preset changes). */
  slots: HTMLElement[];
  setPreset(preset: GridPreset): void;
  destroy(): void;
}
/** A CSS-first preset grid layout (content primitive, not a shell mode). */
export function createGrid(opts: GridOpts): GridInstance;

// -- iconbutton.js ------------------------------------------------------------

export interface IconButtonOpts {
  /** Icon name (rendered via icon()). */
  icon: string;
  tip?: string;
  onClick?: (event: MouseEvent) => void;
  /** Initial pressed/active state (default false). */
  active?: boolean;
}
export interface IconButtonInstance {
  el: HTMLElement;
  setActive(active: boolean): void;
  setIcon(name: string): void;
  destroy(): void;
}
/** A reusable, stateful topbar icon button. Pass `.el` to topbarActions. */
export function iconButton(opts: IconButtonOpts): IconButtonInstance;

/** Copy-to-clipboard icon button. */
export function copyButton(getText: () => string, tipText?: string): HTMLElement;
/** Kebab (three-dot) menu button. */
export function kebabButton(
  itemsFn: () => Array<{ label: string; icon?: string; action: () => void }>,
  tip?: string,
): HTMLElement;

// -- inputs.js ----------------------------------------------------------------

/** Text-like input types createInput accepts. checkbox/radio/file/range/
 * number/time/date are rejected -- they have dedicated factories. */
export type InputType = "text" | "password" | "email" | "url" | "search" | "tel";

export interface InputOpts {
  name: string;
  label: string;
  type?: InputType;
  value?: string;
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  disabled?: boolean;
  onChange?: (value: string, event: Event) => void;
  /** Fires on every keystroke (native "input" event), vs onChange on commit. */
  onInput?: (value: string, event: Event) => void;
}
export interface InputInstance {
  el: HTMLElement;
  readonly value: string;
  set(value: string): void;
  get(): string;
  focus(): void;
  /** Render an inline error (wiring aria-invalid + aria-describedby), or clear
   * it with null. */
  setError(message: string | null): void;
  destroy(): void;
}
export function createInput(opts: InputOpts): InputInstance;

export interface TextareaOpts {
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  disabled?: boolean;
  onChange?: (value: string, event: Event) => void;
  /** Fires on every keystroke (native "input" event), vs onChange on commit. */
  onInput?: (value: string, event: Event) => void;
}
export function createTextarea(opts: TextareaOpts): InputInstance;

export interface FieldOpts {
  label: string;
  /** A factory instance ({el}) or a raw element to wrap in a labeled field. */
  control: { el: HTMLElement } | HTMLElement;
  hint?: string;
  /** Explicit id for the for/aria wiring; minted when omitted. */
  id?: string;
}
export interface FieldInstance {
  el: HTMLElement;
  /** Render/clear an inline error, setting aria-invalid + aria-describedby on
   * the wrapped control. */
  setError(message: string | null): void;
  destroy(): void;
}
export function createField(opts: FieldOpts): FieldInstance;

export interface NumberOpts {
  name: string;
  label: string;
  value?: number | string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string, event: Event) => void;
  /** Fires on every keystroke and on each stepper button press. */
  onInput?: (value: string, event: Event) => void;
}
/** Number stepper: a native input[type=number] framed by custom +/- buttons.
 * Same instance contract as createInput. */
export function createNumber(opts: NumberOpts): InputInstance;

// -- slider.js ----------------------------------------------------------------

/**
 * Slider identity. Omit for the default chromed slider (filled track + thumb).
 * `"seek"` is a semantically distinct slider: an invisible position scrubber
 * laid over app-drawn visuals (a waveform/timeline canvas). It renders the same
 * native-range mechanics inside a `.tm-slider.tm-slider-seek` wrapper whose
 * framework CSS blanks the track and thumb while keeping the full-area hit
 * target, the focus-visible outline, and the slider ARIA (role/valuenow) intact.
 * The app owns the visual representation drawn underneath — the seek variant is
 * only the scrubber over it. Any unknown variant is a hard error.
 */
export type SliderVariant = "seek";

export interface SliderOpts {
  name: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value?: number;
  disabled?: boolean;
  /** Slider identity; omit for the default chromed slider. See SliderVariant. */
  variant?: SliderVariant;
  /** Fires once on commit (native "change" event). */
  onChange?: (value: number, event: Event) => void;
  /** Fires live during a drag (native "input" event). Extends the house
   * single-onChange convention: onInput = live, onChange = commit. */
  onInput?: (value: number, event: Event) => void;
}
export interface SliderInstance {
  el: HTMLElement;
  readonly value: number;
  set(value: number): void;
  get(): number;
  destroy(): void;
}
export function createSlider(opts: SliderOpts): SliderInstance;

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

// -- embed.js -----------------------------------------------------------------

export type EmbedMode = "iframe" | "shadow";
export interface EmbedOpts {
  /** Explicit isolation mode -- no default; the caller must choose. */
  mode: EmbedMode;
  /** Accessible name for the foreign region (required). */
  label: string;
  /** Render the visible label strip (default true). */
  showLabel?: boolean;
  // iframe mode
  /** Foreign URL for the sandboxed iframe. */
  src?: string;
  /** Sandbox tokens; replaces the restrictive default when given. */
  sandbox?: string[];
  /** Permissions-Policy allow= list. */
  allow?: string;
  // shadow mode
  /** Initial foreign content injected into the shadow root. */
  content?: string | Node;
  /** TEST-ONLY: use an OPEN shadow root and expose shadowRoot. */
  openForTest?: boolean;
}
export interface EmbedInstance {
  el: HTMLElement;
  readonly mode: EmbedMode;
  /** iframe mode: the sandboxed frame element. */
  frame?: HTMLIFrameElement;
  /** iframe mode: point the frame at a new URL. */
  setSrc?(url: string): void;
  /** shadow mode: replace the foreign content. */
  setContent?(content: string | Node): void;
  /** shadow mode + openForTest: the OPEN shadow root (test seam only). */
  shadowRoot?: ShadowRoot;
  destroy(): void;
}
export function createEmbed(opts: EmbedOpts): EmbedInstance;

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

// -- timepicker.js ------------------------------------------------------------

export interface TimePickerOpts {
  name: string;
  label: string;
  /** Canonical 24h "HH:MM" value. */
  value?: string;
  /** Minute granularity in the picker column (default 5). */
  minuteStep?: number;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}
export interface TimePickerInstance {
  el: HTMLElement;
  /** Set the canonical 24h "HH:MM" value. */
  set(value: string): void;
  /** The canonical 24h "HH:MM" value, or null. */
  readonly value: string | null;
  destroy(): void;
}
export function createTimePicker(opts: TimePickerOpts): TimePickerInstance;

// -- combobox.js --------------------------------------------------------------

export interface ComboboxItem {
  value: string;
  label?: string;
}
export interface ComboboxOpts {
  name: string;
  label: string;
  /** Async or sync result provider for the typed query. */
  onFilter?: (query: string) => ComboboxItem[] | Promise<ComboboxItem[]>;
  /** Static items filtered client-side when onFilter is omitted. */
  items?: ComboboxItem[];
  value?: string;
  /** Initial visible text (defaults to the value). */
  text?: string;
  /** Allow committing arbitrary typed text on Enter (default false). */
  freeText?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string | null) => void;
}
export interface ComboboxInstance {
  el: HTMLElement;
  readonly value: string | null;
  set(value: string | null, text?: string): void;
  get(): string | null;
  destroy(): void;
}
export function createCombobox(opts: ComboboxOpts): ComboboxInstance;

export interface MultiSelectOpts {
  name: string;
  label: string;
  onFilter?: (query: string) => ComboboxItem[] | Promise<ComboboxItem[]>;
  items?: ComboboxItem[];
  values?: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (values: string[]) => void;
}
export interface MultiSelectInstance {
  el: HTMLElement;
  readonly values: string[];
  setValues(values: string[]): void;
  destroy(): void;
}
export function createMultiSelect(opts: MultiSelectOpts): MultiSelectInstance;

// -- accordion.js -------------------------------------------------------------

export interface AccordionItem {
  title: string;
  body: string | HTMLElement;
  open?: boolean;
}
export interface AccordionOpts {
  items: AccordionItem[];
  /** Allow multiple panels open at once (default false = single-open). */
  multi?: boolean;
}
export interface AccordionInstance {
  el: HTMLElement;
  open(index: number): void;
  close(index: number): void;
  toggle(index: number): void;
  destroy(): void;
}
export function createAccordion(opts: AccordionOpts): AccordionInstance;

// -- modal.js -----------------------------------------------------------------

export interface ModalOpts {
  title: string;
  body: string | HTMLElement;
  actions?: HTMLElement[];
  onClose?: () => void;
}
/** Open a modal dialog. Returns a close() function. */
export function openModal(opts: ModalOpts): () => void;

// -- drawer.js ----------------------------------------------------------------

export interface DrawerOpts {
  title: string;
  body: string | HTMLElement;
  /** Which edge the drawer anchors to and slides from (default "right"). */
  side?: "left" | "right";
  /** true → native <dialog> with focus trap + inert background; false
   * (default) → light-dismiss overlay that leaves the page interactive. */
  modal?: boolean;
  onClose?: () => void;
}
export interface DrawerInstance {
  /** The drawer panel (a <dialog> when modal, else a <div>). */
  el: HTMLElement;
  close(): void;
}
/** Open an edge-anchored overlay drawer on the kernel layer stack. */
export function openDrawer(opts: DrawerOpts): DrawerInstance;

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
  /** Build the view (hidden) at mount instead of on first visit. */
  eager?: boolean;
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
  /** Push a message into the shell's aria-live route announcer. */
  announce(msg: string): void;
}

/** Mount the app shell into the given root element. */
export function mountShell(config: ShellConfig): ShellInstance;

/** Push a message into the mounted shell's aria-live route announcer. No-op
 * before a shell is mounted. */
export function announce(msg: string): void;

/** Write the shell's topbar page-subtitle (#tm-page-sub). No-op before a shell
 * is mounted. This is the standalone public setter that also backs the
 * createView ctx's `setSub`; plain-object views (that do not go through
 * createView) use it to set the subtitle without touching the DOM node. */
export function setPageSub(text: string): void;

// -- view.js ------------------------------------------------------------------

/** The ctx passed to a createView build/refresh callback. */
export interface ViewContext {
  /** The view's section element (assigned before the first build). */
  root: HTMLElement;
  /** Write the shell topbar's page subtitle (#tm-page-sub). */
  setSub(text: string): void;
}

export interface CreateViewOpts {
  /** Build the view DOM once (idempotent; runs on first visit or at mount for
   * eager routes). */
  build(ctx: ViewContext): void;
  /** Cheap per-visit updates; runs after the view is shown. */
  refresh?(ctx: ViewContext): void;
  /** Deep-link handler: receives the hash tail before refresh() runs. */
  setSub?(sub: string, ctx: ViewContext): void;
}

/** Build a contract-conforming shell view object with managed `built` and an
 * idempotent build. Plain object views still work unchanged. */
export function createView(opts: CreateViewOpts): ShellView;
