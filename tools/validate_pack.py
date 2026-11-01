#!/usr/bin/env python3
"""validate_pack.py — Actualizer action-pack validator, v0.1 (2026-10-23).

Checks an Actualizer content pack against docs/ACTION-PACK.md, docs/SAFETY.md and docs/SUSTAIN.md.
Forked in spirit from the Manuscript Interrogator's validate_pack.py (CONTENT-PACK 0.10.2): the evidence-layer
rules (tiered, verified references; glossary; concepts; citation coverage on builder prose) are re-implemented
here, and the action layer, safety, scenarios and upkeep rules are new.

Usage:
  python3 validate_pack.py <content-pack-dir>                     # validate; exit 1 on any error
  python3 validate_pack.py <content-pack-dir> --staleness [--as-of YYYY-MM-DD]   # SUSTAIN §4 report
Needs PyYAML.
"""
import sys, os, re, glob, datetime
import yaml

VERSION = "0.1.2"
args = [a for a in sys.argv[1:]]
root = args[0] if args and not args[0].startswith("--") else "."
STALENESS = "--staleness" in args
AS_OF = datetime.date.fromisoformat(args[args.index("--as-of") + 1]) if "--as-of" in args else datetime.date.today()

errors, warns = [], []
E, W = errors.append, warns.append
P = lambda *a: os.path.join(root, *a)
CITE = re.compile(r"\[(\d+(?:\s*[-–,]\s*\d+)*)\]")
KINDS = {"navigator", "planner", "workbench"}
MODULES = {"situations", "links", "pathway", "resources", "planner"}
PROFILES = ["general", "health", "crisis-adjacent"]
GRADES_DEFAULT = {"S", "M", "F", "practice"}

def load(name, required=True):
    path = P(name)
    if not os.path.exists(path):
        if required: E(f"{name}: missing")
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return yaml.safe_load(f)
    except yaml.YAMLError as e:
        E(f"{name}: YAML error — {e}")
        return None

def cites(text):
    out = set()
    for grp in CITE.findall(str(text or "")):
        for part in re.split(r"\s*,\s*", grp):
            if re.search(r"[-–]", part):
                a, b = re.split(r"\s*[-–]\s*", part)
                out.update(range(int(a), int(b) + 1))
            else:
                out.add(int(part))
    return out

def words(t): return len(re.findall(r"\w+", str(t or "")))

