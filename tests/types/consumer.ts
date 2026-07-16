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
  createInput,
  createTextarea,
  createField,
  createNumber,
  createSlider,
  createDatePicker,
  createTimePicker,
  createCombobox,
  createMultiSelect,
  createAccordion,
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

// -- state barrel ("tinymoon/state") ------------------------------------------

import {
  createStore,
  bind as bindStore,
  reconcile,
} from "tinymoon/state";

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
  createInput, createTextarea, createField, createNumber, createSlider,
  createDatePicker, createTimePicker, createCombobox, createMultiSelect,
  createAccordion, cssVar, ensureRoot, placeBelow, registerCopyable,
  unregisterCopyable, getCopyData, mountShell,
  api, post, createSettings, renderDocMd, createWikiView,
  createStore, bindStore, reconcile,
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

const nameInput = createInput({
  name: "username",
  label: "Username",
  type: "text",
  required: true,
  onInput: (v: string) => ref(v),
});
const nameValue: string = nameInput.value;
nameInput.set("ada");
nameInput.focus();
nameInput.setError("Taken");
nameInput.setError(null);
ref(nameValue, nameInput.get());

const bio = createTextarea({ name: "bio", label: "Bio", rows: 4 });
bio.set("hello");
bio.destroy();

const volume = createSlider({
  name: "volume",
  label: "Volume",
  min: 0,
  max: 100,
  value: 40,
  onInput: (v: number) => ref(v),
  onChange: (v: number) => ref(v),
});
const vol: number = volume.value;
volume.set(80);
ref(vol, volume.get());

const volField = createField({ label: "Volume", control: volume, hint: "0–100" });
volField.setError("Too loud");
volField.setError(null);
ref(volField.el);

const qty = createNumber({
  name: "qty",
  label: "Quantity",
  min: 0,
  max: 10,
  step: 1,
  value: 2,
  onChange: (v: string) => ref(v),
});
qty.set("3");
qty.setError("Too many");
qty.setError(null);
ref(qty.value, qty.get());

const start = createTimePicker({
  name: "start",
  label: "Start time",
  value: "09:30",
  minuteStep: 15,
  onChange: (v: string) => ref(v),
});
start.set("14:00");
const startVal: string | null = start.value;
ref(startVal);

const country = createCombobox({
  name: "country",
  label: "Country",
  freeText: false,
  onFilter: (q: string) => Promise.resolve([{ value: "us", label: "United States" }].filter((i) => i.label.includes(q))),
  onChange: (v: string | null) => ref(v),
});
country.set("us", "United States");
const countryVal: string | null = country.get();
ref(countryVal, country.value);

const tags = createMultiSelect({
  name: "tags",
  label: "Tags",
  items: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
  values: ["a"],
  onChange: (vs: string[]) => ref(vs),
});
tags.setValues(["a", "b"]);
const tagVals: string[] = tags.values;
ref(tagVals);

const acc = createAccordion({
  items: [
    { title: "One", body: "first" },
    { title: "Two", body: el("div", null, "second"), open: true },
  ],
  multi: false,
});
acc.open(0);
acc.close(1);
acc.toggle(0);
ref(acc.el);

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

// -- exercise a handful of typed calls (state) --------------------------------

const store = createStore({ count: 0, label: "idle" });
const count: number = store.get("count");
store.set("count", 1);
store.update("count", (n: number) => n + 1);
const off = store.subscribe("count", (value: number, prev: number, key: "count" | "label") => ref(value, prev, key));
off();
const offAny = store.subscribe(null, (value, prev, key) => ref(value, prev, key));
offAny();
const doubled = store.select((snap) => snap.count * 2);
const doubledNow: number = doubled.get();
const offSel = doubled.subscribe((p: number) => ref(p));
offSel();
const snap = store.snapshot();
ref(count, doubledNow, snap.label);

// bind a store key to a widget's .set(v); unbind on teardown.
const boundVolume = createSlider({ name: "vol", label: "Vol", min: 0, max: 100, value: 0 });
const unbindVolume = bindStore(createStore({ vol: 10 }), "vol", boundVolume);
unbindVolume();

// reconcile a keyed list into a container.
const listHost: HTMLElement = el("div");
const nodes = reconcile(
  listHost,
  [{ id: "a", label: "A" }, { id: "b", label: "B" }],
  (item) => item.id,
  {
    create: (item) => el("div", "row", item.label),
    update: (node, item) => { node.textContent = item.label; },
    remove: (node, item) => ref(node, item),
  },
);
ref(nodes);

const docBody: HTMLElement = renderDocMd("### Intro {#intro}\n\nHello.");
const wiki = createWikiView({
  route: "docs",
  sections: [{ id: "intro", title: "Intro", md: "Hello." }],
});
wiki.build();
wiki.refresh();
ref(heading, found, many, markup, docBody, wiki);
