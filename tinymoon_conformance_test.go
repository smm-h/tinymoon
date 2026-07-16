package tinymoon

// This file is the WORKED EXAMPLE of consuming tinymoon's portable conformance
// artifacts from a non-Python reimplementation. It is NOT a Go port of the
// checker -- full scanning is the shipped Python CLI (`uvx tinymoon check
// --dir <dir>`). What it demonstrates is the pattern a reimplementation uses to
// conformance-test ITSELF:
//
//  1. Load rules.json + expectations.json and the corpus from the embedded
//     asset tree (they ride the same //go:embed as every other shipped asset).
//  2. Implement one rule natively -- here title-attr, the simplest -- run it
//     over the corpus, and assert its findings match expectations EXACTLY for
//     that rule id. If a reimplementation of any rule agrees with the corpus
//     expectations, it conforms for that rule; if it drifts, this fails.
//
// The expectations are keyed by scan root (mirroring how the Python tests scan
// clean/, violations/, and each quarantine/* case) then by file path relative
// to that root, with a list of [line, rule-id] pairs.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"sort"
	"strings"
	"testing"
)

const (
	rulesPath        = "conformance/rules.json"
	expectationsPath = "conformance/expectations.json"
	corpusPrefix     = "conformance/corpus"
)

// finding is one [line, rule-id] pair from expectations.json. The JSON encodes
// it as a heterogeneous array, so it needs a custom unmarshaller.
type finding struct {
	Line int
	Rule string
}

func (f *finding) UnmarshalJSON(b []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	if len(raw) != 2 {
		return fmt.Errorf("expected [line, rule], got %d elements", len(raw))
	}
	if err := json.Unmarshal(raw[0], &f.Line); err != nil {
		return err
	}
	return json.Unmarshal(raw[1], &f.Rule)
}

type rulesDoc struct {
	Rules            []string `json:"rules"`
	BannedInputTypes []string `json:"banned_input_types"`
	BannedNativeTags []string `json:"banned_native_tags"`
}

type expectationsDoc struct {
	// root -> file (relative to root) -> ordered findings
	Roots map[string]map[string][]finding `json:"roots"`
}

