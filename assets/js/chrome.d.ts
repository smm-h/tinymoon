// tinymoon — TypeScript declarations for the chrome barrel: the Phase 6B
// framework wave (async-state blocks, lazy mounting, keyboard shortcuts, and
// the command palette).

// -- states.js ----------------------------------------------------------------

/** Options for {@link loadingBlock}. */
export interface LoadingBlockOpts {
  /** The label under the spinner (default `"Loading…"`). */
  label?: string;
}

/** Options for {@link emptyBlock}. `title` is required. */
export interface EmptyBlockOpts {
  /** The primary empty-state message. */
  title: string;
  /** Optional secondary detail line. */
  sub?: string;
}

/** Options for {@link errorBlock}. `message` is required. */
export interface ErrorBlockOpts {
  /** The error message to display. */
  message: string;
  /** When present, renders a Retry button wired to this handler. */
  onRetry?: () => void;
}

/** Options for {@link renderAsync}. */
export interface RenderAsyncOpts<T> {
  /** Options for the interim loading block. */
  loading?: LoadingBlockOpts;
  /** Options for the empty block shown when `onData` returns a falsy value. */
  empty?: EmptyBlockOpts;
  /** Extra options merged into the error block (e.g. `onRetry`). */
  error?: Omit<ErrorBlockOpts, "message"> & { message?: string };
  /**
   * Called with the resolved data. Return a falsy value to show the empty
   * block, an `Element` to display it, or any other truthy value to indicate
   * you populated `container` yourself.
   */
  onData?: (data: T) => unknown;
}

/** A centered loading block: a spinner plus a label, `aria-busy="true"`. */
export function loadingBlock(opts?: LoadingBlockOpts): HTMLElement;

/** A centered empty-state block built on the `.empty` widgets.css style. */
export function emptyBlock(opts: EmptyBlockOpts): HTMLElement;

/** A centered error block with `role="alert"` and an optional Retry button. */
export function errorBlock(opts: ErrorBlockOpts): HTMLElement;

/**
 * Swap loading / data / empty / error blocks into `container` as `promise`
 * settles. Resolves to the data on success; on rejection it resolves (to
 * `undefined`) after showing the error block, so the failure surfaces as the
 * visible error state rather than an unhandled rejection.
 */
export function renderAsync<T>(
  container: Element,
  promise: T | Promise<T>,
  opts?: RenderAsyncOpts<T>,
): Promise<T | undefined>;

// -- lazy.js ------------------------------------------------------------------

/** Options for {@link lazyMount}. */
export interface LazyMountOpts {
  /**
   * IntersectionObserver root. Omit for "auto" — the shell content scroller
   * (`#tm-content`) when a shell is mounted, else the viewport. Pass `null`
   * explicitly for the viewport, or an element to scope it.
   */
  root?: Element | Document | null;
  /** IntersectionObserver `rootMargin` (default `"0px"`). */
  rootMargin?: string;
  /** Maximum concurrent in-flight `loadFn` calls (default `3`). */
  concurrency?: number;
}

/**
 * Load elements lazily as they scroll into view, at most `concurrency` at once,
 * draining in visibility order. `loadFn(el)` may return a promise (awaited to
 * gate the concurrency slot). Returns a `cancel()` that disconnects the observer
 * and drops not-yet-started candidates.
 */
export function lazyMount(
  target: Element | ArrayLike<Element>,
  loadFn: (el: Element) => void | Promise<unknown>,
  opts?: LazyMountOpts,
): () => void;

// -- shortcuts.js -------------------------------------------------------------

/** Options for {@link registerShortcut}. */
export interface ShortcutOpts {
  /** Allow a bare single-key combo to fire inside inputs/contenteditable. */
  allowInInputs?: boolean;
  /** Fire even while a kernel overlay (modal, drawer, menu) is open. */
  global?: boolean;
}

/**
 * Bind a keyboard shortcut on the shared module-level keydown listener. `combo`
 * is "mod+k" style ("mod" resolves to Cmd on Apple platforms, Ctrl elsewhere).
 * Ordinary shortcuts are suppressed while a kernel overlay is open unless
 * `global`; bare single-key combos are suppressed inside text entry unless
 * `allowInInputs`. Registering an already-active combo throws. Returns an
 * unregister function.
 */
