#!/usr/bin/env python3
"""Validate the course data files.

Run from the repo root:  python3 scripts/validate.py
Exits non-zero and lists every problem found. Used by the GitHub Action, and
worth running by hand after editing data/*.json.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KINDS = {"tool", "concept", "source", "law", "quantity", "property", "device", "technique", "exit"}
SIDES = {"E", "B", "center"}
problems = []


def err(msg):
    problems.append(msg)


def load(path):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        err(f"{path}: file not found")
        return None
    try:
        with open(full, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        err(f"{path}: invalid JSON — {e}")
        return None


def check_course(path, course_ids):
    d = load(path)
    if d is None:
        return
    tag = os.path.basename(path)

    for key in ("meta", "groups", "kinds", "nodes", "translates", "mirrors"):
        if key not in d:
            err(f"{tag}: missing top-level key '{key}'")
    if problems:
        return

    groups = {g["id"] for g in d["groups"]}
    nodes = d["nodes"]
    ids = [n["id"] for n in nodes]
    dupes = {i for i in ids if ids.count(i) > 1}
    for i in sorted(dupes):
        err(f"{tag}: duplicate node id '{i}'")
    idset = set(ids)
    for i in ids:
        if not re.fullmatch(r"[A-Za-z0-9-]+", i):
            err(f"{tag}: node id '{i}' should be letters, digits and hyphens (it goes in the URL)")

    for n in nodes:
        nid = n.get("id", "?")
        for key in ("id", "group", "kind", "side", "name", "summary", "requires"):
            if key not in n:
                err(f"{tag}: node '{nid}' missing '{key}'")
        if n.get("group") not in groups:
            err(f"{tag}: node '{nid}' has unknown group '{n.get('group')}'")
        if n.get("kind") not in KINDS:
            err(f"{tag}: node '{nid}' has unknown kind '{n.get('kind')}'")
        if n.get("side") not in SIDES:
            err(f"{tag}: node '{nid}' has unknown side '{n.get('side')}' (E, B or center)")
        for r in n.get("requires", []):
            if r not in idset:
                err(f"{tag}: node '{nid}' requires unknown node '{r}'")
            if r == nid:
                err(f"{tag}: node '{nid}' requires itself")
        if n.get("kind") == "exit" and any(m.get("requires") and nid in m["requires"] for m in nodes):
            err(f"{tag}: exit node '{nid}' is required by another node (exits should have no outgoing edges)")
        for res in n.get("resources", []):
            if not isinstance(res, dict) or "label" not in res or "url" not in res:
                err(f"{tag}: node '{nid}' has a resource without label/url")
            elif not res["url"].startswith(("http://", "https://")):
                err(f"{tag}: node '{nid}' resource '{res['label']}' has a non-http url")
        notes = n.get("notes")
        if isinstance(notes, str) and notes.endswith(".md") and not os.path.exists(os.path.join(ROOT, notes)):
            err(f"{tag}: node '{nid}' notes file not found: {notes}")
        lt = n.get("leadsTo")
        if lt and lt not in course_ids:
            err(f"{tag}: node '{nid}' leadsTo unknown course '{lt}'")
        chk = n.get("check")
        if chk is not None and (not isinstance(chk, dict) or "q" not in chk or "a" not in chk):
            err(f"{tag}: node '{nid}' check needs both 'q' and 'a'")
        if n.get("pitfalls") is not None and not isinstance(n["pitfalls"], list):
            err(f"{tag}: node '{nid}' pitfalls should be a list of strings")

    # cycles in requires
    color = {}
    stack = []

    def visit(i):
        color[i] = 1
        stack.append(i)
        for r in next((n["requires"] for n in nodes if n["id"] == i), []):
            if r not in idset:
                continue
            if color.get(r) == 1:
                cyc = " → ".join(stack[stack.index(r):] + [r])
                err(f"{tag}: cycle in requires: {cyc}")
            elif color.get(r) is None:
                visit(r)
        stack.pop()
        color[i] = 2

    for i in ids:
        if color.get(i) is None:
            visit(i)

    for t in d["translates"]:
        for k in ("a", "b", "via"):
            if t.get(k) not in idset:
                err(f"{tag}: translates entry {t} has unknown '{k}'")
    for m in d["mirrors"]:
        for k in ("e", "b"):
            if m.get(k) not in idset:
                err(f"{tag}: mirrors entry {m} has unknown '{k}'")

    mx = d.get("maxwell")
    if mx:
        refs = []
        for c in mx.get("columns", []):
            refs += c.get("header", [])
        for r in mx.get("rows", []):
            refs.append(r.get("node"))
            for cell in r.get("cells", []):
                refs += cell
            for b in r.get("below", []):
                refs += b
        for k in ("bridge", "future"):
            if mx.get(k):
                refs.append(mx[k])
        for ref in refs:
            if ref not in idset:
                err(f"{tag}: maxwell grid references unknown node '{ref}'")
        if len(mx.get("rows", [])) != 2 or len(mx.get("columns", [])) != 2:
            err(f"{tag}: maxwell grid should have exactly 2 rows and 2 columns")

    # unreferenced groups are only a warning
    used = {n["group"] for n in nodes}
    for g in groups - used:
        print(f"note: {tag}: group '{g}' has no nodes")


def main():
    catalog = load("data/courses.json")
    if catalog is None:
        return finish()
    courses = catalog.get("courses", [])
    if not courses:
        err("data/courses.json: no courses listed")
    cids = [c.get("id") for c in courses]
    for c in cids:
        if cids.count(c) > 1:
            err(f"data/courses.json: duplicate course id '{c}'")
    for c in courses:
        for key in ("id", "name"):
            if key not in c:
                err(f"data/courses.json: course entry missing '{key}': {c}")
        if c.get("file"):
            check_course(c["file"], set(cids))
    if not any(c.get("file") for c in courses):
        err("data/courses.json: no course has a data file")
    return finish()


def finish():
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        return 1
    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
