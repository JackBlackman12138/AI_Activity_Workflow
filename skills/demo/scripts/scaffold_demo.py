#!/usr/bin/env python3
"""Copy the bundled dependency-free Web Demo starter into a new directory."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("destination", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    source = Path(__file__).resolve().parent.parent / "assets" / "web-demo-starter"
    destination = args.destination.resolve()
    if destination.exists() and any(destination.iterdir()) and not args.force:
        parser.error(f"destination is not empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, dirs_exist_ok=True)
    readme_template = destination / "README.template.md"
    if readme_template.exists():
        readme_template.rename(destination / "README.md")
    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
