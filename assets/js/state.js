// tinymoon — state barrel: the L2 state story (store + bind + keyed
// reconciler). Import from "tinymoon/state" (npm) or "./state.js" (standalone).
// There is no declarative render layer by design — build the DOM once and
// mutate it in place; these helpers keep that mutation centralized.

export { createStore, bind, reconcile } from "./store.js";
