// A numeric character reference is NOT a color (the &#039; below never fires),
// but a genuine hex color literal in the same file still fires raw-color.
const entity = "It&#039;s fine";
const real = "#0af";
export { entity, real };
