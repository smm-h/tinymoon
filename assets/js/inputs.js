// tinymoon — styled-native text controls. createInput / createTextarea wrap a
// real, visible native <input>/<textarea> (native IME, autofill, spellcheck,
// and accessibility all stay intact) styled by the shared-controls CSS.
// createField is the layout wrapper that gives any control a labeled `.field`
// with an optional hint line and an inline validation error.
//
// Validation stance: native constraint validation (required / pattern / type)
// plus the setError affordance below. There is deliberately no validation
// framework -- callers own their own validity logic and call setError.
//
// Written plainly: the conformance checker exempts native-element creation in
// tinymoon's own shipped modules (framework-own allowance, keyed on the file's
// location inside the packaged assets, not on any obfuscation).

import { el } from "./dom.js";

// Text-like input types createInput accepts. checkbox / radio / file / range /
// number / time / date all have (or will get) dedicated factories and are a
// hard error here -- routing them through createInput would bypass those.
const ALLOWED_TYPES = new Set(["text", "password", "email", "url", "search", "tel"]);

let idCounter = 0;
function nextId(prefix) {
  return prefix + "-" + (++idCounter);
}

// Build the shared `.field` scaffold (a labeled column) around a native text
// control, then return the createInput/createTextarea instance. `control` is
// the <input> or <textarea>; it already carries id, name, and class.
function wireTextField(control, field, opts) {
  const errorId = control.id + "-error";
  let errorNode = null;

  const handlers = [];
  function listen(ev, fn) {
    control.addEventListener(ev, fn);
    handlers.push([ev, fn]);
  }
  if (opts.onChange) listen("change", (e) => opts.onChange(control.value, e));
  if (opts.onInput) listen("input", (e) => opts.onInput(control.value, e));

  function setError(msg) {
    if (msg == null || msg === "") {
      if (errorNode && errorNode.parentNode) errorNode.parentNode.removeChild(errorNode);
      errorNode = null;
      control.removeAttribute("aria-invalid");
      control.removeAttribute("aria-describedby");
      return;
    }
    if (!errorNode) {
      errorNode = el("div", "field-error");
      errorNode.id = errorId;
      errorNode.setAttribute("role", "alert");
      field.appendChild(errorNode);
    }
    errorNode.textContent = msg;
    control.setAttribute("aria-invalid", "true");
    control.setAttribute("aria-describedby", errorId);
  }

  function destroy() {
    for (const [ev, fn] of handlers) control.removeEventListener(ev, fn);
    if (field.parentNode) field.parentNode.removeChild(field);
  }

  return {
    el: field,
    get value() { return control.value; },
    set(v) { control.value = v == null ? "" : String(v); },
    get() { return control.value; },
    focus() { control.focus(); },
    setError,
    destroy,
  };
}

// createInput({name, label, type?, value?, placeholder?, required?, pattern?,
//   disabled?, onChange?, onInput?}) -> {el, value (getter), set(v), get(),
//   focus(), setError(msg|null), destroy()}.
// Wraps a real, visible <input>. name + label are required (hard error). The
// label is a real <label for> (fields are labeled controls -- never aria-label).
export function createInput(opts) {
  if (!opts || !opts.name) throw new Error("createInput: name is required");
  if (!opts.label) throw new Error("createInput: label is required");
  const type = opts.type || "text";
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(
      "createInput: type " + JSON.stringify(type) + " is not allowed -- use one of " +
      Array.from(ALLOWED_TYPES).join(", ") +
      " (checkbox/radio/file/range/number/time/date have dedicated factories)",
    );
  }

  const id = nextId("tm-input");
  const field = el("div", "field");

  const labelEl = el("label", null, opts.label);
  labelEl.setAttribute("for", id);

  const input = el("input", "tm-input");
  input.type = type;
  input.id = id;
  input.name = opts.name;
  if (opts.value !== undefined) input.value = opts.value;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.required) input.required = true;
  if (opts.pattern) input.pattern = opts.pattern;
  if (opts.disabled) input.disabled = true;

  field.appendChild(labelEl);
  field.appendChild(input);

  return wireTextField(input, field, opts);
}

