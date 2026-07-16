// A `title` PROPERTY on a plain (non-DOM) object, written with BRACKET
// NOTATION, is legal: it is not an element tooltip, and the dot-based
// title-attr regex never matches bracket access. This pins the documented
// workaround for the plain-object `fields.title = x` false positive (see the
// title-attr section of the checker doctrine header).
const fields = {};
fields["title"] = "Chapter one";
const meta = { author: "x" };
meta["title"] = "A book";
export { fields, meta };