func loadJSON(t *testing.T, name string, v any) {
	t.Helper()
	data, err := fs.ReadFile(FS(), name)
	if err != nil {
		t.Fatalf("read embedded %s: %v", name, err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("parse %s: %v", name, err)
	}
}

// TestConformanceArtifactsStructure validates that the rules and expectations
// artifacts load from the embedded FS, parse, and are internally coherent:
// every corpus file the expectations name is embedded, and every rule id the
// expectations use is declared in rules.json.
func TestConformanceArtifactsStructure(t *testing.T) {
	var rules rulesDoc
	loadJSON(t, rulesPath, &rules)
	if len(rules.Rules) == 0 {
		t.Fatal("rules.json declares no rule ids")
	}
	ruleSet := map[string]bool{}
	for _, r := range rules.Rules {
		ruleSet[r] = true
	}
	for _, want := range []string{"title-attr", "external-url", "unpinned-vendor"} {
		if !ruleSet[want] {
			t.Errorf("rules.json missing expected rule id %q", want)
		}
	}

	var exp expectationsDoc
	loadJSON(t, expectationsPath, &exp)
	if len(exp.Roots) == 0 {
		t.Fatal("expectations.json declares no scan roots")
	}

	for root, files := range exp.Roots {
		for file, findings := range files {
			// Every named corpus file must be present in the embedded FS.
			embedded := path.Join(corpusPrefix, root, file)
			if _, err := fs.Stat(FS(), embedded); err != nil {
				t.Errorf("expectations name %s/%s but it is not embedded: %v", root, file, err)
			}
			// Every rule id used must be a declared rule.
			for _, f := range findings {
				if !ruleSet[f.Rule] {
					t.Errorf("expectations use rule id %q (in %s/%s) absent from rules.json", f.Rule, root, file)
				}
			}
		}
	}

	// The whole corpus rides the embed, not just the files expectations name:
	// spot-check non-source provenance/allowlist files are embedded too.
	for _, p := range []string{
		"conformance/corpus/clean/tinymoon-allowlist.txt",
		"conformance/corpus/clean/third_party/PROVENANCE.toml",
	} {
		if _, err := fs.Stat(FS(), p); err != nil {
			t.Errorf("expected embedded corpus file %s: %v", p, err)
		}
	}
}

// TestGoTitleAttrConformance implements the title-attr rule (HTML variant)
// natively in Go and proves it agrees with the corpus expectations for every
// HTML fixture. This is the end-to-end demonstration: a reimplementation gains
// confidence in its own rule by running it over the shipped corpus.
//
// title-attr (HTML): the title= ATTRIBUTE is banned, but the SVG <title> child
// ELEMENT is fine, and any attribute inside a data-tm-embed subtree is waived
// (foreign, off the identity surface). The detector below reproduces exactly
// that scope -- deliberately small, not a general HTML parser.
func TestGoTitleAttrConformance(t *testing.T) {
	var exp expectationsDoc
	loadJSON(t, expectationsPath, &exp)

	const rule = "title-attr"
	checkedAny := false
	for root, files := range exp.Roots {
		for file, findings := range files {
			if !strings.HasSuffix(file, ".html") {
				continue // the Go example implements the HTML variant only
			}
			embedded := path.Join(corpusPrefix, root, file)
			data, err := fs.ReadFile(FS(), embedded)
			if err != nil {
				t.Fatalf("read %s: %v", embedded, err)
			}
			got := scanTitleAttrHTML(data)

			var want []int
			for _, f := range findings {
				if f.Rule == rule {
					want = append(want, f.Line)
				}
			}
			sort.Ints(want)

			if !equalInts(got, want) {
				t.Errorf("%s/%s: title-attr lines = %v, want %v", root, file, got, want)
			}
			checkedAny = true
		}
	}
	if !checkedAny {
		t.Fatal("no HTML corpus files were checked")
	}
}

// ---------------------------------------------------------------------------
// The tiny title-attr HTML detector (the reimplementation under test).
// ---------------------------------------------------------------------------

var (
	tagRE       = regexp.MustCompile(`(?s)<(/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>`)
	titleAttrRE = regexp.MustCompile(`(?i)(^|\s)title\s*=`)
	embedAttrRE = regexp.MustCompile(`(?i)(^|\s)data-tm-embed(\s|=|/|$)`)
	commentRE   = regexp.MustCompile(`(?s)<!--.*?-->`)
)

// HTML void elements never have an end tag and root no subtree.
var voidTags = map[string]bool{
	"area": true, "base": true, "br": true, "col": true, "embed": true,
	"hr": true, "img": true, "input": true, "link": true, "meta": true,
	"param": true, "source": true, "track": true, "wbr": true,
}

type openTag struct {
	name  string
	embed bool
}

// scanTitleAttrHTML returns the (sorted) line numbers carrying a banned title=
// attribute, waiving any inside a data-tm-embed subtree. Comments are blanked
// first so tag-like text in comments is never parsed.
func scanTitleAttrHTML(raw []byte) []int {
	src := blankComments(raw)
	var stack []openTag
	embedDepth := 0
	var lines []int

	for _, m := range tagRE.FindAllSubmatchIndex(src, -1) {
		slash := src[m[2]:m[3]]
		name := strings.ToLower(string(src[m[4]:m[5]]))
		attrs := src[m[6]:m[7]]

		if len(slash) > 0 { // end tag: unwind the stack to the match
			for i := len(stack) - 1; i >= 0; i-- {
				if stack[i].name == name {
					for _, ot := range stack[i:] {
						if ot.embed {
							embedDepth--
						}
					}
					stack = stack[:i]
					break
				}
			}
			continue
		}

		hasEmbed := embedAttrRE.Match(attrs)
		// The marked element's own attributes are waived too, so compute
		// suppression before pushing (mirrors checker.handle_starttag).
		suppressed := embedDepth > 0 || hasEmbed
		if !suppressed && titleAttrRE.Match(attrs) {
			lines = append(lines, lineAt(src, m[0]))
		}

		selfClosing := bytes.HasSuffix(bytes.TrimSpace(attrs), []byte("/"))
		if !selfClosing && !voidTags[name] {
			stack = append(stack, openTag{name: name, embed: hasEmbed})
			if hasEmbed {
				embedDepth++
			}
		}
	}
	sort.Ints(lines)
	return lines
}

// blankComments replaces <!-- ... --> spans with spaces, preserving newlines so
// line numbers stay correct.
func blankComments(src []byte) []byte {
	return commentRE.ReplaceAllFunc(src, func(m []byte) []byte {
		out := make([]byte, len(m))
		for i, c := range m {
			if c == '\n' {
				out[i] = '\n'
			} else {
				out[i] = ' '
			}
		}
		return out
	})
}

func lineAt(src []byte, off int) int {
	return bytes.Count(src[:off], []byte("\n")) + 1
}

func equalInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