export function registerShortcut(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  opts?: ShortcutOpts,
): () => void;

// -- palette.js ---------------------------------------------------------------

/** A single palette command. */
export interface PaletteItem {
  /** The visible, subsequence-matched label. */
  label: string;
  /** Optional right-aligned hint (e.g. a shortcut or route). */
  hint?: string;
  /** Optional icon name. */
  icon?: string;
  /** Invoked when the item is chosen (palette closes first). */
  run(): void;
}

/** A palette source: `fn(query)` returns items or a promise of items. */
export type PaletteSource = (query: string) => PaletteItem[] | Promise<PaletteItem[]>;

/** The handle {@link openPalette} returns. */
export interface PaletteHandle {
  /** Close the palette. */
  close(): void;
  /** The backing `<dialog>` element. */
  el: HTMLElement;
}

/** Options for {@link installPalette}. */
export interface InstallPaletteOpts {
  /** The global toggle combo (default `"mod+k"`). */
  shortcut?: string;
}

/**
 * Register a palette source. `fn(query)` returns the candidate items (the
 * palette applies its own subsequence match + rank). Returns an unregister.
 */
export function registerPaletteSource(fn: PaletteSource): () => void;

/**
 * Score `label` against `query`: a number (higher is better) when `query` is a
 * subsequence of `label` (case-insensitive), else `null`.
 */
export function score(label: unknown, query: string): number | null;

/**
 * Open the command palette (a modal dialog). Returns the existing handle if it
 * is already open, so a toggle can detect and close it.
 */
export function openPalette(): PaletteHandle;

/**
 * Opt-in wiring: bind a global toggle shortcut and seed a nav source from a
 * mounted shell's rendered routes. Returns a function that unregisters both.
 */
export function installPalette(opts?: InstallPaletteOpts): () => void;

// -- dismiss.js ---------------------------------------------------------------

/** Options for {@link registerLightDismiss}. */
export interface LightDismissOpts {
  /** Elements whose interior counts as "inside" (a press there never dismisses). */
  panels: Element[];
  /** Called to close the overlay when an outside press lands. */
  dismiss: () => void;
  /**
   * Trigger element(s) that toggle the overlay. A press on a trigger while this
   * layer is topmost dismisses it AND claims the pointer gesture (suppresses the
   * trailing click), so a close-press cannot immediately reopen the overlay.
   */
  trigger?: Element | Element[];
}

/** The overlay handle an {@link OverlayOpener} returns. */
export interface OverlayHandle {
  /** The overlay's root element (its `id`, if any, becomes `aria-controls`). */
  el?: Element;
  /** Close the overlay. */
  close(): void;
}

/** Context passed to an {@link OverlayOpener}. */
export interface OverlayTriggerContext {
  /** The trigger element — pass it through as the overlay's light-dismiss `trigger`. */
  trigger: Element;
  /** Call when the overlay closes by ANY path so the trigger's state resets. */
  onClose: () => void;
}

/** Opens an overlay for {@link registerOverlayTrigger} and returns its handle. */
export type OverlayOpener = (ctx: OverlayTriggerContext) => OverlayHandle;

/**
 * Register a light-dismiss overlay layer on the kernel's central outside-pointer
 * registry (one document capture-phase pointerdown listener, LIFO stack — only
 * the topmost layer is consulted per press). Returns an unregister function.
 */
export function registerLightDismiss(opts: LightDismissOpts): () => void;

/**
 * Declarative invoker contract: the framework owns `triggerEl`'s click handler
 * and open/closed state. On click while closed it calls `opener({trigger,
 * onClose})` (which opens the overlay, light-dismiss-registers it with the
 * trigger, calls `onClose` on any close, and returns its handle); on click while
 * open it closes via that handle. Reflects state as `aria-expanded` (and
 * `aria-controls` when the overlay element has an `id`). Double-registering the
 * same element throws. Returns an unregister function.
 */
export function registerOverlayTrigger(
  triggerEl: Element,
  opener: OverlayOpener,
): () => void;
