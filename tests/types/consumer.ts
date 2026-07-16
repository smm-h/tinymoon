// Type-consumer fixture. Imports EVERY named export from both published
// barrels through the package's own name (self-referencing), which forces
// TypeScript to resolve them via package.json "exports" + "types" conditions.
// A missing or misnamed type here is a compile error -- `tsc --noEmit` is the
// permanent guarantee that every export ships with a declaration.

// -- core barrel ("tinymoon") -------------------------------------------------

import {
  $,
  $$,
  el,
  ICONS,
  icon,
  registerIcons,
  renderMiniMd,
  ensureTooltip,
  hideTip,
  ensureHovercard,
  hideHovercard,
  toast,
  setToastErrorHook,
  openModal,
  createSelect,
  createEmbed,
  registerCtx,
  registerCtxFooter,
  showCtxMenu,
  hideCtxMenu,
  openPopover,
  closePopover,
  createSwitch,
  copyButton,
  kebabButton,
  createCheckbox,
  createRadio,
  createFileInput,
  createSegmented,
  createTabs,
  createDatePicker,
  cssVar,
  ensureRoot,
  placeBelow,
  registerCopyable,
  unregisterCopyable,
  getCopyData,
  mountShell,
} from "tinymoon";

// -- extras barrel ("tinymoon/extras") ----------------------------------------

import {
  api,
  post,
  createSettings,
  renderDocMd,
  createWikiView,
} from "tinymoon/extras";

// Reference every import so the fixture is a genuine consumer. `unknownRef`
// swallows values without exercising their behavior; the typed calls below do
// the real checking.
function ref(..._values: unknown[]): void {}
ref(
  $, $$, el, ICONS, icon, registerIcons, renderMiniMd, ensureTooltip, hideTip,
  ensureHovercard, hideHovercard, toast, setToastErrorHook, openModal,
  createSelect, createEmbed, registerCtx, registerCtxFooter, showCtxMenu, hideCtxMenu,
  openPopover, closePopover, createSwitch, copyButton, kebabButton,
  createCheckbox, createRadio, createFileInput, createSegmented, createTabs,
  createDatePicker, cssVar, ensureRoot, placeBelow, registerCopyable,
  unregisterCopyable, getCopyData, mountShell,
  api, post, createSettings, renderDocMd, createWikiView,
);

// -- exercise a handful of typed calls (core) ---------------------------------

const heading: HTMLElement = el("h1", "title", "Hello");
const found: Element | null = $("#root");
const many: Element[] = $$(".item");
const markup: string = renderMiniMd("**bold** and `code`");
toast("saved", "ok", { duration: 2000 });

const sw = createSwitch({
  label: "Dark mode",
  value: true,
  onChange: (v: boolean) => ref(v),
});
sw.set(false);
sw.destroy();

const mapEmbed = createEmbed({ mode: "iframe", label: "Map", src: "/map" });
mapEmbed.setSrc?.("/map?zoom=2");
mapEmbed.destroy();

// -- exercise a handful of typed calls (extras) -------------------------------

// api/post are generic over the response body.
async function fetchThings(): Promise<void> {
  const users = await api<{ id: number }[]>("/api/users");
  const created = await post<{ ok: boolean }>(
    "/api/users",
    { name: "x" },
    (msg: string, status: number, path: string) => ref(msg, status, path),
  );
  ref(users, created);
}
ref(fetchThings);

// createSettings is generic over its schema: get()/set() are key-checked and
// return/accept the schema's value type.
const settings = createSettings({
  storageKey: "tm-demo",
  defaults: { theme: "dark", compact: false },
});
settings.load();
const theme: string = settings.get("theme");
const compact: boolean = settings.get("compact");
settings.set("theme", "light");
settings.applyTheme();
ref(theme, compact);

const docBody: HTMLElement = renderDocMd("### Intro {#intro}\n\nHello.");
const wiki = createWikiView({
  route: "docs",
  sections: [{ id: "intro", title: "Intro", md: "Hello." }],
});
wiki.build();
wiki.refresh();
ref(heading, found, many, markup, docBody, wiki);
