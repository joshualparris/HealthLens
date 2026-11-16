#!/usr/bin/env python3
"""Unattended, fail-closed Dependabot PATCH repairs on this one authorised repo.

The GitHub-hosted schedule operates without ChatGPT. Never runs pull-request
code. Public OSV advisory archive is downloaded BEFORE reading private
lockfile contents; Docker scans lockfiles with --network none.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile

IMAGE = "ghcr.io/google/osv-scanner@sha256:a70ffffc2bfd33482953e5d6b64c6fcdb30239717a07b0f0d3ab2859ce3e4cde"
MAX_LOCK_BYTES = 20_000_000
TITLE = re.compile(r"\bbump\s+(\S+)\s+from\s+(\d+\.\d+\.\d+)\s+to\s+(\d+\.\d+\.\d+)\s*$", re.I)
ALLOWED_FILES = {"package-lock.json", "package.json"}
SAFE_RESULTS = {"success", "neutral", "skipped"}


def parse_patch_title(title):
    if not isinstance(title, str) or "group" in title.lower():
        return None
    match = TITLE.search(title)
    if not match:
        return None
    name, before, after = match.groups()
    if name.startswith("-") or name in (".", "..") or "/" in name.replace("@", "", 1) and not name.startswith("@"):
        return None
    a = tuple(int(x) for x in before.split("."))
    b = tuple(int(x) for x in after.split("."))
    if a[:2] != b[:2] or b[2] <= a[2]:
        return None
    return {"name": name, "from": before, "to": after}


def allowed_pr(pr, repo, files):
    if pr.get("user", {}).get("login") != "dependabot[bot]":
        return False, "not Dependabot"
    if pr.get("state") != "open" or pr.get("draft"):
        return False, "not an open reviewable PR"
    if pr.get("base", {}).get("ref") != "main":
        return False, "not targeting main"
    if pr.get("head", {}).get("repo", {}).get("full_name") != repo:
        return False, "unexpected source repository"
    if not pr.get("head", {}).get("ref", "").startswith("dependabot/"):
        return False, "unexpected source branch"
    if pr.get("mergeable") is not True:
        return False, "GitHub has not confirmed mergeability"
    bump = parse_patch_title(pr.get("title"))
    if not bump:
        return False, "not one simple patch-level npm update"
    paths = {item.get("filename") for item in files}
    if not files or any(item.get("status") != "modified" for item in files):
        return False, "new, renamed or deleted file"
    if not paths.issubset(ALLOWED_FILES) or "package-lock.json" not in paths:
        return False, "changes outside root npm manifests"
    return True, bump


def ci_green(checks, statuses, required_name):
    if not isinstance(checks, dict) or checks.get("total_count", 0) > 100:
        return False
    rows = checks.get("check_runs") or []
    if not rows or not any(x.get("name") == required_name and
                           x.get("conclusion") == "success" for x in rows):
        return False
    if any(x.get("status") != "completed" or
           x.get("conclusion") not in SAFE_RESULTS for x in rows):
        return False
    states = (statuses or {}).get("statuses") or []
    return all(s.get("state") == "success" for s in states)


def locked_versions(text, package):
    data = json.loads(text)
    matches = []
    for key, info in (data.get("packages") or {}).items():
        if not isinstance(info, dict) or "node_modules/" not in key:
            continue
        name = key.rsplit("node_modules/", 1)[-1]
        if name == package and isinstance(info.get("version"), str):
            matches.append(info["version"])
    return sorted(set(matches))


def advisories_for(results, package):
    ids = set()
    for src in results.get("results", []):
        for entry in src.get("packages", []):
            if entry.get("package", {}).get("name") != package:
                continue
            ids.update(v.get("id") for v in entry.get("vulnerabilities", [])
                       if isinstance(v, dict) and isinstance(v.get("id"), str))
            for group in entry.get("groups", []):
                ids.update(x for x in group.get("ids", []) if isinstance(x, str))
    return ids


def api(repo, path, token, method="GET", body=None):
    req = urllib.request.Request(
        "https://api.github.com/repos/" + repo + "/" + path,
        data=(json.dumps(body).encode() if body is not None else None),
        headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "autopatch-standalone-v1"},
        method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        value = resp.read()
        return json.loads(value) if value else {}


def git_blob(sha, path):
    # Only git protocol data is read. No npm install, build, eval or PR code.
    subprocess.run(["git", "fetch", "--quiet", "--no-tags", "--depth=1", "origin", sha],
                   check=True, timeout=90, capture_output=True)
    data = subprocess.run(["git", "show", sha + ":" + path], check=True,
                          timeout=20, capture_output=True).stdout
    if not data or len(data) > MAX_LOCK_BYTES:
        raise ValueError("missing or oversized exact lockfile")
    return data


def public_db(directory):
    dest = directory / "osv-scalibr" / "npm" / "all.zip"
    dest.parent.mkdir(parents=True)
    tmp = dest.with_suffix(".partial")
    try:
        urllib.request.urlretrieve(
            "https://osv-vulnerabilities.storage.googleapis.com/npm/all.zip", tmp)
        with zipfile.ZipFile(tmp) as archive:
            if not archive.namelist() or archive.testzip() is not None:
                raise ValueError("public OSV database incomplete")
        tmp.rename(dest)
    finally:
        tmp.unlink(missing_ok=True)


def offline_scan(lock_bytes, db):
    with tempfile.TemporaryDirectory(prefix="autopatch-private-") as temp:
        root = Path(temp).resolve()
        (root / "package-lock.json").write_bytes(lock_bytes)
        command = [
            "docker", "run", "--rm", "--network", "none", "--read-only",
            "--user", f"{os.getuid()}:{os.getgid()}",
            "--security-opt", "no-new-privileges", "--cap-drop", "ALL",
            "--pids-limit", "128", "--memory", "1024m",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
            "--mount", f"type=bind,source={root},target=/src,readonly",
            "--mount", f"type=bind,source={db.resolve()},target=/db,readonly",
            "-e", "OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY=/db",
            IMAGE, "scan", "source", "--offline", "--no-resolve",
            "--format=json", "-L", "/src/package-lock.json",
        ]
        response = subprocess.run(command, capture_output=True, timeout=180)
        if response.returncode not in (0, 1):
            raise ValueError("isolated scanner did not complete successfully")
        result = json.loads(response.stdout)
        if not isinstance(result, dict) or not isinstance(result.get("results"), list):
            raise ValueError("incomplete offline scanner JSON")
        return result


def independently_verified(old, new, bump, db):
    before = locked_versions(old, bump["name"])
    after = locked_versions(new, bump["name"])
    if bump["from"] not in before or after != [bump["to"]]:
        return False, "target not exclusively installed in updated lockfile"
    old_ids = advisories_for(offline_scan(old, db), bump["name"])
    new_ids = advisories_for(offline_scan(new, db), bump["name"])
    if new_ids:
        return False, "target still has known OSV advisories"
    return True, f"offline advisory check passed; resolved {len(old_ids)} known advisory ID(s)"


def process(repo, token, required_check, dry_run=False):
    assert repo == os.environ.get("GITHUB_REPOSITORY"), "repository identity mismatch"
    prs = api(repo, "pulls?state=open&per_page=100", token)
    outcomes = []
    with tempfile.TemporaryDirectory(prefix="autopatch-public-db-") as temp:
        db = Path(temp)
        prepared = False
        for candidate in prs[:100]:
            if candidate.get("user", {}).get("login") != "dependabot[bot]":
                continue
            number = candidate["number"]
            result = {"pr": number, "status": "BLOCKED"}
            try:
                pr = api(repo, f"pulls/{number}", token)
                files = api(repo, f"pulls/{number}/files?per_page=100", token)
                if pr.get("changed_files", 0) > len(files):
                    raise ValueError("file listing incomplete")
                okay, info = allowed_pr(pr, repo, files)
                if not okay:
                    raise ValueError(info)
                sha = pr["head"]["sha"]
                checks = api(repo, f"commits/{sha}/check-runs?per_page=100", token)
                statuses = api(repo, f"commits/{sha}/status", token)
                if not ci_green(checks, statuses, required_check):
                    raise ValueError("required CI missing, incomplete or failing")
                if pr["base"]["sha"] != api(repo, "git/ref/heads/main", token)["object"]["sha"]:
                    raise ValueError("default branch moved; refresh PR")
                if not prepared:
                    public_db(db)  # BEFORE private repo lockfiles are opened
                    prepared = True
                old = git_blob(pr["base"]["sha"], "package-lock.json")
                new = git_blob(sha, "package-lock.json")
                passed, why = independently_verified(old, new, info, db)
                if not passed:
                    raise ValueError(why)
                result["status"] = "ELIGIBLE_DRY_RUN" if dry_run else "VERIFIED_SOURCE_PATCH"
                result["reason"] = why
                if not dry_run:
                    latest = api(repo, f"pulls/{number}", token)
                    if latest["head"]["sha"] != sha or latest.get("mergeable") is not True:
                        raise ValueError("head changed since verification")
                    merged = api(repo, f"pulls/{number}/merge", token, "PUT",
                                 {"merge_method": "squash", "sha": sha})
                    if not merged.get("merged"):
                        raise ValueError("GitHub declined merge")
                    result["status"] = "SOURCE_MERGED_DEPLOYMENT_UNVERIFIED"
                    # GITHUB_TOKEN merges may not start a new push workflow.
                    # Never claim production is verified or that a rollback occurred.
            except (ValueError, KeyError, TypeError, urllib.error.HTTPError,
                    urllib.error.URLError, subprocess.CalledProcessError,
                    subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
                if result["status"] == "BLOCKED":
                    result["reason"] = "candidate failed safety, access or verification gate"
                else:
                    result["status"] = "BLOCKED"
                    result["reason"] = "merge operation failed; inspect GitHub PR state"
            outcomes.append(result)
            if len(outcomes) >= 15:
                break
    return outcomes


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--required-check", required=True)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    repo, token = os.environ.get("GITHUB_REPOSITORY", ""), os.environ.get("GH_TOKEN", "")
    if not repo or not token:
        raise SystemExit("BLOCKED: repository identity or automation token missing")
    rows = process(repo, token, args.required_check, args.dry_run)
    for row in rows:
        print(f"PR #{row['pr']}: {row['status']}: {row.get('reason','')}")
    print(f"AutoPatch self-running gate: {len(rows)} Dependabot PRs assessed; "
          f"{sum(x['status']=='SOURCE_MERGED_DEPLOYMENT_UNVERIFIED' for x in rows)} source merges.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
