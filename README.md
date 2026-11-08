# Electromagnetics Notes

An interactive topic map of electromagnetic field theory, built as supporting material for the EMF course sequence at VCU. The first course, **Introduction to EMF** (electrostatics and magnetostatics, EGRE 309), is in place; the structure is ready for a second course to be added as a data file.

**Live page:** https://lc-linkous.github.io/electromagnetics_notes/

The map has three views of the same topics:

| View | What it shows |
|---|---|
| **Flow** | Left → right prerequisite order. An arrow from A to B means B builds on A. |
| **Duality** | Electrostatics on the left, magnetostatics on the right, each topic lined up against its twin. The vector-calculus tools and the Lorentz force (the one law that uses both fields) sit in the middle. |
| **Units** | Topics grouped the way the course is organized. |

Click a topic to open its card: a short summary, the key equation, suggested reading in Sadiku (6th ed.), links to free simulators and references, and its connections to other topics. Hover to light up what a topic connects to. Dashed boxes are *exits* — where the material leads after this course.

The center of the map is Maxwell's equations for statics as a 2×2 grid (E / B × divergence / curl), with the divergence and Stokes' theorems as the translators between integral and differential forms.

## Repo layout

```
index.html            the page
css/style.css
js/app.js             loading, rendering, interaction
js/layout.js          the three layouts (pure functions of the data)
data/courses.json     the catalog: site title and the list of courses
data/intro-emf.json   ← the content for Introduction to EMF. This is the file that normally changes.
```

No build step, no dependencies. Plain ES modules, so it needs to be served over HTTP (not opened as a `file://`). Locally:

```
python -m http.server 8000
# then open http://localhost:8000
```

## Courses

`data/courses.json` lists the courses. Each entry has an `id`, a `name`, a one-line `description`, and a `file` pointing at its topic data. An entry with `"file": null` is shown in the course switcher as *coming* and cannot be selected — that is how part 2 is listed today.

To add a course: write its topic file (same format as `data/intro-emf.json`), point the catalog entry's `file` at it, and the switcher becomes live. An exit node in one course can carry `"leadsTo": "<course id>"`; its card then shows *Continues in …*, and once that course has a file the link opens it.

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
  "equation": "∮ E·dS = Q_enc / ε₀",
  "sadiku": "4.5",
  "requires": ["E", "flux"],
  "resources": [ { "label": "PhET · Charges and Fields", "url": "https://…" } ],
  "tryIt": { "label": "Open in the field simulator", "url": "https://…" },
  "notes": "Optional longer explanation. Shown in its own section when present."
}
```

- `group` — one of the ids in `groups` (sets the color and the Units view cluster).
- `kind` — `tool`, `concept`, `source`, `law`, `quantity`, `property`, `device`, `technique`, or `exit`. Controls the box style and the small label.
- `side` — `E`, `B`, or `center`. Only used by the Duality view.
- `requires` — ids of topics a student needs first. These are the arrows in the Flow view. The graph must stay acyclic; the page logs a warning in the console if an id is unknown.
- `tryIt`, `notes` and `leadsTo` are optional and the card hides the section when they are absent.

**Edges** other than `requires`:

- `translates` — integral ↔ differential form of the same law, with the theorem that converts them: `{ "a": "gauss-int", "b": "gauss-diff", "via": "div-thm" }`
- `mirrors` — electrostatic / magnetostatic twins: `{ "e": "V", "b": "A" }`

Adding a node is: add the object to `nodes`, list what it `requires`, optionally add `mirrors`/`translates` entries. Layouts recompute on load.

## Deliberately not in here

- Dates, weeks, homework, quiz, lab and exam numbers. Those change every semester; the map is about the material.
- Anything tied to a specific simulation package. The `tryIt` slot is meant for browser-based tools such as the [Intro EMF Lab](https://interactive-hardware-interfacing.github.io/intro-emf-lab) field simulator, whose views are reproducible from their URL.

## Reuse

Nothing in `js/` knows about electromagnetics. A course is a data file; the catalog lists them. The Units view lays a course's groups out in two rows in the order they are listed, with any group made only of exit nodes moved to the end.

## Hosting

GitHub Pages, serving from the `main` branch root (Settings → Pages → Deploy from a branch → `main` / `/ (root)`).

## License

_To be chosen._ (A common split for material like this is a permissive code license such as MIT for `js/` and `css/`, and CC BY 4.0 for the content in `data/`.)
