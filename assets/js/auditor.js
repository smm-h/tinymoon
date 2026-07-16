// tinymoon — runtime conformance auditor (dev-mode only).
//
// Import this module during development to activate runtime checks that
// mirror the static charter rules:
//   - border-radius must be 0 everywhere
//   - no native browser controls (select, checkbox, radio, file, dialog)
//     outside the framework's hidden-input pattern
//   - no external network loads
//
// NOT shipped in the core or extras barrel. Consumers import it directly:
//   import "../assets/js/auditor.js";

const PREFIX = "[tinymoon/auditor]";

// Collect errors instead of only logging — test harnesses read this array.
const errors = [];
window.__tmAuditorErrors = errors;

function report(msg, el) {
  const entry = { message: msg, element: el || null };
  errors.push(entry);
  if (el) {
    console.error(PREFIX, msg, el);
  } else {
    console.error(PREFIX, msg);
  }
}

// ---------------------------------------------------------------------------
// 1. MutationObserver — DOM conformance on every mutation
// ---------------------------------------------------------------------------

// Elements that use hidden native inputs internally (the framework pattern:
// visually-hidden input inside a wrapper with one of these classes). These
// are the framework's own primitives, not consumer misuse.
const FRAMEWORK_WRAPPERS = new Set([
  "tm-checkbox",
  "tm-radio",
  "tm-file",
  "seg",           // createSegmented wraps hidden radios in a .seg
  "tm-datepicker", // datepicker wraps a hidden text input
  "sel",           // createSelect wraps a hidden input for form participation
]);

function isInsideFrameworkWrapper(node) {
  let el = node.parentElement;
  while (el) {
    if (el.classList) {
      for (const cls of FRAMEWORK_WRAPPERS) {
        if (el.classList.contains(cls)) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

// Tags and input types that are banned in consumer code.
const BANNED_TAGS = new Set(["SELECT", "DIALOG"]);
const BANNED_INPUT_TYPES = new Set(["checkbox", "radio", "file"]);

// tm-embed allowance (runtime mirror of the checker's boundary waiver).
//
// What the auditor can ACTUALLY observe across an embed boundary:
//   - Shadow roots (open OR closed): a MutationObserver does NOT cross shadow
//     boundaries, and querySelectorAll("*") does not descend into them. So all
//     shadow-hosted foreign DOM/CSS is invisible to the auditor already --
//     closed vs open makes no difference. No node-level work is needed for it.
//   - Sandboxed iframes: the <iframe> ELEMENT is in the light DOM and is seen
//     by checkNode; its inner document is a separate browsing context that the
//     parent's observer/queries never see. So iframe-internal DOM is invisible
//     too.
//   - Network: an OFF-ORIGIN iframe src DOES surface in the parent's Resource
//     Timing (performance "resource" entries, initiatorType "iframe"); that is
//     the ONE thing needing an explicit exemption below.
//
// checkNode still early-exits for any light-DOM node under a data-tm-embed
// marker (the iframe element, host, label strip) so a sanctioned boundary is
// never flagged for its own framing.

// Resolved src URLs of iframes sitting inside a sanctioned tm-embed boundary.
function sanctionedEmbedSrcs() {
  const set = new Set();
  const frames = document.querySelectorAll("[data-tm-embed] iframe[src]");
  for (const f of frames) {
    try {
      set.add(new URL(f.getAttribute("src"), location.href).href);
    } catch {
      // unresolved src, skip
    }
  }
  return set;
}

function checkNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  // Inside a tm-embed boundary: off the identity surface (sandboxed iframe or
  // shadow host). Its framing is sanctioned; do not audit it.
  if (node.closest && node.closest("[data-tm-embed]")) return;

  // border-radius check
  const style = getComputedStyle(node);
  const br = style.borderRadius;
  if (br && br !== "0px") {
    report("border-radius is " + br + " (must be 0px)", node);
  }

  // native control check
  const tag = node.tagName;
  if (BANNED_TAGS.has(tag)) {
    // dialog is allowed if it's the framework's own modal (class tm-modal)
    if (tag === "DIALOG" && node.classList.contains("tm-modal")) {
      // framework usage, allowed
    } else if (!isInsideFrameworkWrapper(node)) {
      report("banned native <" + tag.toLowerCase() + "> element", node);
    }
  }

  if (tag === "INPUT") {
    const type = (node.getAttribute("type") || "text").toLowerCase();
    if (BANNED_INPUT_TYPES.has(type) && !isInsideFrameworkWrapper(node)) {
      report("banned native <input type=\"" + type + "\"> outside framework wrapper", node);
    }
  }
}

function checkTree(root) {
  checkNode(root);
  if (root.querySelectorAll) {
    root.querySelectorAll("*").forEach(checkNode);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        checkTree(node);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Network load checker — detect external requests
// ---------------------------------------------------------------------------

function checkResourceEntries() {
  const sanctioned = sanctionedEmbedSrcs();
  const entries = performance.getEntriesByType("resource");
  for (const entry of entries) {
    // Only flag http/https entries that are not same-origin.
    if (!/^https?:/i.test(entry.name)) continue;
    try {
      const url = new URL(entry.name);
      if (url.origin !== location.origin) {
        // A foreign iframe src attributable to a sanctioned embed is allowed:
        // it is provably off the identity surface.
        if (sanctioned.has(url.href)) continue;
        report("external network load: " + entry.name);
      }
    } catch {
      // malformed URL, skip
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Activation
// ---------------------------------------------------------------------------

// Start observing once the DOM is ready.
function activate() {
  // Initial scan of the full document.
  checkTree(document.body);

  // Watch for future mutations.
  observer.observe(document.body, { childList: true, subtree: true });

  // Check resource loads periodically (PerformanceObserver for "resource"
  // is not universally supported; a periodic check is simpler and sufficient
  // for a dev aid).
  const seen = new Set();
  function pollResources() {
    const sanctioned = sanctionedEmbedSrcs();
    const entries = performance.getEntriesByType("resource");
    for (const entry of entries) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      if (!/^https?:/i.test(entry.name)) continue;
      try {
        const url = new URL(entry.name);
        if (url.origin !== location.origin) {
          // Exempt foreign iframe srcs attributable to a sanctioned embed.
          if (sanctioned.has(url.href)) continue;
          report("external network load: " + entry.name);
        }
      } catch {
        // malformed URL, skip
      }
    }
  }
  // Poll every 2 seconds for the lifetime of the page.
  const intervalId = setInterval(pollResources, 2000);
  // Also run once immediately.
  pollResources();

  // Expose a cleanup function for test teardown.
  window.__tmAuditorCleanup = () => {
    observer.disconnect();
    clearInterval(intervalId);
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", activate);
} else {
  activate();
}
