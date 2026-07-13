// Package tinymoon embeds the framework's shipped assets — plain CSS,
// native ES modules, and vendored fonts — and exposes them as an embed.FS
// and an http.Handler, so Go servers can serve the framework with zero
// external files.
package tinymoon

import (
	"embed"
	"io/fs"
	"net/http"
)

// Assets is the embedded asset tree, rooted at the repository root (paths
// start with "assets/").
//
//go:embed assets
var Assets embed.FS

// FS returns the asset tree rooted at the assets directory itself (paths
// like "css/tokens.css", "js/index.js", "fonts/...").
func FS() fs.FS {
	sub, err := fs.Sub(Assets, "assets")
	if err != nil {
		// Unreachable: "assets" is embedded above.
		panic(err)
	}
	return sub
}

// Handler serves the assets over HTTP. Mount it under a prefix with
// http.StripPrefix, e.g.:
//
//	mux.Handle("/tinymoon/", http.StripPrefix("/tinymoon/", tinymoon.Handler()))
func Handler() http.Handler {
	return http.FileServer(http.FS(FS()))
}
