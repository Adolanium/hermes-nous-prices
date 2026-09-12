"""Build unified packages from the root Desktop and Gateway sources.

Run with --check in CI to reject stale generated files. Unified packages use
Hermes updates so their UI and Gateway API update together.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build(check=False):
    config = json.loads((ROOT / "catalog-package.json").read_text())
    dashboard = json.loads((ROOT / "dashboard/manifest.json").read_text())
    name = dashboard["name"]
    message = f"This package uses Hermes updates. Run hermes plugins update {name}, then rescan Desktop plugins and restart the Gateway."
    source = (ROOT / "plugin.js").read_text(encoding="utf-8")
    start = "  async function run(action = 'check') {"
    end = "  function register(ctx) {"
    if source.count(start) != 1 or source.count(end) != 1:
        raise ValueError("Updater structure changed; review package update handling before releasing")
    first, last = source.index(start), source.index(end)
    if last <= first:
        raise ValueError("Unexpected updater function order")
    replacement = "  async function run() {\n    patch({ open: true, busy: false, offer: null, error: '', message: " + json.dumps(message) + " });\n  }\n"
    managed = source[:first] + replacement + source[last:]
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
        "catalog/plugin.yaml": json.dumps(manifest, indent=2) + "\n",
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
