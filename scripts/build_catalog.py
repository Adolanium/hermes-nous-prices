"""Build unified packages from the root Desktop and Gateway sources.

Run with --check in CI to reject stale generated files. Unified packages use
Hermes updates so their UI and Gateway API update together.
"""
import argparse
import json
import re
from pathlib import Path
from catalog_policy import strip_updater


# Hermes Desktop reads a package's name from a `name:` line at the start of a line
# (detectPluginComponents in apps/desktop/electron/desktop-plugin-install.ts). A JSON
# manifest has no such line, so Desktop named the desktop half after the `catalog/`
# folder, and every package built this way collided in `desktop-plugins/catalog`.
DESKTOP_NAME = re.compile(r"""^name:\s*['"]?([^'"\n]+)['"]?\s*$""", re.M)


def manifest_yaml(manifest):
    """Block-style YAML with JSON scalars: dependency-free, and readable by Desktop."""
    for key, value in manifest.items():
        if isinstance(value, dict) or (isinstance(value, list) and any(isinstance(v, (dict, list)) for v in value)):
            raise ValueError(f"manifest_yaml writes flat values only; {key} is nested")
    text = "".join(f"{key}: {json.dumps(value)}\n" for key, value in manifest.items())
    match = DESKTOP_NAME.search(text)
    if not match or match.group(1).strip() != manifest["name"]:
        raise ValueError("Hermes Desktop would not read the package name from catalog/plugin.yaml")
    return text

ROOT = Path(__file__).resolve().parent.parent


def build(check=False):
    config = json.loads((ROOT / "catalog-package.json").read_text())
    dashboard = json.loads((ROOT / "dashboard/manifest.json").read_text())
    name = dashboard["name"]
    source = (ROOT / "plugin.js").read_text(encoding="utf-8")
    managed = strip_updater(source, "shared")
    manifest = {
        "name": name, "version": config["version"],
        "description": config["description"], "author": "Adolanium",
        "manifest_version": 1, "kind": "standalone",
        "provides_tools": [], "provides_hooks": [],
        "provides_middleware": [], "requires_env": [],
    }
    # The native manifest, dashboard API namespace and Desktop ID must agree.
    # The public catalog entry can independently be named hermes-nous-prices.
    outputs = {
        "catalog/plugin.yaml": manifest_yaml(manifest),
        "catalog/__init__.py": (ROOT / "__init__.py").read_text(encoding="utf-8"),
        "desktop/plugin.js": managed,
        "catalog/desktop/plugin.js": managed,
        "catalog/dashboard/manifest.json": json.dumps({**dashboard, "version": config["version"]}, indent=2) + "\n",
        "catalog/dashboard/plugin_api.py": (ROOT / "dashboard/plugin_api.py").read_text(encoding="utf-8"),
    }
    stale = []
    for filename, content in outputs.items():
        target = ROOT / filename
        if check:
            if not target.is_file() or target.read_text(encoding="utf-8") != content:
                stale.append(filename)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8", newline="\n")
    if stale:
        raise SystemExit("Run python scripts/build_catalog.py; stale files: " + ", ".join(stale))
    print("Unified packages verified" if check else "Unified packages built")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    build(parser.parse_args().check)
