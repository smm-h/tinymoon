"""tinymoon — zero-dependency vanilla JS/CSS UI framework.

The Python package ships the framework's static assets (CSS, ES modules,
fonts) inside the wheel and exposes their location via assets_path().
"""

from importlib import resources
from pathlib import Path

__version__ = "0.4.0"


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
