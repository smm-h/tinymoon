// tinymoon — toasts: transient notifications stacked above the footer slot.

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { copyButton } from "./controls.js";
import { ensureRoot } from "./kernel.js";

const VALID_KINDS = ["ok", "err"];
const MAX_TOASTS = 5;

let errorHook = null;

// setToastErrorHook(fn): register a module-level hook invoked as
// fn(message, opts) whenever an error toast is shown — e.g. to mirror errors
// into a log. opts is the same opts object toast() received ({} when the
// caller passed none, never undefined), so per-call metadata reaches the hook.
// Registering a second hook is a hard error, never a silent overwrite.
export function setToastErrorHook(fn) {
  if (errorHook) throw new Error("setToastErrorHook: a hook is already registered");
  errorHook = fn;
}

// Active toasts, oldest first. Each entry: {el, timer, fadeTimer}.
const active = [];

function getRoot() {
  const root = ensureRoot("tm-toast-root", {
    role: "status",
    "aria-live": "polite",
  });
  // Popover approach: when toasts are active and a dialog[open] exists,
  // the toast root renders in the top layer via popover="manual", so it
  // appears above native <dialog> top-layer elements.
  if (!root.hasAttribute("popover")) {
    root.setAttribute("popover", "manual");
  }
  return root;
}

function promoteIfNeeded(root) {
  const hasDialog = document.querySelector("dialog[open]");
  if (hasDialog && active.length > 0) {
    try { root.showPopover(); } catch (_) { /* already shown */ }
  }
}

function demoteIfEmpty(root) {
  if (active.length === 0) {
    try { root.hidePopover(); } catch (_) { /* already hidden */ }
  }
}

function removeToast(entry) {
  const idx = active.indexOf(entry);
  if (idx === -1) return;
  active.splice(idx, 1);
  if (entry.timer) clearTimeout(entry.timer);
  if (entry.fadeTimer) clearTimeout(entry.fadeTimer);
  entry.el.remove();
  demoteIfEmpty(getRoot());
}

function enforceStackCap() {
  while (active.length >= MAX_TOASTS) {
    removeToast(active[0]);
  }
}

// toast(msg, kind, opts): kind "err" turns the toast red and keeps it on
// screen longer. kind "ok" (or omitted) shows a success toast. Any other
// kind value throws. opts.duration (ms) overrides the lifetime; duration 0
// means persistent (no auto-dismiss, only the dismiss button removes it).
// Every toast carries a copy icon for its message text and a dismiss button.
// The mount point is created lazily on first use.
export function toast(msg, kind, opts) {
  // Default kind to "ok" when omitted.
  if (kind === undefined || kind === null) kind = "ok";
  if (!VALID_KINDS.includes(kind)) {
    throw new Error('toast: invalid kind "' + kind + '", expected "ok" or "err"');
  }

  enforceStackCap();

  const isErr = kind === "err";

  const t = el("div", "toast" + (isErr ? " err" : ""));
  // Error toasts get their own role="alert" for assertive announcement,
  // overriding the polite aria-live on the root container.
  if (isErr) t.setAttribute("role", "alert");
  t.innerHTML = icon(isErr ? "warn" : "check");
  t.appendChild(el("span", "toast-msg", msg));
  t.appendChild(copyButton(() => msg, "Copy this message"));

  // Dismiss button
  const dismiss = el("button", "toast-dismiss");
  dismiss.type = "button";
  dismiss.innerHTML = icon("close");
  dismiss.setAttribute("aria-label", "Dismiss");
  t.appendChild(dismiss);

  const root = getRoot();
  root.appendChild(t);

  const entry = { el: t, timer: null, fadeTimer: null };
  active.push(entry);

  promoteIfNeeded(root);

  // Resolve duration: explicit 0 = persistent; falsy but not 0 = default.
  const rawDuration = opts && opts.duration;
  const persistent = rawDuration === 0;
  const life = persistent ? 0 : (rawDuration || (isErr ? 5200 : 3200));

  function startFade() {
    t.classList.add("fading");
    // Coupled with .toast.fading in primitives.css: its 180ms transition
    // must stay shorter than this removal delay.
    entry.fadeTimer = setTimeout(() => removeToast(entry), 200);
  }

  // Auto-dismiss scheduling (skipped for persistent toasts).
  let remaining = life;
  let startedAt = 0;

  function scheduleAutoDismiss() {
    if (persistent || remaining <= 0) return;
    startedAt = Date.now();
    entry.timer = setTimeout(startFade, remaining);
  }

  function pauseAutoDismiss() {
    if (persistent || !entry.timer) return;
    clearTimeout(entry.timer);
    entry.timer = null;
    remaining -= (Date.now() - startedAt);
    if (remaining < 0) remaining = 0;
  }

  scheduleAutoDismiss();

  // Pause-on-hover: pause auto-dismiss when pointer enters, resume on leave.
  t.addEventListener("pointerenter", pauseAutoDismiss);
  t.addEventListener("pointerleave", () => scheduleAutoDismiss());

  // Dismiss button click: remove immediately.
  dismiss.addEventListener("click", (e) => {
    e.stopPropagation();
    if (entry.timer) clearTimeout(entry.timer);
    removeToast(entry);
  });

  // After the toast is on screen (and its removal is scheduled, so a
  // throwing hook can't strand it). Hook exceptions propagate.
  if (isErr && errorHook) errorHook(msg, opts || {});
}
