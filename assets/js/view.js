// tinymoon — createView: a factory for shell route views. It returns a
// contract-conforming view object ({root, built, build(), refresh(), setSub?})
// with `built` managed and an idempotent build, so consumers write only the
// interesting parts. Plain object views still work unchanged — createView is a
// convenience layer on top of the same contract the router already understands.
//
// build(ctx) and refresh(ctx) receive a ctx {root, setSub(text)}:
//   ctx.root       — the view's section element (assigned by the router before
//                    the first build; the same node for every callback)
//   ctx.setSub(t)  — write the shell's page-subtitle element (#tm-page-sub)
//                    without the consumer ever touching that node directly.
//
// The factory's own optional setSub(sub, ctx) is the DEEP-LINK handler (the
// view-contract setSub): it receives the deep-link tail before refresh() runs.
// Distinct from ctx.setSub, which writes the topbar subtitle.

import { setPageSub } from "./shell.js";

// createView({build, refresh?, setSub?}) → view object.
export function createView(opts) {
  if (!opts || typeof opts.build !== "function") {
    throw new Error("createView: build(ctx) is required");
  }
  const { build, refresh, setSub } = opts;
  // One ctx instance per view; ctx.root is filled in on first build.
  const ctx = { root: null, setSub: setPageSub };

  const view = {
    root: null,
    built: false,
    build() {
      if (this.built) return;
      this.built = true;
      ctx.root = this.root;
      build(ctx);
    },
    refresh() {
      if (refresh) refresh(ctx);
    },
  };
  if (setSub) view.setSub = (sub) => setSub(sub, ctx);
  return view;
}
