// HTML numeric character references are NOT raw colors: the `#` belongs to the
// `&#` entity marker, not a `#RGB` literal. None of these fire raw-color.
const apos = "It&#039;s here";
const rsquo = "Ready&#8217;";
const nbsp = "a&#160;b";
export { apos, rsquo, nbsp };
