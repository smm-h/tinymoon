"""tinymoon — zero-dependency vanilla JS/CSS UI framework.

The Python package ships the framework's static assets (CSS, ES modules,
fonts) inside the wheel and exposes their location via assets_path().
"""

from importlib import resources
from pathlib import Path

__version__ = "0.0.1"


def assets_path() -> Path:
    """Return the directory containing the framework assets.

    The directory holds ``css/``, ``js/``, and ``fonts/``. Raises
    FileNotFoundError if the assets are missing (broken install).
    """
    path = Path(str(resources.files("tinymoon"))) / "assets"
    if not path.is_dir():
        raise FileNotFoundError(f"tinymoon assets directory not found at {path}")
    return path
