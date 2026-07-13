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
    assert (path / "js" / "index.js").is_file()
    assert list((path / "fonts").glob("*.woff2"))
