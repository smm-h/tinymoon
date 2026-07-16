// tinymoon — createEmbed: the isolation boundary primitive.
//
// Wraps a FOREIGN surface in an explicit, statically-recognizable container so
// it lives OFF the framework's identity surface. The container carries the
// static marker attribute data-tm-embed and the class tm-embed -- the exact
// marker the conformance checker keys on to waive the wrapped HTML subtree,
// and the runtime auditor keys on to exempt sanctioned embed loads/nodes.
//
// Factory: createEmbed(opts) -> { el, ...methods, destroy() }
//
// Two EXPLICIT modes (no default -- the caller must choose, matching the
// framework's mandatory-choice philosophy):
//
//   mode: "iframe"  -- a sandboxed <iframe> for a foreign NETWORK SURFACE
//     (maps, dashboards, OAuth pages). The sandbox attribute is present by
//     default (restrictive); relax specific capabilities by passing the exact
//     token list via opts.sandbox.
//       opts.src       (string, optional)   the foreign URL
//       opts.sandbox   (string[], optional) sandbox tokens; REPLACES the
//                        default baseline when given. Pass [] for a fully
//                        locked frame.
//       opts.allow     (string, optional)   Permissions-Policy allow= list
//
//   mode: "shadow"  -- a shadow root hosting foreign DOM/CSS (vendored library
//     UI). CLOSED in production so app code cannot reach in. A TEST-ONLY seam,
//     opts.openForTest, switches to an OPEN root and exposes .shadowRoot so
//     tests can assert isolation. Never set openForTest in application code.
//       opts.content     (string | Node, optional) initial foreign content
//       opts.openForTest (boolean, optional, TEST-ONLY)
//
// Common opts:
//   opts.label      (string, REQUIRED)  a human name for the foreign region.
//                     Hard-throws when absent (house a11y convention). Applied
//                     as aria-label on the container (role="group") and, in
//                     iframe mode, as the iframe's accessible name (never a
//                     title= attribute, which the charter bans).
//   opts.showLabel  (boolean, default true) render the visible label strip.
//
// destroy() detaches the container and, for iframes, clears src to stop the
// foreign context.

import { el } from "./dom.js";

// Restrictive-but-usable default sandbox for iframe mode. Present by default;
// callers relax by passing the exact token list via opts.sandbox. Notably it
// omits allow-same-origin, so the framed document is a unique opaque origin
// and cannot reach the embedder's storage or DOM.
const DEFAULT_SANDBOX = ["allow-scripts", "allow-forms", "allow-popups"];

export function createEmbed(opts) {
  opts = opts || {};
  if (!opts.label) throw new Error("createEmbed: label is required");
  const mode = opts.mode;
  if (mode !== "iframe" && mode !== "shadow") {
    throw new Error('createEmbed: mode must be "iframe" or "shadow" (no default)');
  }

  // The statically-recognizable boundary marker: attribute + class.
  const root = el("div", "tm-embed");
  root.setAttribute("data-tm-embed", mode);
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", opts.label);

  if (opts.showLabel !== false) {
    root.appendChild(el("div", "tm-embed-label", opts.label));
  }

  const body = el("div", "tm-embed-body");
  root.appendChild(body);

  return mode === "iframe"
    ? _iframeEmbed(opts, root, body)
    : _shadowEmbed(opts, root, body);
}

function _iframeEmbed(opts, root, body) {
  const frame = el("iframe", "tm-embed-frame");
  const tokens = Array.isArray(opts.sandbox) ? opts.sandbox : DEFAULT_SANDBOX;
  frame.setAttribute("sandbox", tokens.join(" "));
  if (opts.allow) frame.setAttribute("allow", opts.allow);
  frame.setAttribute("aria-label", opts.label);
  if (opts.src) frame.setAttribute("src", opts.src);
  body.appendChild(frame);

  let destroyed = false;
  return {
    el: root,
    mode: "iframe",
    frame,
    setSrc(url) {
      if (!destroyed) frame.setAttribute("src", url);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      frame.removeAttribute("src");
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

function _shadowEmbed(opts, root, body) {
  const openForTest = opts.openForTest === true;
  // CLOSED in production; the open root is a TEST-ONLY seam.
  const shadow = body.attachShadow({ mode: openForTest ? "open" : "closed" });

  const apply = (content) => {
    if (typeof content === "string") shadow.innerHTML = content;
    else if (content instanceof Node) shadow.replaceChildren(content);
    else shadow.replaceChildren();
  };
  if (opts.content !== undefined) apply(opts.content);

  let destroyed = false;
  const instance = {
    el: root,
    mode: "shadow",
    setContent(content) {
      if (!destroyed) apply(content);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shadow.replaceChildren();
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
  // TEST-ONLY: expose the shadow root only when explicitly opened for tests,
  // so a test can assert style/DOM isolation across the boundary. Production
  // code never sets openForTest, so instance.shadowRoot stays undefined.
  if (openForTest) instance.shadowRoot = shadow;
  return instance;
}
