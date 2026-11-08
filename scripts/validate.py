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


def ids_of(path):
    d = load(path)
    return {n["id"] for n in d.get("nodes", [])} if d else set()


def check_course(path, course_ids, course_files):
    d = load(path)
    if d is None:
        return
    tag = os.path.basename(path)

    # topics that may be referenced from imported courses
    imported = set()
    for cid in d.get("meta", {}).get("imports", []):
        if cid not in course_files:
            err(f"{tag}: imports unknown course '{cid}'")
        elif course_files[cid]:
            imported |= ids_of(course_files[cid])

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
    refset = idset | imported
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
            if r not in refset:
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
        tries = n.get("tryIt")
        if tries is not None:
            items = tries if isinstance(tries, list) else [tries]
            for t in items:
                if not isinstance(t, dict) or "url" not in t:
                    err(f"{tag}: node '{nid}' tryIt entries need a 'url'")
                elif not t["url"].startswith(("http://", "https://")) and not os.path.exists(os.path.join(ROOT, t["url"].split("#")[0])):
                    err(f"{tag}: node '{nid}' tryIt points at a missing local file: {t['url']}")
        notes = n.get("notes")
        if isinstance(notes, str) and notes.endswith(".md") and not os.path.exists(os.path.join(ROOT, notes)):
            err(f"{tag}: node '{nid}' notes file not found: {notes}")
        lt = n.get("leadsTo")
        if lt and lt not in course_ids:
            err(f"{tag}: node '{nid}' leadsTo unknown course '{lt}'")
        ltn = n.get("leadsToNode")
        if ltn and lt and course_files.get(lt) and ltn not in ids_of(course_files[lt]):
            err(f"{tag}: node '{nid}' leadsToNode '{ltn}' not found in course '{lt}'")
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
            if t.get(k) not in refset:
                err(f"{tag}: translates entry {t} has unknown '{k}'")
    for m in d["mirrors"]:
        for k in ("e", "b"):
            if m.get(k) not in refset:
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
            if ref not in refset:
                err(f"{tag}: maxwell grid references unknown node '{ref}'")
        if len(mx.get("rows", [])) != 2 or len(mx.get("columns", [])) != 2:
            err(f"{tag}: maxwell grid should have exactly 2 rows and 2 columns")

    # unreferenced groups are only a warning
    used = {n["group"] for n in nodes}
    for g in groups - used:
        print(f"note: {tag}: group '{g}' has no nodes")


def check_builder():
    b = load("data/builder.json")
    if b is None:
        return
    tag = "builder.json"
    laws = set(b.get("laws", {}))
    syms = set(b.get("symmetries", {}))
    cids = [c["id"] for c in b.get("configs", [])]
    for i in cids:
        if cids.count(i) > 1:
            err(f"{tag}: duplicate config id '{i}'")
    for c in b.get("configs", []):
        cid = c.get("id", "?")
        if c.get("law") not in laws:
            err(f"{tag}: config '{cid}' has unknown law '{c.get('law')}'")
            continue
        if c.get("symmetry") not in syms:
            err(f"{tag}: config '{cid}' has unknown symmetry '{c.get('symmetry')}'")
        shapes = b["shapes"].get(c["law"], {})
        collapses = {o["id"] for o in b["collapseOptions"].get(c["law"], [])}
        if c.get("symmetry") == "none":
            if not c.get("dead"):
                err(f"{tag}: config '{cid}' has no symmetry but no 'dead' explanation")
        else:
            if c.get("shape") not in shapes:
                err(f"{tag}: config '{cid}' has unknown shape '{c.get('shape')}'")
            if c.get("collapse") not in collapses:
                err(f"{tag}: config '{cid}' has unknown collapse option '{c.get('collapse')}'")
            if not c.get("regions"):
                err(f"{tag}: config '{cid}' has no regions")
            for r in c.get("regions", []):
                for k in ("label", "enclosed", "result"):
                    if k not in r:
                        err(f"{tag}: config '{cid}' region missing '{k}'")
        if c.get("twin") and c["twin"] not in cids:
            err(f"{tag}: config '{cid}' twin '{c['twin']}' not found")
        for k in (c.get("shapeWrong") or {}):
            if k not in shapes:
                err(f"{tag}: config '{cid}' shapeWrong refers to unknown shape '{k}'")
        for k in (c.get("collapseWrong") or {}):
            if k not in collapses:
                err(f"{tag}: config '{cid}' collapseWrong refers to unknown option '{k}'")
    P = b.get("potential")
    if P:
        pids = [c["id"] for c in P.get("configs", [])]
        for c in P.get("configs", []):
            cid = c.get("id", "?")
            if c.get("route") is None:
                if not c.get("dead"):
                    err(f"{tag}: potential config '{cid}' has no route and no 'dead' text")
                continue
            if c["route"] not in P["routes"]:
                err(f"{tag}: potential config '{cid}' unknown route '{c['route']}'")
            if c.get("reference") not in P["references"]:
                err(f"{tag}: potential config '{cid}' unknown reference '{c.get('reference')}'")
            need = {"integrate": ("path", "paths"), "superpose": ("sum", "sums"), "gradient": ("grad", "grads")}.get(c["route"])
            if need and c.get(need[0]) not in P[need[1]]:
                err(f"{tag}: potential config '{cid}' needs a valid '{need[0]}'")
            if not c.get("regions"):
                err(f"{tag}: potential config '{cid}' has no regions")
            for r in c.get("regions", []):
                for k in ("label", "work", "result"):
                    if k not in r:
                        err(f"{tag}: potential config '{cid}' region missing '{k}'")


def main():
    check_builder()
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
    course_files = {c.get("id"): c.get("file") for c in courses}
    for c in courses:
        for key in ("id", "name"):
            if key not in c:
                err(f"data/courses.json: course entry missing '{key}': {c}")
        if c.get("file"):
            check_course(c["file"], set(cids), course_files)
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
