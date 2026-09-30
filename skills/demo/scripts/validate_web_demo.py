#!/usr/bin/env python3
"""Validate Web Demo structure, local references, syntax, and Git deploy integrity."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from shutil import which
from urllib.parse import unquote, urlsplit


REQUIRED = [
    "index.html",
    "styles.css",
    "src/main.js",
    "src/state.js",
    "src/game-engine.js",
    "src/components.js",
    "package.json",
    "server.js",
    ".nojekyll",
    "README.md",
    "Demo体验说明.md",
]

TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".md", ".svg"}
HTML_REFS = re.compile(r"(?:src|href)\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE)
CSS_REFS = re.compile(r"(?:url\(\s*['\"]?([^)'\"\s]+)|@import\s+['\"]([^'\"]+))", re.IGNORECASE)
JS_REFS = re.compile(
    r"(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]"
    r"|import\(\s*['\"]([^'\"]+)['\"]\s*\)"
)


def local_references(path: Path, text: str) -> list[str]:
    if path.suffix.lower() in {".html", ".svg"}:
        return HTML_REFS.findall(text)
    if path.suffix.lower() == ".css":
        return [first or second for first, second in CSS_REFS.findall(text)]
    if path.suffix.lower() == ".js":
        return [first or second for first, second in JS_REFS.findall(text)]
    return []


def resolve_local_reference(root: Path, source: Path, reference: str, errors: list[str]) -> Path | None:
    reference = unquote(reference.strip())
    if not reference or reference.startswith(("#", "data:", "blob:", "mailto:", "javascript:")):
        return None
    if source.suffix.lower() in {".css", ".js", ".ts", ".tsx", ".jsx"} and not reference.startswith(("./", "../", "/")):
        return None
    parsed = urlsplit(reference)
    if parsed.scheme or reference.startswith("//"):
        return None
    if parsed.path.startswith("/"):
        errors.append(f"root-absolute reference breaks GitHub project subpaths in {source.relative_to(root)}: {reference}")
        return None
    clean_path = parsed.path
    if not clean_path:
        return None
    candidate = (source.parent / clean_path).resolve()
    if candidate != root and root not in candidate.parents:
        errors.append(f"reference escapes project root in {source.relative_to(root)}: {reference}")
        return None
    if not candidate.is_file():
        errors.append(f"missing referenced file from {source.relative_to(root)}: {reference}")
        return None
    return candidate


def git_tracked_files(root: Path, files: set[Path], errors: list[str]) -> None:
    git = which("git")
    if not git:
        errors.append("--require-git-tracked requested but git is unavailable")
        return
    repo_result = subprocess.run(
        [git, "-C", str(root), "rev-parse", "--show-toplevel"], capture_output=True, text=True
    )
    if repo_result.returncode:
        errors.append("--require-git-tracked requested but project is not inside a Git repository")
        return
    repo_root = Path(repo_result.stdout.strip()).resolve()
    for path in sorted(files):
        relative = path.relative_to(repo_root).as_posix()
        result = subprocess.run(
            [git, "-C", str(repo_root), "ls-files", "--error-unmatch", "--", relative],
            capture_output=True,
            text=True,
        )
        if result.returncode:
            errors.append(f"not tracked by Git: {path.relative_to(root)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project", type=Path)
    parser.add_argument(
        "--require-git-tracked",
        action="store_true",
        help="fail when required or locally referenced deployment files are not tracked by Git",
    )
    args = parser.parse_args()
    root = args.project.resolve()
    errors: list[str] = []
    deploy_files: set[Path] = set()

    next_configs = [root / name for name in ("next.config.ts", "next.config.mjs", "next.config.js")]
    next_config = next((path for path in next_configs if path.is_file()), None)
    is_next = next_config is not None and (root / "app" / "page.tsx").is_file()
    required = (
        ["app/page.tsx", "app/layout.tsx", "package.json", "deno.json"]
        if is_next
        else REQUIRED
    )

    for relative in required:
        path = root / relative
        if not path.is_file():
            errors.append(f"missing: {relative}")
        else:
            deploy_files.add(path.resolve())

    ignored_dirs = {".git", "node_modules", ".next", "dist", ".wrangler"}
    for path in root.rglob("*") if root.exists() else []:
        relative_parts = path.relative_to(root).parts
        if not path.is_file() or ignored_dirs.intersection(relative_parts) or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            errors.append(f"invalid UTF-8 in {path.relative_to(root)}: {exc}")
            continue
        if "file://" in text or re.search(r"[A-Za-z]:\\Users\\", text):
            errors.append(f"absolute local path in {path.relative_to(root)}")
        for reference in local_references(path, text):
            resolved = resolve_local_reference(root, path, reference, errors)
            if resolved:
                deploy_files.add(resolved)

    package_path = root / "package.json"
    if package_path.is_file():
        try:
            package = json.loads(package_path.read_text(encoding="utf-8"))
            if is_next:
                build_script = package.get("scripts", {}).get("build", "")
                dependencies = {**package.get("dependencies", {}), **package.get("devDependencies", {})}
                if "next build" not in build_script:
                    errors.append("Next.js package.json scripts.build must execute 'next build'")
                if "next" not in dependencies:
                    errors.append("Next.js project must explicitly depend on 'next'")
            elif package.get("scripts", {}).get("start") != "node server.js":
                errors.append("package.json scripts.start must be 'node server.js'")
        except json.JSONDecodeError as exc:
            errors.append(f"invalid package.json: {exc}")

    if is_next and next_config:
        config_text = next_config.read_text(encoding="utf-8")
        if not re.search(r"output\s*:\s*['\"]standalone['\"]", config_text):
            errors.append(f"{next_config.name} must set output: 'standalone' for Deno Next.js")
        deploy_path = root / "deno.json"
        if deploy_path.is_file():
            try:
                deploy = json.loads(deploy_path.read_text(encoding="utf-8"))
                if deploy.get("deploy", {}).get("framework") != "nextjs":
                    errors.append("deno.json deploy.framework must be 'nextjs'")
            except json.JSONDecodeError as exc:
                errors.append(f"invalid deno.json: {exc}")
        build_dir = root / ".next"
        if build_dir.exists():
            for relative in (".next/standalone/package.json", ".next/standalone/server.js"):
                if not (root / relative).is_file():
                    errors.append(f"missing Deno Next.js standalone artifact: {relative}")

    node = which("node")
    if node and not is_next:
        for path in [root / "server.js", *(root / "src").glob("*.js")]:
            if path.is_file():
                result = subprocess.run([node, "--check", str(path)], capture_output=True, text=True)
                if result.returncode:
                    errors.append(f"JavaScript syntax error in {path.relative_to(root)}: {result.stderr.strip()}")

    if args.require_git_tracked:
        git_tracked_files(root, deploy_files, errors)

    if errors:
        print("Validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    mode = "Deno Next.js standalone" if is_next else "static Web Demo"
    print(f"{mode} structure and {len(deploy_files)} deployment references validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
