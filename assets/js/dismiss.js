// tinymoon — light-dismiss engine + declarative overlay-trigger invoker.
//
// WHY A SEPARATE MODULE (not kernel.js): outside-pointer dismissal belongs
// beside the kernel's Escape/hashchange layer stack conceptually, but the
// frozen core-js byte ceiling has no room for this logic and kernel.js is a
// core module. Per the Size promise, new capability lands in a new tier, so
// this engine budgets in chrome-js. Core overlay modules (popover, select,
// ctxmenu, shell) import it relatively; drawer (already chrome) does too. It
// imports nothing local, so the module import graph stays acyclic.
//
// It mirrors the kernel layer stack, but for outside-pointer dismissal: ONE
// document capture-phase pointerdown listener over a LIFO stack of light-
// dismiss layers. Only the topmost layer is consulted per press (LIFO), exactly
// like the Escape stack.

// Each layer: { panels: Element[], dismiss: () => void, triggers: Element[] }.
const lightLayers = [];

function inAny(els, target) {
  return els.some((el) => el === target || el.contains(target));
}

// lightDismissDepth() → how many light-dismiss layers are open (0 when none). A
// read-only view of the LIFO stack so other modules — shortcuts.js suppression —
// can ask "is any transient overlay (popover, ctxmenu, select, non-modal
// drawer) open?" without reaching into the stack.
export function lightDismissDepth() {
  return lightLayers.length;
}

// registerLightDismiss({panels, dismiss, trigger?}) → unregister.
//   panels  — elements whose interior counts as "inside" (never dismisses).
//   dismiss — called to close the overlay when an outside press lands.
//   trigger — element(s) that toggle the overlay: a press on a trigger while
//             this layer is topmost dismisses it AND claims the pointer gesture
//             (suppresses the trailing click that would otherwise reopen it), so
//             a close-press can never immediately reopen the overlay.
export function registerLightDismiss({ panels, dismiss, trigger }) {
  const entry = {
    panels: panels || [],
    dismiss,
    triggers: trigger ? (Array.isArray(trigger) ? trigger : [trigger]) : [],
  };
  lightLayers.push(entry);
  return () => {
    const i = lightLayers.indexOf(entry);
    if (i !== -1) lightLayers.splice(i, 1);
  };
}

// The single document capture-phase pointerdown listener.
//
// SELF-DISMISS GUARANTEE (this is what replaces drawer.js's old setTimeout(0)
// deferral — no timer, no race): capture phase runs document-first, BEFORE any
// target-phase handler that might open a nested overlay. tinymoon overlays open
// on `click` (or `contextmenu`), never on a raw pointerdown, so the opening
// pointerdown has already passed through this listener by the time the overlay
// registers its layer — the overlay is not yet on the stack when this runs, and
// so is never self-dismissed by its own opening press. (An overlay that
// deliberately opened during a raw pointerdown would need to register from a
// listener ordered after this one, or claim the gesture; none do.)
document.addEventListener("pointerdown", (e) => {
  if (lightLayers.length === 0) return;
  const top = lightLayers[lightLayers.length - 1];
  const target = e.target;
  // Inside the topmost layer's own panels → not a dismissal. A nested overlay
  // whose panel is a DOM descendant of these panels is covered by .contains();
  // a nested overlay mounted elsewhere (e.g. a menu on document.body) registers
  // its OWN topmost layer and is consulted as the top layer in its own turn —
  // so opening a nested overlay never dismisses its opener.
  if (inAny(top.panels, target)) return;
  // A press on the topmost layer's trigger: dismiss AND claim the gesture.
  if (inAny(top.triggers, target)) {
    top.dismiss();
    claimGesture(top.triggers);
    return;
  }
  // Otherwise it is an outside press → dismiss the topmost layer.
  top.dismiss();
}, true);

// claimGesture(triggers) — one-shot capture-phase click suppressor scoped to
// these trigger elements. The DOM `click` event carries no pointerId, so the
// gesture is identified by (a) its trigger element and (b) being the very next
// click on it — a click is always the tail of the same pointerdown→pointerup
// that armed this. Clicks on OTHER elements pass through untouched and leave the
// suppressor armed (so an unrelated concurrent click cannot consume it); a
// safety timeout disarms it if the press never completes as a click (a drag).
function claimGesture(triggers) {
  const onClick = (e) => {
    if (!inAny(triggers, e.target)) return; // unrelated click — stay armed
    e.stopImmediatePropagation();
    e.preventDefault();
    done();
  };
  const done = () => {
    document.removeEventListener("click", onClick, true);
    clearTimeout(timer);
  };
  document.addEventListener("click", onClick, true);
  const timer = setTimeout(done, 700);
}

// registerOverlayTrigger(triggerEl, opener) → unregister.
//
// The declarative invoker contract: the framework owns the trigger button's
// click handler and open/closed state. On click while closed it calls
// `opener({trigger, onClose})`, which must open the overlay, light-dismiss-
// register it with `trigger: triggerEl` (so the gesture-claim is wired), call
// the supplied `onClose` when the overlay closes by ANY path (Escape, outside
// press, its own close control), and return the overlay handle `{el, close}`.
// On click while open it closes via that handle. Reflects state on the trigger
// as aria-expanded (and aria-controls when the overlay element carries an id).
// Double-registering the same element is a hard error.
const registered = new WeakSet();
export function registerOverlayTrigger(triggerEl, opener) {
  if (registered.has(triggerEl)) {
    throw new Error("registerOverlayTrigger: element already registered");
  }
  registered.add(triggerEl);
  let handle = null;
  triggerEl.setAttribute("aria-expanded", "false");
  const reset = () => {
    if (!handle) return;
    handle = null;
    triggerEl.setAttribute("aria-expanded", "false");
    triggerEl.removeAttribute("aria-controls");
  };
  const onClick = () => {
    if (handle) { const h = handle; reset(); h.close(); return; }
    handle = opener({ trigger: triggerEl, onClose: reset });
    triggerEl.setAttribute("aria-expanded", "true");
    if (handle && handle.el && handle.el.id) {
      triggerEl.setAttribute("aria-controls", handle.el.id);
    }
  };
  triggerEl.addEventListener("click", onClick);
  return () => {
    triggerEl.removeEventListener("click", onClick);
    registered.delete(triggerEl);
  };
}