def walk_strings(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items(): yield from walk_strings(v, f"{path}.{k}" if path else str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj): yield from walk_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj

def to_date(v):
    if isinstance(v, datetime.date): return v
    try: return datetime.date.fromisoformat(str(v))
    except Exception: return None

# ───────────────────────── manifest
m = load("manifest.yaml") or {}
for k in ["slug", "title", "short_title", "kind", "modules", "safety_profile", "as_of", "storage",
          "github_account", "builder", "permissions", "venue", "question"]:
    if k not in m: E(f"manifest: missing {k}")
kind = m.get("kind"); mods = set(m.get("modules") or []); profile = m.get("safety_profile")
if kind and kind not in KINDS: E(f"manifest: kind must be one of {sorted(KINDS)} (got {kind!r})")
if mods - MODULES: E(f"manifest: unknown modules {sorted(mods - MODULES)}")
if profile and profile not in PROFILES: E(f"manifest: safety_profile must be one of {PROFILES} (got {profile!r})")
if m.get("storage") not in (None, "device"): E("manifest: storage must be 'device' in v0.1 (SAFETY H2)")
if "peer" not in str(m.get("venue", "")).lower(): W("manifest: venue should make the not-peer-reviewed status unmissable")
if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", str(m.get("slug", ""))): E("manifest: slug must be kebab-case")
if len(str(m.get("short_title", "")).split()) > 3: W("manifest: short_title should be ≤ 3 words")
if m.get("delivery", "local") not in ("local", "pages", "private"): E("manifest: delivery must be local | pages | private")
body = (m.get("evidence") or {}).get("body", "records")
if body == "review" and not os.path.exists(P("review.md")): E("manifest: evidence.body is review but review.md is missing")
for mod in MODULES:
    exists = os.path.exists(P(f"{mod}.yaml"))
    if mod in mods and not exists: E(f"{mod}.yaml: listed in manifest.modules but missing")
    if exists and mod not in mods: E(f"{mod}.yaml: present but not listed in manifest.modules")

# ───────────────────────── references
refs = load("references.yaml") or []
if isinstance(refs, dict): refs = refs.get("references", [])
REF = {}
for r in refs:
    n = r.get("n")
    if not isinstance(n, int): E(f"references: entry without integer n — {str(r)[:60]}"); continue
    if n in REF: E(f"references: duplicate n {n}")
    REF[n] = r
    for k in ("citation", "year", "tier"):
        if k not in r: E(f"references/{n}: missing {k}")
    if r.get("tier") not in ("seminal", "classic", "current", "background"): E(f"references/{n}: bad tier {r.get('tier')!r}")
    if not (r.get("doi") or r.get("url") or r.get("isbn")): E(f"references/{n}: doi, url or isbn required")
    if r.get("verified") is True:
        if r.get("tier") in ("seminal", "classic") and not r.get("summary"): E(f"references/{n}: {r['tier']} needs a summary")
        if r.get("tier") == "seminal" and not r.get("why_it_mattered"): E(f"references/{n}: seminal needs why_it_mattered")
        if r.get("doi") and r.get("abstract") is None and "abstract_note" not in r:
            W(f"references/{n}: verified DOI with no abstract and no abstract_note")
    if r.get("abstract") and not r.get("harvested_on"): E(f"references/{n}: abstract without harvested_on (abstracts are harvested, never typed)")
VERIFIED = {n for n, r in REF.items() if r.get("verified") is True}

def check_cites(where, text, block_rule=True, must_cite=False):
    ns = cites(text)
    for n in ns:
        if n not in REF: E(f"{where}: cites [{n}] — no such reference")
    if block_rule and words(text) >= 25 and not ns and "<!-- framing -->" not in str(text):
        E(f"{where}: {words(text)}-word prose with no [n] and no framing marker (citation coverage)")
    if must_cite and not ns: E(f"{where}: must carry at least one [n]")
    return ns

# ───────────────────────── glossary + concepts
gl = load("glossary.yaml", required=False) or []
concept_ids = set()
for f in glob.glob(P("concepts", "*.md")):
    txt = open(f, encoding="utf-8").read()
    mm = re.match(r"---\n(.*?)\n---\n(.*)", txt, re.S)
    if not mm: E(f"{os.path.basename(f)}: no frontmatter"); continue
    fm = yaml.safe_load(mm.group(1)) or {}
    cid = fm.get("id")
    if not cid or cid != os.path.basename(f)[:-3]: E(f"{os.path.basename(f)}: id must match file name")
    concept_ids.add(cid)
    for k in ("title", "one_liner", "why_here"):
        if k not in fm: E(f"concepts/{cid}: missing {k}")
    if fm.get("self_check") and not m.get("concept_self_checks"): W(f"concepts/{cid}: self_check present but concept_self_checks is not true")
    framing_next = False
    for blk in re.split(r"\n\s*\n", mm.group(2)):
        b = "\n".join(l for l in blk.strip().splitlines() if not l.lstrip().startswith("#")).strip()
        if not b or b.startswith("$$") or b.startswith("```"): continue
        if "<!-- framing -->" in b: framing_next = True; continue
        if framing_next: framing_next = False; check_cites(f"concepts/{cid}", b, block_rule=False); continue
        check_cites(f"concepts/{cid}", b)
gids, variants = set(), {}
for g in gl:
    gid = g.get("id")
    if gid in gids: E(f"glossary: duplicate id {gid}")
    gids.add(gid)
    for k in ("term", "short", "definition"):
        if not g.get(k): E(f"glossary/{gid}: missing {k}")
    if len(str(g.get("short", ""))) > 200: E(f"glossary/{gid}: short > 200 chars")
    if g.get("concept") and g["concept"] not in concept_ids: E(f"glossary/{gid}: concept {g['concept']} not found")
    check_cites(f"glossary/{gid}.definition", g.get("definition"))
    for v in [g.get("term", "")] + list(g.get("variants") or []):
        key = str(v).lower()
        if key in variants and variants[key] != gid: E(f"glossary: variant {v!r} collides ({variants[key]} vs {gid})")
        variants[key] = gid
for g in gl:
    for s in g.get("see") or []:
        if s not in gids: E(f"glossary/{g.get('id')}: see {s} not found")

# ───────────────────────── audience
aud = load("audience.yaml") or {}
personas = {p.get("id"): p for p in (aud.get("personas") or [])}
if not personas: E("audience: at least one persona required")
acts_for_others = False
for pid, p in personas.items():
    if p.get("acts_for") not in ("self", "other", "group"): E(f"audience/{pid}: acts_for must be self | other | group")
    if p.get("acts_for") in ("other", "group"): acts_for_others = True
    if not (p.get("constraints") or {}).get("reading_level"): E(f"audience/{pid}: constraints.reading_level required")
    if not p.get("jobs"): E(f"audience/{pid}: at least one job required")

# ───────────────────────── situations
endpoints, item_codes, groups = set(), {}, {}
if "situations" in mods:
    s = load("situations.yaml") or {}
    sch = s.get("scheme") or {}
    for k in ("id", "name", "release", "source", "verified_on"):
        if not sch.get(k): E(f"situations.scheme: missing {k}")
    for g in s.get("groups") or []:
        if g.get("id") in groups: E(f"situations: duplicate group {g.get('id')}")
        groups[g.get("id")] = g
    for it in s.get("items") or []:
        c = it.get("code")
        if c in item_codes: E(f"situations: duplicate code {c}")
        item_codes[c] = it
        if it.get("group") not in groups: E(f"situations/{c}: group {it.get('group')!r} not found")
        if not it.get("title"): E(f"situations/{c}: title required (verbatim)")
        if not it.get("source_url"): E(f"situations/{c}: source_url required")
    for c, it in item_codes.items():
        if it.get("parent") and it["parent"] not in item_codes: E(f"situations/{c}: parent {it['parent']} not found")
    endpoints = set(groups) | set(item_codes)

def in_target(code, target):
    if code == target: return True
    it = item_codes.get(code)
    while it:
        if it.get("group") == target or it.get("parent") == target: return True
        it = item_codes.get(it.get("parent"))
    return False

# ───────────────────────── links
if "links" in mods:
    L = load("links.yaml") or {}
    grades = set((L.get("grades") or {}).keys()) or GRADES_DEFAULT
    seen = set()
    for ln in (L.get("links") or []) + (L.get("counter_links") or []):
        lid = ln.get("id")
        if lid in seen: E(f"links: duplicate id {lid}")
        seen.add(lid)
        for end in ("from", "to"):
            if endpoints and ln.get(end) not in endpoints: E(f"links/{lid}: {end} {ln.get(end)!r} not a group or code")
        if ln.get("polarity") not in ("+", "−", "-"): E(f"links/{lid}: polarity must be + or −")
        if ln.get("grade") not in grades: E(f"links/{lid}: grade {ln.get('grade')!r} not in {sorted(grades)}")
        rs = set(ln.get("refs") or [])
        ns = check_cites(f"links/{lid}.mechanism", ln.get("mechanism"), must_cite=True)
        if ns - rs: E(f"links/{lid}: mechanism cites {sorted(ns - rs)} not listed in refs")
        for n in rs:
            if n not in REF: E(f"links/{lid}: ref {n} not found")
            elif n not in VERIFIED: E(f"links/{lid}: ref {n} is not verified — the link may not ship (ACTION-PACK §3.3)")
        cods = ln.get("codes") or {}
        for end in ("from", "to"):                      # ACTION-PACK 0.1.1: code-level scope (Daniel's option B)
            for c in cods.get(end) or []:
                if c not in item_codes: E(f"links/{lid}: codes.{end} {c} not a code")
                elif not in_target(c, ln.get(end)): E(f"links/{lid}: codes.{end} {c} is not inside {ln.get(end)}")
        def under(c, roots):
            it = item_codes.get(c)
            while it is not None:
                if it["code"] in roots: return True
                it = item_codes.get(it.get("parent"))
            return False
        for c in ln.get("suggest") or []:
            if c not in item_codes: E(f"links/{lid}: suggest {c} not a code")
            elif not in_target(c, ln.get("to")): E(f"links/{lid}: suggest {c} is not inside {ln.get('to')}")
            elif cods.get("to") and not under(c, set(cods["to"])): E(f"links/{lid}: suggest {c} is outside codes.to")

# ───────────────────────── pathway / resources / planner
if "pathway" in mods:
    pw = load("pathway.yaml") or {}
    stages = {x.get("id") for x in pw.get("stages") or []}
    gates = {x.get("id"): x for x in pw.get("gates") or []}
    if not pw.get("rule"): E("pathway: rule (the deterministic ranking rule, in words) required")
    for a in pw.get("actions") or []:
        aid = a.get("id")
        if a.get("stage") not in stages: E(f"pathway/{aid}: stage not found")
        check_cites(f"pathway/{aid}.what", a.get("what"), must_cite=True)
        for n in (a.get("evidence") or {}).get("refs") or []:
            if n not in VERIFIED: E(f"pathway/{aid}: evidence ref {n} not verified")
        for gid in a.get("gates") or []:
            if gid not in gates: E(f"pathway/{aid}: gate {gid} not found")
    for gid, g in gates.items():
        if g.get("kind") not in ("requirement", "barrier"): E(f"pathway/gates/{gid}: kind must be requirement | barrier")
        if not g.get("verified_on"): E(f"pathway/gates/{gid}: verified_on required")
        for k in ("what", "applies_when", "time", "cost"):
            if g.get(k): check_cites(f"pathway/gates/{gid}.{k}", g[k])
if "resources" in mods:
    rs_ = load("resources.yaml") or {}
    for r in rs_.get("resources") or []:
        for k in ("source", "verified_on", "availability", "access"):
            if k not in r: E(f"resources/{r.get('id')}: missing {k}")
if "planner" in mods:
    pl = load("planner.yaml") or {}
    if pl.get("holds") not in ("plan", "map", "both"): E("planner: holds must be plan | map | both")
    if not isinstance(pl.get("schema_version"), int): E("planner: integer schema_version required")
    if "json" not in (pl.get("export") or []): E("planner: export must include json")

# ───────────────────────── safety
sf = load("safety.yaml") or {}
if sf.get("profile") != profile: E(f"safety: profile {sf.get('profile')!r} does not match manifest {profile!r}")
level = PROFILES.index(profile) if profile in PROFILES else 0
if level >= 1:
    if not sf.get("notice"): E("safety: notice required (H5)")
    if not sf.get("blocked_phrases"): E("safety: blocked_phrases required (H1)")
    if acts_for_others and not (sf.get("deidentify") or {}).get("fields"): E("safety: deidentify.fields required when a persona acts for others (H3)")
    if not sf.get("help"): E("safety: help entries required (H6)")
    for h in sf.get("help") or []:
        for k in ("name", "how", "source", "verified_on"):
            if not h.get(k): E(f"safety/help/{h.get('name')}: missing {k}")
if level >= 2:
    if not sf.get("crisis"): E("safety: crisis entries required (C1)")
    for c in sf.get("crisis") or []:
        d = to_date(c.get("verified_on"))
        if not d or (AS_OF - d).days > 30: E(f"safety/crisis/{c.get('name')}: verified_on older than 30 days (C1)")
# H1 lint over every pack string, except allowed contexts
if level >= 1 and sf.get("blocked_phrases"):
    allowed = [a.get("field", "") for a in sf.get("allowed_contexts") or []]
    allowed_re = [re.compile("^" + re.escape(a).replace(r"\[\]", r"\[\d+\]")) for a in allowed]
    lint_files = ["ui-strings.yaml", "links.yaml", "pathway.yaml", "scenarios.yaml", "audience.yaml", "situations.yaml", "glossary.yaml", "scope.yaml", "references.yaml", "safety.yaml"]
    for fn in lint_files:
        data = load(fn, required=False)
        if data is None: continue
        base = os.path.splitext(fn)[0]
        for path, txt in walk_strings(data):
            full = f"{base}{path}" if path.startswith("[") else f"{base}.{path}"
            if any(r.match(full) for r in allowed_re) or ".must_not" in full or full.startswith("safety.blocked_phrases") or full.startswith("safety.allowed_phrases"): continue
            low = txt.lower()
            for ap in sf.get("allowed_phrases") or []:      # SAFETY 0.1.1: exact-phrase exemptions only
                low = low.replace(str(ap).lower(), " ")
            for ph in sf["blocked_phrases"]:
                if re.search(r"\b" + re.escape(ph.lower()), low):
                    E(f"safety lint (H1): {full} contains blocked phrase {ph!r}")

# ───────────────────────── scenarios
sc = load("scenarios.yaml") or []
covered = set()
for w in sc:
    wid = w.get("id")
    if w.get("persona") not in personas: E(f"scenarios/{wid}: persona {w.get('persona')!r} not found")
    covered.add(w.get("persona"))
    if not w.get("steps"): E(f"scenarios/{wid}: steps required")
    for i, st in enumerate(w.get("steps") or []):
        if not st.get("do") or not st.get("expect"): E(f"scenarios/{wid}/step{i+1}: do and expect required")
    if level >= 1 and not w.get("must_not"): E(f"scenarios/{wid}: must_not required under {profile}")
for pid in personas:
    if pid not in covered: E(f"scenarios: no walkthrough for persona {pid}")

# ───────────────────────── upkeep + staleness
up = load("upkeep.yaml") or {}
classes = {c.get("id"): c for c in up.get("classes") or []}
if not classes: E("upkeep: classes required")
for cid, c in classes.items():
    if not isinstance(c.get("recheck_days"), int): E(f"upkeep/{cid}: integer recheck_days required")
FILE_CLASS = {"situations.yaml": "scheme", "references.yaml": "reference", "links.yaml": "link",
              "resources.yaml": "resource", "safety.yaml": "help", "pathway.yaml": "link"}
stale = []
for fn, cls in FILE_CLASS.items():
    data = load(fn, required=False)
    if data is None or cls not in classes: continue
    days = classes[cls]["recheck_days"]
    def visit(o, path):
        if isinstance(o, dict):
            d = to_date(o.get("verified_on") or o.get("harvested_on"))
            if d:
                age = (AS_OF - d).days
                if age > (o.get("recheck_days") or days): stale.append((cls, f"{fn}:{path}", d.isoformat(), age))
            for k, v in o.items(): visit(v, f"{path}.{k}" if path else k)
        elif isinstance(o, list):
            for i, v in enumerate(o): visit(v, f"{path}[{i}]")
    visit(data, "")
if os.path.exists(P("changes.yaml")):
    for ch in load("changes.yaml") or []:
        for k in ("date", "what", "why", "by"):
            if k not in ch: E(f"changes: entry missing {k}")

# ───────────────────────── todo
td = load("todo.yaml", required=False) or []
if isinstance(td, dict): td = td.get("items", [])

# ───────────────────────── report
if STALENESS:
    print(f"Staleness report — {m.get('slug')} — as of {AS_OF}")
    if not stale: print("  nothing stale")
    for cls, where, d, age in sorted(stale):
        print(f"  [{cls}] {where} — checked {d} ({age} days)")
print(f"validate_pack {VERSION} · {m.get('slug')} · kind={kind} · profile={profile} · modules={sorted(mods)}")
print(f"  references: {len(REF)} ({len(VERIFIED)} verified, {sum(1 for r in REF.values() if r.get('abstract'))} with abstracts)")
print(f"  situations: {len(item_codes)} codes in {len(groups)} groups · personas: {len(personas)} · scenarios: {len(sc)} · todo: {len(td)} · stale: {len(stale)}")
for w in warns: print("  WARN ", w)
for e in errors: print("  ERROR", e)
print(f"{len(errors)} error(s), {len(warns)} warning(s)")
sys.exit(1 if errors else 0)
