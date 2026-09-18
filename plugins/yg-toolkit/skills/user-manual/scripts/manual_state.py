#!/usr/bin/env python3
"""Track source-grounded user-manual baselines and calculate incremental impact."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


SCHEMA_VERSION = 1
DEFAULT_MANUAL_DIR = "docs/user-manual"
METADATA_DIR = ".repo-user-manual"
MAX_HASH_BYTES = 50 * 1024 * 1024
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
GLOB_CHARS = set("*?[")


class ManualStateError(RuntimeError):
    pass


def normalized_rel(value: str) -> str:
    normalized = value.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized


def resolve_repo(value: str) -> Path:
    repo = Path(value).expanduser().resolve()
    if not repo.is_dir():
        raise ManualStateError(f"Repository directory does not exist: {repo}")
    return repo


def resolve_manual_dir(repo: Path, value: str) -> tuple[Path, str]:
    candidate = Path(value).expanduser()
    manual = candidate.resolve() if candidate.is_absolute() else (repo / candidate).resolve()
    try:
        relative = manual.relative_to(repo).as_posix()
    except ValueError as exc:
        raise ManualStateError("Manual directory must stay inside the repository") from exc
    return manual, relative


def read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ManualStateError(f"Required file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ManualStateError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ManualStateError(f"Expected a JSON object in {path}")
    return data


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_sensitive_path(relative: str) -> bool:
    parts = [part.lower() for part in PurePosixPath(relative).parts]
    name = parts[-1] if parts else ""
    if name == ".env" or name.startswith(".env."):
        return True
    if name.endswith((".pem", ".key", ".p12", ".pfx")):
        return True
    return any(part in {"credentials", "credential", "secrets", "secret"} for part in parts)


def safe_file_hash(repo: Path, relative: str) -> str | None:
    relative = normalized_rel(relative)
    if not relative or is_sensitive_path(relative):
        return None
    path = (repo / relative).resolve()
    try:
        path.relative_to(repo)
    except ValueError:
        return None
    if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_HASH_BYTES:
        return None
    return sha256_file(path)


def load_coverage(path: Path) -> dict[str, Any]:
    coverage = read_json(path)
    if coverage.get("schemaVersion") != SCHEMA_VERSION:
        raise ManualStateError(f"coverage.json schemaVersion must be {SCHEMA_VERSION}")
    sections = coverage.get("sections")
    global_sources = coverage.get("globalSources", [])
    if not isinstance(sections, list) or not isinstance(global_sources, list):
        raise ManualStateError("coverage.json requires sections[] and optional globalSources[]")
    seen: set[str] = set()
    for section in sections:
        if not isinstance(section, dict):
            raise ManualStateError("Each coverage section must be an object")
        section_id = section.get("id")
        documents = section.get("documents")
        sources = section.get("sources")
        if not isinstance(section_id, str) or not section_id or section_id in seen:
            raise ManualStateError("Each coverage section requires a unique non-empty id")
        if not isinstance(documents, list) or not all(isinstance(item, str) for item in documents):
            raise ManualStateError(f"Section {section_id} requires documents[]")
        if not isinstance(sources, list) or not all(isinstance(item, str) for item in sources):
            raise ManualStateError(f"Section {section_id} requires sources[]")
        seen.add(section_id)
    if not all(isinstance(item, str) for item in global_sources):
        raise ManualStateError("globalSources entries must be strings")
    return coverage


def validate_pattern(pattern: str) -> str:
    normalized = normalized_rel(pattern)
    pure = PurePosixPath(normalized)
    if not normalized or pure.is_absolute() or ".." in pure.parts:
        raise ManualStateError(f"Unsafe repository-relative source pattern: {pattern}")
    return normalized


def all_source_patterns(coverage: dict[str, Any]) -> list[str]:
    patterns = list(coverage.get("globalSources", []))
    for section in coverage["sections"]:
        patterns.extend(section["sources"])
    return sorted({validate_pattern(item) for item in patterns})


def expand_source_patterns(repo: Path, manual_rel: str, patterns: Iterable[str]) -> tuple[list[str], list[str]]:
    files: set[str] = set()
    skipped: set[str] = set()
    manual_prefix = manual_rel.rstrip("/") + "/"
    for raw_pattern in patterns:
        pattern = validate_pattern(raw_pattern)
        literal = not any(char in pattern for char in GLOB_CHARS)
        literal_path = repo / Path(pattern)
        if literal and literal_path.is_dir():
            candidates = literal_path.rglob("*")
        elif literal:
            candidates = [literal_path]
        else:
            candidates = repo.glob(pattern)
        for candidate in candidates:
            try:
                relative = candidate.resolve().relative_to(repo).as_posix()
            except (OSError, ValueError):
                continue
            if relative.startswith(".git/") or relative.startswith(manual_prefix):
                continue
            if is_sensitive_path(relative):
                skipped.add(relative)
                continue
            if candidate.is_file() and not candidate.is_symlink():
                if candidate.stat().st_size <= MAX_HASH_BYTES:
                    files.add(relative)
                else:
                    skipped.add(relative)
    return sorted(files), sorted(skipped)


def hash_paths(repo: Path, paths: Iterable[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for relative in sorted(set(paths)):
        digest = safe_file_hash(repo, relative)
        if digest is not None:
            result[normalized_rel(relative)] = digest
    return result


def hash_manual_files(manual: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not manual.exists():
        return result
    metadata = manual / METADATA_DIR
    for path in sorted(manual.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        try:
            path.relative_to(metadata)
            continue
        except ValueError:
            pass
        if path.stat().st_size <= MAX_HASH_BYTES:
            result[path.relative_to(manual).as_posix()] = sha256_file(path)
    return result


def run_git(repo: Path, args: list[str], allow_failure: bool = False) -> bytes:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0 and not allow_failure:
        message = completed.stderr.decode("utf-8", errors="replace").strip()
        raise ManualStateError(f"Git command failed: {' '.join(args)}: {message}")
    return completed.stdout if completed.returncode == 0 else b""


def is_git_repo(repo: Path) -> bool:
    output = run_git(repo, ["rev-parse", "--is-inside-work-tree"], allow_failure=True)
    return output.strip() == b"true"


def git_text(repo: Path, args: list[str]) -> str | None:
    output = run_git(repo, args, allow_failure=True).decode("utf-8", errors="replace").strip()
    return output or None


def nul_paths(output: bytes) -> set[str]:
    return {
        normalized_rel(item.decode("utf-8", errors="surrogateescape"))
        for item in output.split(b"\0")
        if item
    }


def git_workspace_paths(repo: Path) -> set[str]:
    paths = set()
    paths |= nul_paths(run_git(repo, ["diff", "--name-only", "-z"], allow_failure=True))
    paths |= nul_paths(run_git(repo, ["diff", "--cached", "--name-only", "-z"], allow_failure=True))
    paths |= nul_paths(run_git(repo, ["ls-files", "--others", "--exclude-standard", "-z"], allow_failure=True))
    return paths


def git_info(repo: Path) -> dict[str, Any]:
    if not is_git_repo(repo):
        return {"vcs": "none", "head": None, "tree": None, "branch": None, "dirty": None}
    workspace = git_workspace_paths(repo)
    return {
        "vcs": "git",
        "head": git_text(repo, ["rev-parse", "HEAD"]),
        "tree": git_text(repo, ["rev-parse", "HEAD^{tree}"]),
        "branch": git_text(repo, ["branch", "--show-current"]),
        "dirty": bool(workspace),
    }


def path_matches(path: str, pattern: str) -> bool:
    path = normalized_rel(path)
    pattern = validate_pattern(pattern)
    if pattern.endswith("/**") and path.startswith(pattern[:-3].rstrip("/") + "/"):
        return True
    return fnmatch.fnmatchcase(path, pattern)


def current_hash_or_missing(repo: Path, path: str) -> str | None:
    return safe_file_hash(repo, path)


def changed_hash_paths(previous: dict[str, str], current: dict[str, str]) -> set[str]:
    keys = set(previous) | set(current)
    return {key for key in keys if previous.get(key) != current.get(key)}


def classify_manual_path(path: str, manual_rel: str) -> str | None:
    prefix = manual_rel.rstrip("/") + "/"
    if not path.startswith(prefix):
        return None
    relative = path[len(prefix) :]
    if relative == METADATA_DIR or relative.startswith(METADATA_DIR + "/"):
        return ""
    return relative


def create_plan(
    repo: Path,
    manual: Path,
    manual_rel: str,
    requested_language: str | None,
    requested_roles: list[str] | None,
    requested_product_scope: str | None,
) -> dict[str, Any]:
    metadata = manual / METADATA_DIR
    coverage = load_coverage(metadata / "coverage.json")
    state = read_json(metadata / "state.json")
    if state.get("schemaVersion") != SCHEMA_VERSION:
        raise ManualStateError(f"state.json schemaVersion must be {SCHEMA_VERSION}")
    coverage_hash = sha256_file(metadata / "coverage.json")
    coverage_changed = coverage_hash != state.get("coverageHash")

    saved_scope = state.get("scope", {})
    if not isinstance(saved_scope, dict):
        saved_scope = {}
    requested_scope = {
        "language": requested_language if requested_language is not None else saved_scope.get("language"),
        "roles": (requested_roles or ["*"]) if requested_roles is not None else saved_scope.get("roles"),
        "product": requested_product_scope if requested_product_scope is not None else saved_scope.get("product"),
    }
    scope_changed = requested_scope != {
        "language": saved_scope.get("language"),
        "roles": saved_scope.get("roles"),
        "product": saved_scope.get("product"),
    }

    patterns = all_source_patterns(coverage)
    source_files, skipped_sources = expand_source_patterns(repo, manual_rel, patterns)
    current_source_hashes = hash_paths(repo, source_files)
    previous_source_hashes = state.get("sourceHashes", {})
    if not isinstance(previous_source_hashes, dict):
        raise ManualStateError("state.json sourceHashes must be an object")
    source_hash_changes = changed_hash_paths(previous_source_hashes, current_source_hashes)

    repository = state.get("repository", {})
    baseline_head = repository.get("head") if isinstance(repository, dict) else None
    git_changed: set[str] = set()
    baseline_status = "hash-only"
    current_git = git_info(repo)
    if current_git["vcs"] == "git":
        baseline_status = "missing"
        if baseline_head:
            is_ancestor = subprocess.run(
                ["git", "-C", str(repo), "merge-base", "--is-ancestor", baseline_head, "HEAD"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            ).returncode == 0
            if is_ancestor:
                baseline_status = "ancestor"
                git_changed |= nul_paths(
                    run_git(repo, ["diff", "--name-only", "-z", f"{baseline_head}..HEAD"])
                )
            else:
                baseline_status = "diverged"
        git_changed |= git_workspace_paths(repo)

    previous_workspace_hashes = state.get("workspaceHashes", {})
    if not isinstance(previous_workspace_hashes, dict):
        previous_workspace_hashes = {}
    for path, previous_hash in previous_workspace_hashes.items():
        if current_hash_or_missing(repo, path) != previous_hash:
            git_changed.add(path)

    candidates = git_changed | source_hash_changes
    known_hashes = {**previous_source_hashes, **previous_workspace_hashes}
    code_changed: set[str] = set()
    manual_changed_from_git: set[str] = set()
    ignored_sensitive_count = 0
    for path in candidates:
        manual_path = classify_manual_path(path, manual_rel)
        if manual_path is not None:
            if manual_path:
                manual_changed_from_git.add(manual_path)
            continue
        if is_sensitive_path(path):
            ignored_sensitive_count += 1
            continue
        if path in known_hashes and current_hash_or_missing(repo, path) == known_hashes[path]:
            continue
        code_changed.add(path)

    current_manual_hashes = hash_manual_files(manual)
    previous_manual_hashes = state.get("manualHashes", {})
    if not isinstance(previous_manual_hashes, dict):
        previous_manual_hashes = {}
    manual_changed = changed_hash_paths(previous_manual_hashes, current_manual_hashes)
    manual_changed |= {
        path
        for path in manual_changed_from_git
        if path not in previous_manual_hashes
        or current_manual_hashes.get(path) != previous_manual_hashes.get(path)
    }

    section_ids = [section["id"] for section in coverage["sections"]]
    global_impact = any(
        path_matches(path, pattern)
        for path in code_changed
        for pattern in coverage.get("globalSources", [])
    )
    affected: set[str] = set(section_ids if global_impact else [])
    if coverage_changed or scope_changed:
        affected.update(section_ids)
    mapped_changed: set[str] = set()
    if global_impact:
        for path in code_changed:
            if any(path_matches(path, pattern) for pattern in coverage.get("globalSources", [])):
                mapped_changed.add(path)
    for section in coverage["sections"]:
        for path in code_changed:
            if any(path_matches(path, pattern) for pattern in section["sources"]):
                affected.add(section["id"])
                mapped_changed.add(path)
        for manual_path in manual_changed:
            if any(normalized_rel(document) == normalized_rel(manual_path) for document in section["documents"]):
                affected.add(section["id"])

    return {
        "schemaVersion": SCHEMA_VERSION,
        "baselineRevision": state.get("revision"),
        "baselineManualVersion": state.get("manualVersion"),
        "baselineGitStatus": baseline_status,
        "baselineHead": baseline_head,
        "currentHead": current_git.get("head"),
        "globalImpact": global_impact,
        "coverageChanged": coverage_changed,
        "scopeChanged": scope_changed,
        "savedScope": saved_scope,
        "requestedScope": requested_scope,
        "affectedSections": sorted(affected),
        "changedSourcePaths": sorted(code_changed),
        "unmappedChangedPaths": sorted(code_changed - mapped_changed),
        "manualChangedPaths": sorted(manual_changed),
        "skippedSourceCount": len(skipped_sources),
        "ignoredSensitivePathCount": ignored_sensitive_count,
        "requiresFullReconciliation": baseline_status in {"diverged", "missing"} or scope_changed,
    }


def create_snapshot(
    repo: Path,
    manual: Path,
    manual_rel: str,
    version: str,
    language: str,
    roles: list[str],
    product_scope: str,
    summary: str,
) -> dict[str, Any]:
    if not VERSION_RE.match(version):
        raise ManualStateError("--version must be a semantic version such as 1.0.0")
    if not (manual / "README.md").is_file():
        raise ManualStateError(f"Manual entry does not exist: {manual / 'README.md'}")
    metadata = manual / METADATA_DIR
    coverage_path = metadata / "coverage.json"
    coverage = load_coverage(coverage_path)
    patterns = all_source_patterns(coverage)
    source_files, skipped_sources = expand_source_patterns(repo, manual_rel, patterns)
    source_hashes = hash_paths(repo, source_files)
    current_git = git_info(repo)

    workspace_paths = git_workspace_paths(repo) if current_git["vcs"] == "git" else set()
    workspace_paths = {
        path
        for path in workspace_paths
        if classify_manual_path(path, manual_rel) is None and not is_sensitive_path(path)
    }
    workspace_hashes = hash_paths(repo, workspace_paths)

    state_path = metadata / "state.json"
    previous_revision = 0
    if state_path.exists():
        previous_state = read_json(state_path)
        previous_revision = int(previous_state.get("revision", 0))
    revision = previous_revision + 1
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    coverage_hash = sha256_file(coverage_path)
    manual_hashes = hash_manual_files(manual)
    fingerprint_payload = {
        "head": current_git.get("head"),
        "tree": current_git.get("tree"),
        "sourceHashes": source_hashes,
        "workspaceHashes": workspace_hashes,
        "coverageHash": coverage_hash,
    }
    fingerprint = sha256_bytes(
        json.dumps(fingerprint_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    state = {
        "schemaVersion": SCHEMA_VERSION,
        "manualVersion": version,
        "revision": revision,
        "generatedAt": generated_at,
        "summary": summary,
        "scope": {
            "language": language,
            "roles": roles or ["*"],
            "product": product_scope,
        },
        "repository": {
            "name": repo.name,
            **current_git,
            "fingerprint": fingerprint,
        },
        "coverageHash": coverage_hash,
        "sourceHashes": source_hashes,
        "workspaceHashes": workspace_hashes,
        "manualHashes": manual_hashes,
        "skippedSourceCount": len(skipped_sources),
    }
    write_json(state_path, state)
    timestamp = generated_at.replace(":", "-")
    run_path = metadata / "runs" / f"{revision:06d}-{timestamp}.json"
    if run_path.exists():
        raise ManualStateError(f"Run record already exists: {run_path}")
    write_json(run_path, state)
    return state


def emit(data: dict[str, Any], output: str | None) -> None:
    rendered = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if output:
        path = Path(output).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan = subparsers.add_parser("plan", help="Calculate changes since the saved manual baseline")
    plan.add_argument("--repo", required=True, help="Repository root")
    plan.add_argument("--manual-dir", default=DEFAULT_MANUAL_DIR, help="Manual directory inside repository")
    plan.add_argument("--language", help="Requested manual language; omission keeps the saved scope")
    plan.add_argument("--role", action="append", default=None, help="Requested role; repeat as needed, or use * for all roles")
    plan.add_argument("--product-scope", help="Requested product scope; omission keeps the saved scope")
    plan.add_argument("--output", help="Optional JSON output path")

    snapshot = subparsers.add_parser("snapshot", help="Record a reviewed manual baseline")
    snapshot.add_argument("--repo", required=True, help="Repository root")
    snapshot.add_argument("--manual-dir", default=DEFAULT_MANUAL_DIR, help="Manual directory inside repository")
    snapshot.add_argument("--version", required=True, help="User-facing manual semantic version")
    snapshot.add_argument("--language", default="zh-CN", help="Manual language")
    snapshot.add_argument("--role", action="append", default=[], help="Included role; repeat as needed")
    snapshot.add_argument("--product-scope", default="all", help="Product scope label")
    snapshot.add_argument("--summary", required=True, help="Short reviewed-result summary")
    snapshot.add_argument("--output", help="Optional JSON output path")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        repo = resolve_repo(args.repo)
        manual, manual_rel = resolve_manual_dir(repo, args.manual_dir)
        if args.command == "plan":
            result = create_plan(
                repo,
                manual,
                manual_rel,
                requested_language=args.language,
                requested_roles=args.role,
                requested_product_scope=args.product_scope,
            )
        else:
            result = create_snapshot(
                repo=repo,
                manual=manual,
                manual_rel=manual_rel,
                version=args.version,
                language=args.language,
                roles=args.role,
                product_scope=args.product_scope,
                summary=args.summary,
            )
        emit(result, args.output)
        return 0
    except (ManualStateError, OSError, ValueError) as exc:
        parser.exit(2, f"error: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
