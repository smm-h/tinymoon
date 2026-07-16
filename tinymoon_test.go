package tinymoon

import (
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
)

// requiredAssets are the shipped files that must always be embedded and
// non-empty. Paths are relative to the assets root exposed by FS().
var requiredAssets = []string{
	"css/tokens.css",
	"tokens.json",
	"css/base.css",
	"css/shell.css",
	"css/primitives.css",
	"css/widgets.css",
	"js/index.js",
	"fonts/ibm-plex-sans-latin.woff2",
	"fonts/space-grotesk-latin.woff2",
	"fonts/ibm-plex-mono-latin-400.woff2",
	"fonts/ibm-plex-mono-latin-500.woff2",
	// Portable conformance artifacts (rule data + corpus + expectations) must
	// ride the embed so a Go reimplementation can conformance-test itself.
	"conformance/rules.json",
	"conformance/expectations.json",
	"conformance/corpus/violations/title-attr.html",
	"conformance/corpus/clean/tinymoon-allowlist.txt",
	"conformance/corpus/clean/third_party/PROVENANCE.toml",
}

// TestEmbeddedAssetsExistAndNonEmpty verifies every required shipped asset is
// embedded via FS() and carries content (guards against an empty or missing
// vendored file slipping into a release).
func TestEmbeddedAssetsExistAndNonEmpty(t *testing.T) {
	fsys := FS()
	for _, name := range requiredAssets {
		data, err := fs.ReadFile(fsys, name)
		if err != nil {
			t.Errorf("required asset %q: %v", name, err)
			continue
		}
		if len(data) == 0 {
			t.Errorf("required asset %q is empty", name)
		}
	}
}

// TestHandlerServesTokensCSS verifies the HTTP handler serves a known asset
// with a 200 status and a non-empty body.
func TestHandlerServesTokensCSS(t *testing.T) {
	srv := httptest.NewServer(Handler())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/css/tokens.css")
	if err != nil {
		t.Fatalf("GET css/tokens.css: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET css/tokens.css: status %d, want %d", resp.StatusCode, http.StatusOK)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("reading css/tokens.css body: %v", err)
	}
	if len(body) == 0 {
		t.Fatal("css/tokens.css served an empty body")
	}
}
