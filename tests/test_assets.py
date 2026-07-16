from tinymoon import assets_path


def test_assets_path_exists():
    path = assets_path()
    assert path.is_dir()


def test_assets_path_contents():
    path = assets_path()
    assert (path / "css" / "tokens.css").is_file()
    assert (path / "css" / "base.css").is_file()
    assert (path / "css" / "shell.css").is_file()
    assert (path / "css" / "primitives.css").is_file()
    assert (path / "css" / "widgets.css").is_file()
    assert (path / "js" / "index.js").is_file()
    assert (path / "tokens.json").is_file()
    assert list((path / "fonts").glob("*.woff2"))


def test_conformance_artifacts_shipped():
    """The portable conformance artifacts (rule data, corpus, expectations)
    ship inside the assets tree so a reimplementation in any language can
    conformance-test itself against them."""
    conformance = assets_path() / "conformance"
    assert (conformance / "rules.json").is_file()
    assert (conformance / "expectations.json").is_file()
    corpus = conformance / "corpus"
    assert (corpus / "violations" / "title-attr.html").is_file()
    assert (corpus / "clean" / "tinymoon-allowlist.txt").is_file()
    assert (corpus / "clean" / "third_party" / "PROVENANCE.toml").is_file()
