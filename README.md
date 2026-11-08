# Electromagnetics Notes

An interactive topic map of electromagnetic field theory, built as supporting material for the EMF course sequence at VCU. **Introduction to EMF** (electrostatics and magnetostatics, EGRE 309) is complete. **Electromagnetic Fields II** (time-varying fields, waves, transmission lines) is included as a *draft* skeleton — coverage of the second course varies by instructor, so it is a starting point rather than a syllabus.

**Live page:** https://lc-linkous.github.io/electromagnetics_notes/

The map has three views of the same topics:

| View | What it shows |
|---|---|
| **Flow** | Left → right prerequisite order. An arrow from A to B means B builds on A. |
| **Duality** | Electrostatics on the left, magnetostatics on the right, each topic lined up against its twin. The vector-calculus tools and the Lorentz force (the one law that uses both fields) sit in the middle. |
| **Units** | Topics grouped the way the course is organized. |
| **Maxwell** | Just the four laws of static fields as a 2×2 grid (which field × spreads out / circulates), with the theorems that convert integral and differential forms and what hangs off each law. Shown only when the course defines a `maxwell` grid. |

Click a topic to open its card and light up its whole path — everything it builds on and everything that builds on it. The card holds a short summary, the key equation, suggested reading in Sadiku (6th ed.), common sticking points, a check-yourself question, links to free simulators and references, connections to other topics, and longer notes where they exist. **Focus on this path** hides everything else and re-lays out just that path. Hover to see direct connections. Dashed boxes are *exits* — where the material leads after this course.

Students can mark each topic **shaky / okay / solid**; the marks are stored in their own browser only (nothing is sent anywhere). **My gaps** then shows just the shaky topics and everything that depends on them, and each card reports which of its prerequisites are marked shaky. A progress line under the legend counts the marks, and **Copy / Paste** turn them into a short text code (`intro-emf shaky:V,curl okay:E`) so a student can carry them between a laptop and a lab machine — or paste them into a form if you ever want a class-wide picture.

**Print** builds a study sheet of every topic in prerequisite order — summary, equation, sticking points, check question — with the answers on the last page, and opens the browser's print dialog (save as PDF from there).

Every view and topic is linkable: `#flow/gauss-int`, `#duality/lorentz`, `#units`. Arrow keys walk the map from the selected topic (← prerequisite, → next, ↑↓ neighbors).

The center of the map is Maxwell's equations for statics as a 2×2 grid (E / B × divergence / curl), with the divergence and Stokes' theorems as the translators between integral and differential forms.

## Equation builder

`builder.html` is a guided walk through applying Gauss's or Ampère's law: pick the source, name its symmetry, choose the coordinate system and Gaussian surface / Amperian loop, say what the integral collapses to, then read off the enclosed charge or current region by region. Every step offers wrong answers too — a cube around a point charge, a sphere around a line, counting the end caps — and each one explains why it fails. The surface/loop step draws each candidate over a sketch of the source's field, so a wrong choice is visible (arrows cutting the surface at angles) before it is explained. Sketches are generated in `js/sketch.js` from a `sketch` key on each configuration. Sources with too little symmetry (a dipole, a finite segment) are included on purpose and end in "what to do instead." Every result ends with sanity checks and a link to its electric/magnetic twin.

It is reached from the **Tools** entry in the course switcher, from the *Try it* slot on the Gauss and Ampère cards, and directly at `builder.html#gauss/coax` or `builder.html#ampere/solenoid`. All of its text lives in `data/builder.json` (configurations, symmetry explanations, wrong-answer feedback), so tuning it after seeing what students actually pick is a data edit.

## Repo layout

```
index.html            the page
css/style.css
js/app.js             loading, rendering, interaction
js/layout.js          the three layouts (pure functions of the data)
data/courses.json     the catalog: site title and the list of courses
data/intro-emf.json   ← the content for Introduction to EMF. This is the file that normally changes.
data/emf-2.json       the draft skeleton for Electromagnetic Fields II
data/builder.json     the equation builder's sources, symmetries and feedback
builder.html, js/builder.js, css/builder.css   the equation builder page
notes/<topic-id>.md   optional longer notes per topic, in Markdown with $…$ / $$…$$ math
vendor/               KaTeX (equations) and marked (Markdown), vendored so the site has no runtime dependencies
scripts/validate.py   checks the data files; run it after editing (also runs on push via GitHub Actions)
```

No build step. Plain ES modules, so it needs to be served over HTTP (not opened as a `file://`). Locally:

```
python -m http.server 8000
# then open http://localhost:8000
```

## Courses

