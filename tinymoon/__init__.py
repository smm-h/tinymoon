"""tinymoon — zero-dependency vanilla JS/CSS UI framework.

The Python package ships the framework's static assets (CSS, ES modules,
fonts) inside the wheel and exposes their location via assets_path().
"""

from importlib import resources
from pathlib import Path

__version__ = "0.7.0"

# THEME_BOOT_SNIPPET — the SAME inline pre-paint script exported from the JS
# settings module (assets/js/settings.js). A server-rendered page that serves
# tinymoon's assets from Python has no reason to import the JS module just to
# obtain this string, so the PyPI package exposes it directly. It is a plain
# constant, not a render helper: drop it into a <script> in <head>, before the
# stylesheets, to set <html data-theme> before the first paint (no light/dark
# flash). It assumes the default "tm-settings" storage key. A sync test asserts
# this string matches the JS export byte-for-byte, so the two can never drift.
THEME_BOOT_SNIPPET = (
    '(function(){try{var s=JSON.parse(localStorage.getItem("tm-settings")||"{}");'
    'var t=s.theme||"system";'
    'if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";'
    "document.documentElement.dataset.theme=t;}catch(e){}})();"
)


def assets_path() -> Path:
    """Return the directory containing the framework assets.

    The directory holds ``css/``, ``js/``, and ``fonts/``. The assets live
    in exactly one place per environment: an installed wheel force-includes
    them inside the package (``tinymoon/assets``); a source checkout keeps
    them at the repository root (``assets/``, next to the package). Raises
    FileNotFoundError if neither exists (broken install).
    """
    pkg = Path(str(resources.files("tinymoon")))
    installed = pkg / "assets"
    if installed.is_dir():
        return installed
    source = pkg.parent / "assets"
    if source.is_dir():
        return source
    raise FileNotFoundError(
        f"tinymoon assets directory not found at {installed} or {source}"
    )
