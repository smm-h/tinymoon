// tinymoon — registerShortcut: a keyboard-shortcut binder built on ONE
// module-level keydown listener (kernel discipline: no per-shortcut listeners).
// It integrates WITH the overlay kernel rather than around it — while any kernel
// layer is open (a modal, drawer, popover, context menu, select), ordinary
// shortcuts are suppressed, so typing Escape-able UI never triggers app-level
// keys underneath. Shortcuts explicitly marked {global: true} bypass that
// suppression (the command-palette toggle needs this).
//
// Combo syntax is "mod+k" style: "+"-joined tokens where the last is the key and
// the rest are modifiers. "mod" is the platform-resolved primary modifier —
// Cmd on Apple platforms, Ctrl elsewhere — so one registration is correct on
// every OS. For a single-character key the shift state is implied by the
// character itself ("?" already means Shift+/), so shift is not part of the
// signature there.
//
// Overlay suppression is detected via an open top-layer <dialog> — the shape
// every modal overlay (openModal, a modal openDrawer, and the command palette)
// takes. That covers the documented interplay: while the palette or a modal is
// open, only {global: true} shortcuts fire. Transient light-dismiss overlays
// (popover, context menu, select, a non-modal drawer) are Escape-dismissable
// and short-lived, so they do not suppress shortcuts.

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");

// overlayOpen() → true while a modal top-layer dialog is showing.
function overlayOpen() {
  return typeof document !== "undefined" && !!document.querySelector("dialog[open]");
}

// canonical(mods, key) → the stable string signature both registration and
// live events reduce to. For single-character keys shift is dropped (encoded in
// the character); for named keys ("Enter", "ArrowDown") shift is significant.
function canonical(mods, key) {
  const k = key.toLowerCase();
  const single = k.length === 1;
  return [
    mods.ctrl ? "ctrl" : "",
    mods.meta ? "meta" : "",
    mods.alt ? "alt" : "",
    (mods.shift && !single) ? "shift" : "",
    k,
  ].filter(Boolean).join("+");
}

// parseCombo("mod+shift+k") → {signature, hasHardMod}. hasHardMod is true when
// a ctrl/meta/alt modifier is present — such combos are safe to fire inside
// text inputs; bare single-key combos are not (they collide with typing).
function parseCombo(combo) {
  if (typeof combo !== "string" || !combo.trim()) {
    throw new Error("registerShortcut: combo must be a non-empty string");
  }
  const parts = combo.toLowerCase().split("+").map((s) => s.trim()).filter(Boolean);
  const key = parts.pop();
  const mods = { ctrl: false, meta: false, alt: false, shift: false };
  for (const p of parts) {
    if (p === "mod") { if (IS_MAC) mods.meta = true; else mods.ctrl = true; }
    else if (p === "ctrl" || p === "control") mods.ctrl = true;
    else if (p === "cmd" || p === "meta" || p === "super" || p === "win") mods.meta = true;
    else if (p === "alt" || p === "opt" || p === "option") mods.alt = true;
    else if (p === "shift") mods.shift = true;
    else throw new Error("registerShortcut: unknown modifier '" + p + "'");
  }
  return { signature: canonical(mods, key), hasHardMod: mods.ctrl || mods.meta || mods.alt };
}

// signature → {handler, global, allowInInputs, hasHardMod}
const registry = new Map();

function inTextEntry(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  document.addEventListener("keydown", (e) => {
    if (e.key === undefined) return;
    const sig = canonical(
      { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey },
      e.key,
    );
    const entry = registry.get(sig);
    if (!entry) return;
    // Suppressed while a modal overlay is open, unless the shortcut is global.
    if (!entry.global && overlayOpen()) return;
    // Bare single-key combos do not fire inside text-entry contexts unless the
    // caller opted in; modifier combos (mod/ctrl/alt) always fire.
    if (!entry.hasHardMod && !entry.allowInInputs && inTextEntry(e.target)) return;
    e.preventDefault();
    entry.handler(e);
  });
}

// registerShortcut(combo, handler, {allowInInputs?, global?}) → unregister.
// Registering a combo that is already active is a hard error — no silent
// override; unregister the first one before rebinding.
export function registerShortcut(combo, handler, opts) {
  if (typeof handler !== "function") throw new Error("registerShortcut: handler is required");
  const o = opts || {};
  const { signature, hasHardMod } = parseCombo(combo);
  if (registry.has(signature)) {
    throw new Error("registerShortcut: '" + combo + "' (" + signature + ") is already registered");
  }
  registry.set(signature, { handler, global: !!o.global, allowInInputs: !!o.allowInInputs, hasHardMod });
  install();
  return function unregister() {
    if (registry.get(signature) && registry.get(signature).handler === handler) {
      registry.delete(signature);
    }
  };
}