// createTextarea({name, label, value?, placeholder?, required?, rows?,
//   disabled?, onChange?, onInput?}) -> same contract as createInput, minus
// `type`, plus `rows`.
export function createTextarea(opts) {
  if (!opts || !opts.name) throw new Error("createTextarea: name is required");
  if (!opts.label) throw new Error("createTextarea: label is required");

  const id = nextId("tm-textarea");
  const field = el("div", "field");

  const labelEl = el("label", null, opts.label);
  labelEl.setAttribute("for", id);

  const textarea = el("textarea", "tm-textarea");
  textarea.id = id;
  textarea.name = opts.name;
  if (opts.value !== undefined) textarea.value = opts.value;
  if (opts.placeholder) textarea.placeholder = opts.placeholder;
  if (opts.required) textarea.required = true;
  if (opts.rows) textarea.rows = opts.rows;
  if (opts.disabled) textarea.disabled = true;

  field.appendChild(labelEl);
  field.appendChild(textarea);

  return wireTextField(textarea, field, opts);
}

// createField({label, control, hint?, id?}) -> {el, setError(msg|null),
//   destroy()}.
// The layout wrapper for composing a labeled `.field` around any control that
// does not label itself (a createSlider, a createSelect, a raw element, etc.).
// `control` is a factory instance ({el}) or a raw HTMLElement. createField owns
// the label/id/for wiring: it targets the first labelable descendant, minting
// an id only when the control does not already carry one. It does NOT own the
// control's lifecycle -- callers still destroy the control they created.
export function createField(opts) {
  if (!opts || !opts.label) throw new Error("createField: label is required");
  if (!opts.control) throw new Error("createField: control is required");

  const controlEl = opts.control instanceof HTMLElement ? opts.control : opts.control.el;
  if (!(controlEl instanceof HTMLElement)) {
    throw new Error("createField: control must be an element or a factory instance with an .el");
  }

  const LABELABLE = "input, textarea, select";
  const focusable = controlEl.matches(LABELABLE) ? controlEl : controlEl.querySelector(LABELABLE);

  const field = el("div", "field");
  const labelEl = el("label", null, opts.label);

  let id = opts.id || (focusable && focusable.id);
  if (!id) {
    id = nextId("tm-field");
    if (focusable) focusable.id = id;
  }
  if (focusable) labelEl.setAttribute("for", id);

  field.appendChild(labelEl);
  field.appendChild(controlEl);

  let hintId = null;
  if (opts.hint) {
    hintId = id + "-hint";
    const hint = el("div", "field-hint", opts.hint);
    hint.id = hintId;
    field.appendChild(hint);
    if (focusable) focusable.setAttribute("aria-describedby", hintId);
  }

  const errorId = id + "-error";
  let errorNode = null;
  function setError(msg) {
    if (msg == null || msg === "") {
      if (errorNode && errorNode.parentNode) errorNode.parentNode.removeChild(errorNode);
      errorNode = null;
      if (focusable) {
        focusable.removeAttribute("aria-invalid");
        if (hintId) focusable.setAttribute("aria-describedby", hintId);
        else focusable.removeAttribute("aria-describedby");
      }
      return;
    }
    if (!errorNode) {
      errorNode = el("div", "field-error");
      errorNode.id = errorId;
      errorNode.setAttribute("role", "alert");
      field.appendChild(errorNode);
    }
    errorNode.textContent = msg;
    if (focusable) {
      focusable.setAttribute("aria-invalid", "true");
      focusable.setAttribute("aria-describedby", hintId ? hintId + " " + errorId : errorId);
    }
  }

  function destroy() {
    if (field.parentNode) field.parentNode.removeChild(field);
  }

  return { el: field, setError, destroy };
}