`data/courses.json` lists the courses. Each entry has an `id`, a `name`, a one-line `description`, and a `file` pointing at its topic data. An entry with `"file": null` is shown in the course switcher as *coming* and cannot be selected — that is how part 2 is listed today.

To add a course: write its topic file (same format as `data/intro-emf.json`), point the catalog entry's `file` at it, and the switcher becomes live. `"status": "draft"` tags it *(draft)* in the switcher.

**Across courses.** A course can list `"imports": ["intro-emf"]` in its `meta`. Any id it references in `requires`, `translates`, `mirrors` or the Maxwell grid that is not one of its own topics is looked up in the imported course and shown as a grey stub in a *From …* group; the stub's card links to the real topic. That is how part 2's Flow view starts from part-1 topics and how its Maxwell grid reuses the part-1 laws. An exit node in one course can carry `"leadsTo": "<course id>"` and optionally `"leadsToNode": "<topic id>"`; its card then shows *Continues in …* and the link opens that course at that topic.

## Editing content

Everything students see for a course lives in its topic file, e.g. `data/intro-emf.json`.

**A node** (topic):

```json
{
  "id": "gauss-int",
  "group": "u2",
  "kind": "law",
  "side": "E",
  "name": "Gauss's law (integral)",
  "summary": "One or two sentences a student can read in ten seconds.",
  "equation": "\\oint_S \\mathbf{E}\\cdot d\\mathbf{S}=\\frac{Q_{\\text{enc}}}{\\varepsilon_0}",
  "sadiku": "4.5",
  "requires": ["E", "flux"],
  "resources": [ { "label": "PhET · Charges and Fields", "url": "https://…" } ],
  "tryIt": { "label": "Open in the field simulator", "url": "https://…" },
  "pitfalls": [ "One sentence per common mistake. *Inline Markdown* is fine." ],
  "check": { "q": "A short concept question.", "a": "Its answer, revealed on click." },
  "notes": "notes/gauss-int.md"
}
```

- `equation` is LaTeX (rendered with KaTeX); remember to double the backslashes inside JSON.

- `group` — one of the ids in `groups` (sets the color and the Units view cluster).
- `kind` — `tool`, `concept`, `source`, `law`, `quantity`, `property`, `device`, `technique`, or `exit`. Controls the box style and the small label.
- `side` — `E`, `B`, or `center`. Only used by the Duality view.
- `requires` — ids of topics a student needs first. These are the arrows in the Flow view. The graph must stay acyclic; the page logs a warning in the console if an id is unknown.
- `pitfalls`, `check`, `tryIt`, `notes` and `leadsTo` are optional; the card hides any section that is empty.
- `notes` is either a path to a Markdown file (`notes/<id>.md`, fetched when the card opens) or a plain string.

**Edges** other than `requires`:

- `translates` — integral ↔ differential form of the same law, with the theorem that converts them: `{ "a": "gauss-int", "b": "gauss-diff", "via": "div-thm" }`
- `mirrors` — electrostatic / magnetostatic twins: `{ "e": "V", "b": "A" }`

**The Maxwell grid** (optional, top-level `maxwell`): two `rows` (each with its field `node`, two `cells` of `[integral, differential]` ids and the ids hanging `below` each cell), two `columns` (each with a `header` stack of ids), a `bridge` node and a `future` node. Any node referenced must exist; the validator checks this.

Adding a node is: add the object to `nodes`, list what it `requires`, optionally add `mirrors`/`translates` entries. Layouts recompute on load.

### Validating

```
python3 scripts/validate.py
```

Reports duplicate or malformed ids, references to unknown nodes, cycles in `requires`, exits with outgoing edges, missing notes files, bad resource URLs and broken grid references. The same script runs as a GitHub Action on every push that touches `data/` or `notes/`, so a typo shows up as a red X on the commit rather than as a silently broken map.

## Deliberately not in here

- Dates, weeks, homework, quiz, lab and exam numbers. Those change every semester; the map is about the material.
- Anything tied to a specific simulation package. The `tryIt` slot is meant for browser-based tools such as the [Intro EMF Lab](https://interactive-hardware-interfacing.github.io/intro-emf-lab) field simulator, whose views are reproducible from their URL.

## Reuse

Nothing in `js/` knows about electromagnetics. A course is a data file; the catalog lists them. The Units view lays a course's groups out in two rows in the order they are listed, with any group made only of exit nodes moved to the end.

## Hosting

GitHub Pages, serving from the `main` branch root (Settings → Pages → Deploy from a branch → `main` / `/ (root)`).

## License

_To be chosen._ (A common split for material like this is a permissive code license such as MIT for `js/` and `css/`, and CC BY 4.0 for the content in `data/`.)
