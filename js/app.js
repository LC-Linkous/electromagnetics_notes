import { LAYOUTS, NODE_W, NODE_H, computeDepth } from './layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = sel => document.querySelector(sel);
const el = (tag, attrs = {}, ns = SVG_NS) => {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const LEVELS = ['shaky', 'okay', 'solid'];
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ state
const state = {
  catalog: null,          // data/courses.json
  course: null,           // the active entry from catalog.courses
  data: null,             // the active course's topic file
  byId: new Map(),
  groupById: new Map(),
  edges: [],              // { kind, source, target, via? }
  adjacency: new Map(),   // id -> Set of neighbor ids across all edge kinds
  parents: new Map(),     // id -> [ids it requires]
  children: new Map(),    // id -> [ids that require it]
  view: 'flow',
  layout: null,           // { pos, clusters, edgeVisibility }
  cur: new Map(),         // animated positions id -> {x, y}
  selected: null,
  hovered: null,
  query: '',
  offGroups: new Set(),
  focusSet: null,         // Set of ids shown in focus mode, or null
  gapsMode: false,
  levels: {},             // id -> 'shaky' | 'okay' | 'solid'
  transform: { k: 1, x: 0, y: 0 },
  nodeEls: new Map(),
  edgeEls: [],
  labelEls: [],
  anim: null,
  notesCache: new Map(),
};

// ------------------------------------------------------------------ boot
async function main() {
  const catalog = await (await fetch('data/courses.json')).json();
  state.catalog = catalog;
  $('#title').textContent = catalog.title || 'Notes';
  document.title = catalog.title || document.title;

  buildCourseSwitcher();
  wireUI();

  const remembered = readRemembered('course');
  const first = catalog.courses.find(c => c.id === remembered && c.file)
    || catalog.courses.find(c => c.file)
    || catalog.courses[0];
  await loadCourse(first.id);
}

/** Load a course's topic file and (re)build the whole map from it. */
const courseCache = new Map();
async function fetchCourse(course) {
  if (!courseCache.has(course.id)) courseCache.set(course.id, await (await fetch(course.file)).json());
  return courseCache.get(course.id);
}

/**
 * Resolve references to topics that live in another course (meta.imports). Each one
 * becomes a stub node in a "From <course>" group so edges and the Maxwell grid can
 * use it; its card links to the real topic in its own course.
 */
async function resolveImports(data) {
  const imports = data.meta.imports || [];
  if (!imports.length) return data;
  const own = new Set(data.nodes.map(n => n.id));
  const wanted = new Set();
  data.nodes.forEach(n => n.requires.forEach(r => { if (!own.has(r)) wanted.add(r); }));
  (data.translates || []).forEach(t => ['a', 'b', 'via'].forEach(k => { if (!own.has(t[k])) wanted.add(t[k]); }));
  (data.mirrors || []).forEach(m => ['e', 'b'].forEach(k => { if (!own.has(m[k])) wanted.add(m[k]); }));
  if (data.maxwell) {
    const m = data.maxwell;
    m.columns.forEach(c => c.header.forEach(id => { if (!own.has(id)) wanted.add(id); }));
    m.rows.forEach(r => { [r.node, ...r.cells.flat(), ...r.below.flat()].forEach(id => { if (id && !own.has(id)) wanted.add(id); }); });
    [m.bridge, m.future].forEach(id => { if (id && !own.has(id)) wanted.add(id); });
  }
  if (!wanted.size) return data;

  const groups = data.groups.slice();
  const nodes = data.nodes.slice();
  for (const cid of imports) {
    const course = state.catalog.courses.find(c => c.id === cid);
    if (!course || !course.file) continue;
    const src = await fetchCourse(course);
    const gid = 'from-' + cid;
    let added = false;
    for (const n of src.nodes) {
      if (!wanted.has(n.id)) continue;
      nodes.push({ ...n, group: gid, requires: [], notes: undefined, pitfalls: undefined, check: undefined, foreign: cid, foreignGroup: n.group });
      wanted.delete(n.id);
      added = true;
    }
    if (added) groups.unshift({ id: gid, name: `From ${course.name}`, short: course.short || course.name, color: '#9ca3af' });
  }
  if (wanted.size) console.warn('unresolved imported topics: ' + [...wanted].join(', '));
  return { ...data, groups, nodes };
}

async function loadCourse(courseId, selectId = null) {
  const course = state.catalog.courses.find(c => c.id === courseId);
  if (!course || !course.file) return;
  const data = await resolveImports(await fetchCourse(course));

  // Tear down anything from a previously loaded course.
  state.selected = null;
  $('#panel').hidden = true;
  state.hovered = null;
  state.query = '';
  $('#search').value = '';
  state.offGroups.clear();
  state.focusSet = null;
  $('#focus-banner').hidden = true;
  state.gapsMode = false;
  $('#gaps').setAttribute('aria-pressed', 'false');
  state.byId = new Map();
  state.groupById = new Map();
  state.edges = [];
  state.adjacency = new Map();
  state.parents = new Map();
  state.children = new Map();
  state.cur = new Map();
  state.nodeEls = new Map();
  state.edgeEls = [];
  state.labelEls = [];
  state.notesCache = new Map();
  for (const id of ['#nodes', '#edges', '#edge-labels', '#clusters', '#legend']) $(id).innerHTML = '';

  state.course = course;
  state.data = data;
  data.nodes.forEach(n => state.byId.set(n.id, n));
  data.groups.forEach(g => state.groupById.set(g.id, g));
  validate(data);
  buildEdges(data);
  state.levels = readLevels();

  $('#course').value = course.id;
  $('#subtitle').textContent = data.meta.subtitle || course.description || '';
  document.title = `${course.name} · ${state.catalog.title}`;
  writeRemembered('course', course.id);

  buildLegend();
  buildNodes();
  buildEdgeElements();
  // Views a course does not define are hidden.
  document.querySelector('.views a[data-view="maxwell"]').hidden = !data.maxwell;
  document.querySelector('.views a[data-view="duality"]').hidden = !data.nodes.some(n => !n.foreign && (n.side === 'E' || n.side === 'B'));

  const { view, node } = parseHash();
  const okView = view === 'duality' && document.querySelector('.views a[data-view="duality"]').hidden ? 'flow' : view;
  setView(okView, { instant: true });
  const target = selectId || node;
  if (target && state.byId.has(target)) select(target, { fromHash: true });
}

function buildCourseSwitcher() {
  const sel = $('#course');
  sel.innerHTML = '';
  for (const c of state.catalog.courses) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = !c.file ? `${c.name} (coming)` : (c.status === 'draft' ? `${c.name} (draft)` : c.name);
    o.disabled = !c.file;
    sel.appendChild(o);
  }
  // With a single available course the switcher is just a label.
  sel.disabled = state.catalog.courses.filter(c => c.file).length < 2;
  sel.addEventListener('change', () => loadCourse(sel.value));
}

// localStorage is a convenience only; it may be missing or throw.
function readRemembered(key) { try { return localStorage.getItem('emnotes:' + key); } catch { return null; } }
function writeRemembered(key, val) { try { localStorage.setItem('emnotes:' + key, val); } catch { /* ignore */ } }
function readLevels() {
  try { return JSON.parse(localStorage.getItem(`emnotes:levels:${state.course.id}`) || '{}'); } catch { return {}; }
}
function writeLevels() {
  try { localStorage.setItem(`emnotes:levels:${state.course.id}`, JSON.stringify(state.levels)); } catch { /* ignore */ }
}

function validate(data) {
  const ids = new Set(data.nodes.map(n => n.id));
  const problems = [];
  for (const n of data.nodes) {
    if (!state.groupById.has(n.group)) problems.push(`${n.id}: unknown group ${n.group}`);
    for (const r of n.requires) if (!ids.has(r)) problems.push(`${n.id} requires unknown ${r}`);
  }
  for (const t of data.translates) for (const k of ['a', 'b', 'via']) if (!ids.has(t[k])) problems.push(`translates: unknown ${t[k]}`);
  for (const m of data.mirrors) for (const k of ['e', 'b']) if (!ids.has(m[k])) problems.push(`mirrors: unknown ${m[k]}`);
  if (problems.length) console.warn('topic data problems:\n' + problems.join('\n'));
}

function buildEdges(data) {
  const add = (kind, source, target, extra = {}) => {
    state.edges.push({ kind, source, target, ...extra });
    if (!state.adjacency.has(source)) state.adjacency.set(source, new Set());
    if (!state.adjacency.has(target)) state.adjacency.set(target, new Set());
    state.adjacency.get(source).add(target);
    state.adjacency.get(target).add(source);
  };
  for (const n of data.nodes) {
    state.parents.set(n.id, n.requires.slice());
    if (!state.children.has(n.id)) state.children.set(n.id, []);
    for (const r of n.requires) {
      add('requires', r, n.id);
      if (!state.children.has(r)) state.children.set(r, []);
      state.children.get(r).push(n.id);
    }
  }
  for (const t of data.translates) add('translates', t.a, t.b, { via: t.via });
  for (const m of data.mirrors) add('mirrors', m.e, m.b);
}

// ------------------------------------------------------------------ graph helpers
function closure(startIds, next) {
  const seen = new Set();
  const stack = [...startIds];
  while (stack.length) {
    const id = stack.pop();
    for (const n of next.get(id) || []) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  }
  return seen;
}
const ancestors = id => closure([id], state.parents);
const descendants = id => closure([id], state.children);
/** Everything on a topic's path: what it builds on, itself, and what builds on it. */
function pathSet(id) {
  const s = ancestors(id);
  for (const d of descendants(id)) s.add(d);
  s.add(id);
  return s;
}
function gapsSet() {
  const shaky = Object.entries(state.levels).filter(([, v]) => v === 'shaky').map(([k]) => k).filter(id => state.byId.has(id));
  const s = closure(shaky, state.children);
  shaky.forEach(id => s.add(id));
  return s;
}
/** Ids a view restricts itself to (the Maxwell grid), or null. */
function viewSet() {
  if (state.view !== 'maxwell' || !state.data.maxwell) return null;
  const m = state.data.maxwell;
  const ids = new Set();
  m.columns.forEach(c => c.header.forEach(id => ids.add(id)));
  m.rows.forEach(r => { ids.add(r.node); r.cells.flat().forEach(id => ids.add(id)); r.below.flat().forEach(id => ids.add(id)); });
  if (m.bridge) ids.add(m.bridge);
  if (m.future) ids.add(m.future);
  return new Set([...ids].filter(id => state.byId.has(id)));
}

/** The set of node ids currently visible, or null when everything is. */
function visibleSet() {
  let v = viewSet();
  if (state.focusSet) v = v ? new Set([...v].filter(id => state.focusSet.has(id))) : new Set(state.focusSet);
  if (state.gapsMode) {
    const g = gapsSet();
    v = v ? new Set([...v].filter(id => g.has(id))) : g;
  }
  return v;
}

// ------------------------------------------------------------------ legend
function buildLegend() {
  const legend = $('#legend');
  for (const g of state.data.groups) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="swatch" style="background:${g.color}"></span>${g.name}`;
    b.title = 'Click to dim this unit';
    b.addEventListener('click', () => {
      if (state.offGroups.has(g.id)) state.offGroups.delete(g.id); else state.offGroups.add(g.id);
      b.classList.toggle('off', state.offGroups.has(g.id));
      applyEmphasis();
    });
    legend.appendChild(b);
  }
}

// ------------------------------------------------------------------ nodes
function wrapText(text, maxChars, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

function buildNodes() {
  const layer = $('#nodes');
  for (const n of state.data.nodes) {
    const g = state.groupById.get(n.group);
    const grp = el('g', { class: `node kind-${n.kind} group-${n.group}${n.foreign ? ' foreign' : ''}`, 'data-id': n.id, tabindex: 0, role: 'button' });
    const rx = (n.kind === 'tool' || n.kind === 'concept') ? 20 : (n.kind === 'law' ? 5 : 10);
    grp.appendChild(el('rect', { class: 'box', width: NODE_W, height: NODE_H, rx, stroke: g.color }));
    if (n.kind !== 'exit') grp.appendChild(el('rect', { class: 'bar', x: 0, y: 0, width: 5, height: NODE_H, rx: 2.5, fill: g.color }));

    const kind = el('text', { class: 'kind', x: 14, y: 15 });
    kind.textContent = state.data.kinds[n.kind] || n.kind;
    grp.appendChild(kind);

    const lines = wrapText(n.name, 27, 3);
    const name = el('text', { class: 'name', x: 14, y: lines.length === 1 ? 37 : (lines.length === 2 ? 31 : 27) });
    lines.forEach((line, i) => {
      const t = el('tspan', { x: 14, dy: i === 0 ? 0 : 12.5 });
      t.textContent = line;
      name.appendChild(t);
    });
    grp.appendChild(name);

    // self-check marker (shown via CSS when a level is set)
    grp.appendChild(el('circle', { class: 'mark', cx: NODE_W - 10, cy: 10, r: 4 }));

    grp.addEventListener('mouseenter', () => { state.hovered = n.id; applyEmphasis(); });
    grp.addEventListener('mouseleave', () => { state.hovered = null; applyEmphasis(); });
    grp.addEventListener('click', e => { e.stopPropagation(); select(n.id); });
    grp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); } });

    layer.appendChild(grp);
    state.nodeEls.set(n.id, grp);
  }
  applyLevelClasses();
}

function applyLevelClasses() {
  for (const [id, g] of state.nodeEls) {
    LEVELS.forEach(l => g.classList.remove('lvl-' + l));
    const lvl = state.levels[id];
    if (lvl) g.classList.add('lvl-' + lvl);
  }
  renderProgress();
}

// ------------------------------------------------------------------ marks: progress line and transfer between browsers
function renderProgress() {
  const total = state.data.nodes.filter(n => n.kind !== 'exit').length;
  const counts = { shaky: 0, okay: 0, solid: 0 };
  for (const [id, lvl] of Object.entries(state.levels)) if (state.byId.has(id) && counts[lvl] != null) counts[lvl]++;
  const marked = counts.shaky + counts.okay + counts.solid;
  const p = $('#marks-progress');
  p.innerHTML = marked
    ? `Marked <b>${marked}</b> of ${total} · <b>${counts.shaky}</b> shaky · ${counts.okay} okay · ${counts.solid} solid`
    : `No topics marked yet — open a card and use <b>I know this</b>.`;
  $('#marks-copy').disabled = !marked;
}

/** A short, readable code: "<course> shaky:a,b okay:c solid:d,e" */
function marksToCode() {
  const parts = [state.course.id];
  for (const lvl of LEVELS) {
    const ids = Object.entries(state.levels).filter(([id, l]) => l === lvl && state.byId.has(id)).map(([id]) => id).sort();
    if (ids.length) parts.push(`${lvl}:${ids.join(',')}`);
  }
  return parts.join(' ');
}
function codeToMarks(code) {
  const tokens = code.trim().split(/\s+/);
  if (!tokens.length || !tokens[0]) throw new Error('Nothing to apply.');
  const courseId = tokens.shift();
  if (courseId !== state.course.id) throw new Error(`That code is for “${courseId}”, not this course.`);
  const levels = {};
  let unknown = 0;
  for (const t of tokens) {
    const [lvl, list] = t.split(':');
    if (!LEVELS.includes(lvl) || list == null) throw new Error(`Didn't understand “${t}”.`);
    for (const id of list.split(',').filter(Boolean)) {
      if (state.byId.has(id)) levels[id] = lvl; else unknown++;
    }
  }
  return { levels, unknown };
}
function wireMarks() {
  const io = $('#marks-io'), ta = $('#marks-text'), msg = $('#marks-msg');
  let mode = null;
  const open = (m, text, hint) => { mode = m; io.hidden = false; ta.value = text; msg.textContent = hint; ta.focus(); if (m === 'copy') ta.select(); };
  const close = () => { io.hidden = true; mode = null; $('#marks-clear').textContent = 'Clear'; $('#marks-clear').classList.remove('danger'); };

  $('#marks-copy').addEventListener('click', async () => {
    const code = marksToCode();
    let copied = false;
    try { await navigator.clipboard.writeText(code); copied = true; } catch { /* fall back to showing it */ }
    open('copy', code, copied ? 'Copied. Paste this code into the same page in another browser.' : 'Select and copy this code, then paste it into the same page in another browser.');
  });
  $('#marks-paste').addEventListener('click', () => open('paste', '', 'Paste a code from another browser, then Apply. It replaces the marks here.'));
  $('#marks-cancel').addEventListener('click', close);
  $('#marks-apply').addEventListener('click', () => {
    if (mode !== 'paste') { close(); return; }
    try {
      const { levels, unknown } = codeToMarks(ta.value);
      state.levels = levels;
      writeLevels();
      applyLevelClasses();
      if (state.selected) { renderLevelButtons(state.byId.get(state.selected)); renderReadiness(state.byId.get(state.selected)); }
      if (state.gapsMode) relayout();
      msg.textContent = `Applied ${Object.keys(levels).length} marks` + (unknown ? ` (${unknown} unknown topics skipped).` : '.');
      setTimeout(close, 1200);
    } catch (e) { msg.textContent = e.message; }
  });
  // Clear is a two-click action; no confirm() dialogs in this page.
  const clearBtn = $('#marks-clear');
  clearBtn.addEventListener('click', () => {
    if (clearBtn.textContent === 'Clear') { clearBtn.textContent = 'Really clear?'; clearBtn.classList.add('danger'); setTimeout(() => { clearBtn.textContent = 'Clear'; clearBtn.classList.remove('danger'); }, 3000); return; }
    state.levels = {};
    writeLevels();
    applyLevelClasses();
    if (state.selected) { renderLevelButtons(state.byId.get(state.selected)); renderReadiness(state.byId.get(state.selected)); }
    if (state.gapsMode) toggleGaps();
    close();
  });
}

function buildEdgeElements() {
  const layer = $('#edges');
  const labels = $('#edge-labels');
  for (const e of state.edges) {
    const p = el('path', { class: `edge ${e.kind}`, 'data-source': e.source, 'data-target': e.target });
    layer.appendChild(p);
    state.edgeEls.push(p);
    if (e.kind === 'translates') {
      const t = el('text', { class: 'edge-label', 'text-anchor': 'middle' });
      t.textContent = state.byId.get(e.via)?.name || e.via;
      labels.appendChild(t);
      state.labelEls.push({ edge: e, el: t });
    } else {
      state.labelEls.push(null);
    }
  }
}

// ------------------------------------------------------------------ hash  (#view or #view/topic-id)
function parseHash() {
  const [view, node] = location.hash.replace(/^#/, '').split('/');
  const ok = LAYOUTS[view] && (view !== 'maxwell' || state.data?.maxwell);
  return { view: ok ? view : 'flow', node: node || null };
}
function writeHash() {
  const h = '#' + state.view + (state.selected ? '/' + state.selected : '');
  if (location.hash !== h) history.replaceState(null, '', h);
}

// ------------------------------------------------------------------ views
function setView(view, { instant = false } = {}) {
  state.view = view;
  document.querySelectorAll('.views a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  writeHash();

  const hints = {
    flow: 'Left → right: what you need first. Click a topic to light up its whole path.',
    duality: 'Electrostatics ↔ magnetostatics, twin by twin. Hover a topic to see its own prerequisites.',
    units: 'Topics grouped the way the course is organized. Hover a topic to see what it connects to.',
    maxwell: state.data.maxwell?.caption || '',
  };
  $('#view-hint').textContent = hints[view] || '';
  $('#view-hint').classList.toggle('long', view === 'maxwell');

  relayout(instant ? 0 : 480);
}

/** Data restricted to the visible nodes, with edges that leave the set dropped. */
function visibleData() {
  const v = visibleSet();
  if (!v) return state.data;
  const keep = id => v.has(id);
  return {
    ...state.data,
    nodes: state.data.nodes.filter(n => keep(n.id)).map(n => ({ ...n, requires: n.requires.filter(keep) })),
    translates: state.data.translates.filter(t => keep(t.a) && keep(t.b)),
    mirrors: state.data.mirrors.filter(m => keep(m.e) && keep(m.b)),
  };
}

/** Recompute the current view's layout for whatever is visible and animate to it. */
function relayout(ms = 400) {
  const data = visibleData();
  const groupsInUse = new Set(data.nodes.map(n => n.group));
  const layoutData = { ...data, groups: data.groups.filter(g => groupsInUse.has(g.id)) };
  state.layout = LAYOUTS[state.view](layoutData, state.byId);
  // Nodes that are hidden keep their last position so they can animate back in later.
  for (const [id, p] of state.cur) if (!state.layout.pos.has(id)) state.layout.pos.set(id, p);
  drawClusters(state.layout.clusters);
  applyEmphasis();
  return animateTo(state.layout.pos, ms).then(() => fit(ms ? 300 : 0));
}

function drawClusters(clusters) {
  const layer = $('#clusters');
  layer.innerHTML = '';
  for (const c of clusters) {
    const g = el('g', { class: 'cluster' });
    g.appendChild(el('rect', { x: c.x, y: c.y, width: c.w, height: c.h, ...(c.color ? { stroke: c.color } : {}) }));
    const t = el('text', { x: c.x + 16, y: c.y + 22, ...(c.color ? { fill: c.color } : {}), ...(c.labelSize ? { 'font-size': c.labelSize } : {}) });
    t.textContent = c.label;
    g.appendChild(t);
    layer.appendChild(g);
  }
}

// ------------------------------------------------------------------ animation
function animateTo(target, ms) {
  if (reducedMotion()) ms = 0;
  if (state.anim) cancelAnimationFrame(state.anim);
  const from = new Map();
  for (const [id, p] of target) {
    const c = state.cur.get(id) || p;
    from.set(id, { x: c.x, y: c.y });
  }
  const ease = t => 1 - Math.pow(1 - t, 3);
  const t0 = performance.now();
  return new Promise(resolve => {
    const step = now => {
      const t = ms ? Math.min(1, (now - t0) / ms) : 1;
      const k = ease(t);
      for (const [id, p] of target) {
        const f = from.get(id);
        state.cur.set(id, { x: f.x + (p.x - f.x) * k, y: f.y + (p.y - f.y) * k });
      }
      drawPositions();
      if (t < 1) state.anim = requestAnimationFrame(step); else { state.anim = null; resolve(); }
    };
    step(performance.now());
  });
}

function drawPositions() {
  for (const [id, g] of state.nodeEls) {
    const p = state.cur.get(id);
    if (p) g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
  }
  state.edges.forEach((e, i) => {
    const s = state.cur.get(e.source), t = state.cur.get(e.target);
    if (!s || !t) return;
    const { d, mid } = edgePath(s, t);
    state.edgeEls[i].setAttribute('d', d);
    const lab = state.labelEls[i];
    if (lab) { lab.el.setAttribute('x', mid.x); lab.el.setAttribute('y', mid.y - 5); }
  });
}

/** Smooth path between two boxes, leaving from the side that faces the target. */
function edgePath(s, t) {
  const sc = { x: s.x + NODE_W / 2, y: s.y + NODE_H / 2 };
  const tc = { x: t.x + NODE_W / 2, y: t.y + NODE_H / 2 };
  const dx = tc.x - sc.x, dy = tc.y - sc.y;
  let p0, p1, c0, c1;
  if (Math.abs(dx) >= Math.abs(dy) * 0.8) {
    const dir = Math.sign(dx) || 1;
    p0 = { x: sc.x + dir * NODE_W / 2, y: sc.y };
    p1 = { x: tc.x - dir * NODE_W / 2, y: tc.y };
    const mx = (p0.x + p1.x) / 2;
    c0 = { x: mx, y: p0.y }; c1 = { x: mx, y: p1.y };
  } else {
    const dir = Math.sign(dy) || 1;
    p0 = { x: sc.x, y: sc.y + dir * NODE_H / 2 };
    p1 = { x: tc.x, y: tc.y - dir * NODE_H / 2 };
    const my = (p0.y + p1.y) / 2;
    c0 = { x: p0.x, y: my }; c1 = { x: p1.x, y: my };
  }
  const d = `M${p0.x},${p0.y} C${c0.x},${c0.y} ${c1.x},${c1.y} ${p1.x},${p1.y}`;
  return { d, mid: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 } };
}

// ------------------------------------------------------------------ emphasis (hover / select / search / legend / focus / gaps)
function matchesQuery(n) {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return n.name.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q) || (n.equation || '').toLowerCase().includes(q);
}

function applyEmphasis() {
  if (!state.data) return;
  const vis = state.layout?.edgeVisibility || { requires: true, translates: true, mirrors: true };
  const visible = visibleSet();

  // Hover shows one hop; a selected topic shows its whole path.
  const hoverId = state.hovered;
  const selId = state.selected;
  const near = hoverId ? (state.adjacency.get(hoverId) || new Set()) : null;
  const path = selId ? pathSet(selId) : null;
  const emphasisSet = near ? new Set([hoverId, ...near]) : path;   // nodes that stay bright
  const emphasisId = hoverId || selId;

  const isOff = n => state.offGroups.has(n.group) || !matchesQuery(n);

  for (const n of state.data.nodes) {
    const g = state.nodeEls.get(n.id);
    g.classList.toggle('hidden', !!visible && !visible.has(n.id));
    g.classList.toggle('focus', n.id === emphasisId);
    g.classList.toggle('selected', n.id === selId);
    g.classList.toggle('near', !!near && near.has(n.id));
    g.classList.toggle('path', !!path && !near && path.has(n.id) && n.id !== selId);
    g.classList.toggle('dim', isOff(n) || (!!emphasisSet && !emphasisSet.has(n.id)));
  }

  state.edges.forEach((e, i) => {
    const p = state.edgeEls[i];
    const s = state.byId.get(e.source), t = state.byId.get(e.target);
    const touches = !!emphasisId && (e.source === emphasisId || e.target === emphasisId);
    // An edge is "on the path" when both ends are in the selected topic's path (requires edges only).
    const onPath = !near && !!path && e.kind === 'requires' && path.has(e.source) && path.has(e.target);
    const hi = touches || onPath;
    const hiddenByView = !vis[e.kind] && !touches && !onPath;
    const hiddenByVisible = !!visible && !(visible.has(e.source) && visible.has(e.target));
    const hidden = hiddenByView || hiddenByVisible;
    const off = isOff(s) || isOff(t);
    p.classList.toggle('hidden', hidden);
    p.classList.toggle('hi', hi);
    p.classList.toggle('dim', !hi && (!!emphasisId || off));
    const lab = state.labelEls[i];
    if (lab) {
      lab.el.classList.toggle('hidden', hidden || (vis.labels === false && !touches));
      lab.el.classList.toggle('dim', !hi && (!!emphasisId || off));
    }
  });
}

// ------------------------------------------------------------------ selection & panel
function select(id, { fromHash = false } = {}) {
  const wasHidden = $('#panel').hidden;
  state.selected = id;
  applyEmphasis();
  showPanel(state.byId.get(id));
  writeHash();
  state.nodeEls.get(id)?.focus({ preventScroll: true });
  if (wasHidden && !fromHash) fit(250);   // make room for the panel
  if (fromHash) fit(0);
}

function clearSelection() {
  state.selected = null;
  applyEmphasis();
  $('#panel').hidden = true;
  writeHash();
}

function linkList(ids) {
  return ids.map(id => `<a data-goto="${id}">${state.byId.get(id).name}</a>`).join(', ');
}

function renderEquation(target, eq) {
  target.innerHTML = '';
  target.classList.remove('plain');
  if (!eq) return;
  if (state.data.meta.equationFormat === 'latex' && window.katex) {
    try { katex.render(eq, target, { displayMode: true, throwOnError: false }); return; } catch { /* fall through */ }
  }
  target.classList.add('plain');
  target.textContent = eq;
}

/**
 * Markdown + math. Math segments are lifted out before Markdown runs (so `_` and `*`
 * inside formulas are not read as emphasis), then rendered with KaTeX.
 */
function renderMarkdownWithMath(md) {
  const chunks = [];
  const keep = (tex, display) => { chunks.push({ tex, display }); return `\u0000MATH${chunks.length - 1}\u0000`; };
  let src = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t, true));
  src = src.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, pre, t) => pre + keep(t, false));
  let html = window.marked ? marked.parse(src) : `<pre>${src.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`;
  html = html.replace(/\u0000MATH(\d+)\u0000/g, (_, i) => {
    const { tex, display } = chunks[+i];
    if (window.katex) {
      try { return katex.renderToString(tex, { displayMode: display, throwOnError: false }); } catch { /* fall through */ }
    }
    return display ? `<pre>${tex}</pre>` : `<code>${tex}</code>`;
  });
  return html;
}

async function renderNotes(n) {
  const wrap = $('#p-notes-wrap'), out = $('#p-notes');
  if (!n.notes) { wrap.hidden = true; return; }
  wrap.hidden = false;
  if (typeof n.notes === 'string' && n.notes.endsWith('.md')) {
    out.innerHTML = '<p class="muted">Loading…</p>';
    let md = state.notesCache.get(n.notes);
    if (md == null) {
      try {
        const r = await fetch(n.notes);
        md = r.ok ? await r.text() : null;
      } catch { md = null; }
      state.notesCache.set(n.notes, md);
    }
    if (state.selected !== n.id) return;       // user moved on while we were fetching
    if (md == null) { out.innerHTML = `<p class="muted">Notes file not found: <code>${n.notes}</code></p>`; return; }
    out.innerHTML = renderMarkdownWithMath(md);
  } else {
    out.textContent = n.notes;
  }
}

function renderReadiness(n) {
  const p = $('#p-readiness');
  const anc = [...ancestors(n.id)];
  const shaky = anc.filter(id => state.levels[id] === 'shaky');
  const marked_ = anc.filter(id => state.levels[id]);
  if (!anc.length || !marked_.length) { p.hidden = true; return; }
  p.hidden = false;
  if (shaky.length) {
    p.className = 'readiness';
    p.innerHTML = `Builds on ${shaky.length} topic${shaky.length > 1 ? 's' : ''} you marked shaky: ${linkList(shaky)}.`;
  } else {
    p.className = 'readiness clear';
    p.textContent = marked_.length === anc.length
      ? 'Every prerequisite is marked okay or solid.'
      : `No shaky prerequisites (${anc.length - marked_.length} of ${anc.length} not yet marked).`;
  }
}

function renderLevelButtons(n) {
  document.querySelector('.selfcheck').hidden = !!n.foreign;
  document.querySelectorAll('.selfcheck .lvl').forEach(b => b.classList.toggle('on', state.levels[n.id] === b.dataset.level));
}

function showPanel(n) {
  const panel = $('#panel');
  const g = state.groupById.get(n.group);
  $('#p-group').textContent = g.short || g.name;
  $('#p-group').style.background = g.color;
  $('#p-kind').textContent = state.data.kinds[n.kind] || n.kind;
  $('#p-name').textContent = n.name;
  $('#p-summary').textContent = n.summary;

  renderLevelButtons(n);
  renderReadiness(n);

  const foreignWrap = $('#p-foreign');
  if (n.foreign) {
    const c = state.catalog.courses.find(x => x.id === n.foreign);
    foreignWrap.hidden = false;
    foreignWrap.innerHTML = `This topic is from <strong>${c ? c.name : n.foreign}</strong>. <a data-course="${n.foreign}" data-node="${n.id}">Open it there</a> for its notes and connections.`;
  } else foreignWrap.hidden = true;

  $('#p-eq-wrap').hidden = !n.equation;
  renderEquation($('#p-eq'), n.equation);

  $('#p-read-wrap').hidden = !n.sadiku;
  $('#p-read').textContent = n.sadiku ? `${state.data.meta.text ? state.data.meta.text.split(',')[0] : ''} §${n.sadiku}`.trim() : '';

  const tryWrap = $('#p-try-wrap');
  if (n.tryIt && n.tryIt.url) {
    tryWrap.hidden = false;
    $('#p-try').innerHTML = `<a href="${n.tryIt.url}" target="_blank" rel="noopener">${n.tryIt.label || 'Open the simulator'}</a>`;
  } else tryWrap.hidden = true;

  const pit = $('#p-pitfalls');
  pit.innerHTML = '';
  for (const s of n.pitfalls || []) {
    const li = document.createElement('li');
    li.innerHTML = window.marked ? marked.parseInline(s) : s;
    pit.appendChild(li);
  }
  $('#p-pitfalls-wrap').hidden = !(n.pitfalls && n.pitfalls.length);

  const checkWrap = $('#p-check-wrap');
  if (n.check && n.check.q) {
    checkWrap.hidden = false;
    $('#p-check-q').innerHTML = window.marked ? marked.parseInline(n.check.q) : n.check.q;
    $('#p-check-a').innerHTML = window.marked ? marked.parseInline(n.check.a || '') : (n.check.a || '');
    $('#p-check-a').hidden = true;
    $('#p-check-btn').textContent = 'Show answer';
  } else checkWrap.hidden = true;

  const res = $('#p-res');
  res.innerHTML = '';
  for (const r of n.resources || []) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${r.url}" target="_blank" rel="noopener">${r.label}</a>`;
    res.appendChild(li);
  }
  $('#p-res-wrap').hidden = !(n.resources && n.resources.length);

  const builds = n.requires;
  const unlocks = state.children.get(n.id) || [];
  const mirrors = state.data.mirrors.filter(m => m.e === n.id || m.b === n.id).map(m => (m.e === n.id ? m.b : m.e));
  const trans = state.data.translates.filter(t => t.a === n.id || t.b === n.id);

  $('#p-builds').innerHTML = builds.length ? `<span class="lbl">Builds on:</span> ${linkList(builds)}` : '';
  $('#p-unlocks').innerHTML = unlocks.length ? `<span class="lbl">Unlocks:</span> ${linkList(unlocks)}` : '';
  $('#p-mirror').innerHTML = mirrors.length ? `<span class="lbl">Twin:</span> ${linkList(mirrors)}` : '';
  $('#p-trans').innerHTML = trans.length
    ? trans.map(t => `<span class="lbl">Same law as</span> ${linkList([t.a === n.id ? t.b : t.a])} <span class="lbl">via</span> ${linkList([t.via])}`).join('<br>')
    : '';

  // Exit nodes may point at another course in the catalog.
  const leadsWrap = $('#p-leads-wrap');
  const target = n.leadsTo ? state.catalog.courses.find(c => c.id === n.leadsTo) : null;
  if (target) {
    leadsWrap.hidden = false;
    $('#p-leads').innerHTML = target.file
      ? `<a data-course="${target.id}" data-node="${n.leadsToNode || ''}">${target.name}</a>${target.status === 'draft' ? ' <span class="muted">(draft)</span>' : ''}`
      : `${target.name} <span class="muted">(coming)</span>`;
  } else leadsWrap.hidden = true;

  renderNotes(n);

  panel.hidden = false;
  panel.scrollTop = 0;
}

// ------------------------------------------------------------------ focus mode & gaps mode
function enterFocus(id) {
  state.focusSet = pathSet(id);
  $('#focus-text').textContent = `Showing the path through “${state.byId.get(id).name}” — ${state.focusSet.size} topics`;
  $('#focus-banner').hidden = false;
  relayout();
}
function exitFocus() {
  state.focusSet = null;
  $('#focus-banner').hidden = true;
  relayout();
}
function toggleGaps() {
  if (!state.gapsMode && gapsSet().size === 0) {
    $('#view-hint').textContent = 'Mark some topics “shaky” from their cards first — then My gaps shows them and everything that depends on them.';
    return;
  }
  state.gapsMode = !state.gapsMode;
  $('#gaps').setAttribute('aria-pressed', String(state.gapsMode));
  relayout();
}
function setLevel(id, level) {
  if (state.levels[id] === level) delete state.levels[id]; else state.levels[id] = level;
  writeLevels();
  applyLevelClasses();
  if (state.selected === id) { renderLevelButtons(state.byId.get(id)); renderReadiness(state.byId.get(id)); }
  if (state.gapsMode) {
    if (gapsSet().size === 0) toggleGaps(); else relayout();
  }
}

// ------------------------------------------------------------------ printable study sheet
/** Every topic as a compact card, in prerequisite order, answers at the end. */
function buildSheet() {
  const sheet = $('#sheet');
  const depth = computeDepth(state.data.nodes, state.byId);
  const gi = new Map(state.data.groups.map((g, i) => [g.id, i]));
  const nodes = state.data.nodes.slice().sort((a, b) =>
    gi.get(a.group) - gi.get(b.group) || depth.get(a.id) - depth.get(b.id) || a.name.localeCompare(b.name));
  const esc = str => String(str).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  const inline = str => (window.marked ? marked.parseInline(str) : esc(str));
  const text = state.data.meta.text ? state.data.meta.text.split(',')[0] : '';

  let html = `<h1>${esc(state.course.name)} — study sheet</h1>
    <p class="sub">${esc(state.catalog.title)} · ${esc(state.data.meta.subtitle || '')}${text ? ' · reading: ' + esc(state.data.meta.text) : ''}</p>`;
  const answers = [];
  let currentGroup = null;
  for (const n of nodes) {
    if (n.group !== currentGroup) {
      currentGroup = n.group;
      html += `<h2>${esc(state.groupById.get(n.group).name)}</h2>`;
    }
    const builds = n.requires.map(id => state.byId.get(id).name).join(', ');
    html += `<article class="card">
      <h3>${esc(n.name)}</h3>
      <p class="meta">${esc(state.data.kinds[n.kind] || n.kind)}${n.sadiku ? ` · ${esc(text)} §${esc(n.sadiku)}` : ''}${builds ? ` · builds on: ${esc(builds)}` : ''}</p>
      <p>${esc(n.summary)}</p>
      ${n.equation ? `<div class="eq" data-eq="${esc(n.equation).replace(/"/g, '&quot;')}"></div>` : ''}
      ${n.pitfalls && n.pitfalls.length ? `<ul>${n.pitfalls.map(x => `<li>${inline(x)}</li>`).join('')}</ul>` : ''}
      ${n.check && n.check.q ? `<p class="q">Check yourself (${answers.length + 1}): ${inline(n.check.q)}</p>` : ''}
    </article>`;
    if (n.check && n.check.q) answers.push({ n: answers.length + 1, name: n.name, a: n.check.a || '' });
  }
  if (answers.length) {
    html += `<section class="answers"><h2>Answers</h2><ol>${answers.map(a => `<li><strong>${esc(a.name)}.</strong> ${inline(a.a)}</li>`).join('')}</ol></section>`;
  }
  sheet.innerHTML = html;
  if (window.katex && state.data.meta.equationFormat === 'latex') {
    sheet.querySelectorAll('.eq[data-eq]').forEach(e => {
      try { katex.render(e.dataset.eq, e, { displayMode: true, throwOnError: false }); } catch { e.textContent = e.dataset.eq; }
    });
  } else {
    sheet.querySelectorAll('.eq[data-eq]').forEach(e => { e.textContent = e.dataset.eq; });
  }
}

function printSheet() {
  buildSheet();
  try { window.print(); }
  catch { $('#view-hint').textContent = 'Printing is not available in this viewer. Open the page on its own site and use the browser\u2019s Print.'; }
}

// ------------------------------------------------------------------ keyboard navigation
function siblingsOf(id) {
  const p = state.layout.pos.get(id);
  const visible = visibleSet();
  return state.data.nodes
    .filter(n => Math.abs(state.layout.pos.get(n.id).x - p.x) < 1 && (!visible || visible.has(n.id)))
    .sort((a, b) => state.layout.pos.get(a.id).y - state.layout.pos.get(b.id).y)
    .map(n => n.id);
}
function keyNav(e) {
  if (!state.selected) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const id = state.selected;
  const visible = visibleSet();
  const pick = list => list.find(x => !visible || visible.has(x));
  let next = null;
  if (e.key === 'ArrowLeft') next = pick(state.parents.get(id) || []);
  else if (e.key === 'ArrowRight') next = pick(state.children.get(id) || []);
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const sib = siblingsOf(id);
    const i = sib.indexOf(id);
    next = sib[(i + (e.key === 'ArrowDown' ? 1 : -1) + sib.length) % sib.length];
  }
  if (next && next !== id) { e.preventDefault(); select(next); }
}

// ------------------------------------------------------------------ pan / zoom
function applyTransform() {
  const { k, x, y } = state.transform;
  $('#viewport').setAttribute('transform', `translate(${x},${y}) scale(${k})`);
}

function bounds() {
  const visible = visibleSet();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [id, p] of state.layout.pos) {
    if (visible && !visible.has(id)) continue;
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H);
  }
  if (!visible) for (const c of state.layout.clusters) {
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: NODE_W, maxY: NODE_H };
  return { minX, minY, maxX, maxY };
}

function fit(ms = 300) {
  const svg = $('#map');
  const W = svg.clientWidth, H = svg.clientHeight;
  const panelOpen = !$('#panel').hidden && window.innerWidth > 760;
  const usableW = W - (panelOpen ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) : 0) - 40;
  const legendW = window.innerWidth > 760 ? 250 : 0;
  const b = bounds();
  const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
  const k = Math.min(1.1, (usableW - legendW) / bw, (H - 80) / bh);
  const x = legendW + 20 + ((usableW - legendW) - bw * k) / 2 - b.minX * k;
  const y = 20 + ((H - 40) - bh * k) / 2 - b.minY * k;
  tweenTransform({ k, x, y }, ms);
}

function tweenTransform(to, ms) {
  if (reducedMotion()) ms = 0;
  const from = { ...state.transform };
  const t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    const t = ms ? Math.min(1, (now - t0) / ms) : 1;
    const e = ease(t);
    state.transform = { k: from.k + (to.k - from.k) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
    applyTransform();
    if (t < 1) requestAnimationFrame(step);
  };
  step(performance.now());
}

function wirePanZoom() {
  const svg = $('#map');
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    if (e.target.closest('.node')) return;
    drag = { x: e.clientX, y: e.clientY, tx: state.transform.x, ty: state.transform.y, moved: false };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('dragging');
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    state.transform.x = drag.tx + dx; state.transform.y = drag.ty + dy;
    applyTransform();
  });
  const end = e => {
    if (!drag) return;
    if (!drag.moved && !e.target.closest('.node')) clearSelection();
    drag = null;
    svg.classList.remove('dragging');
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const k = Math.min(3, Math.max(0.2, state.transform.k * factor));
    const r = k / state.transform.k;
    state.transform = { k, x: mx - (mx - state.transform.x) * r, y: my - (my - state.transform.y) * r };
    applyTransform();
  }, { passive: false });
}

// ------------------------------------------------------------------ UI wiring
function wireUI() {
  document.querySelectorAll('.views a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    setView(a.dataset.view);
  }));
  window.addEventListener('hashchange', () => {
    const { view, node } = parseHash();
    if (view !== state.view) setView(view);
    if (node && node !== state.selected && state.byId.has(node)) select(node, { fromHash: true });
    if (!node && state.selected) clearSelection();
  });

  $('#search').addEventListener('input', e => { state.query = e.target.value.trim(); applyEmphasis(); });
  $('#fit').addEventListener('click', () => fit());
  $('#print').addEventListener('click', printSheet);
  $('#gaps').addEventListener('click', toggleGaps);
  $('#focus-exit').addEventListener('click', exitFocus);
  $('#p-focus').addEventListener('click', () => { if (state.selected) enterFocus(state.selected); });
  $('#p-check-btn').addEventListener('click', () => {
    const a = $('#p-check-a');
    a.hidden = !a.hidden;
    $('#p-check-btn').textContent = a.hidden ? 'Show answer' : 'Hide answer';
  });
  document.querySelectorAll('.selfcheck .lvl').forEach(b => b.addEventListener('click', () => {
    if (state.selected) setLevel(state.selected, b.dataset.level);
  }));
  $('#panel-close').addEventListener('click', clearSelection);
  $('#panel').addEventListener('click', e => {
    const a = e.target.closest('a[data-goto]');
    if (a) { e.preventDefault(); select(a.dataset.goto); return; }
    const c = e.target.closest('a[data-course]');
    if (c) { e.preventDefault(); loadCourse(c.dataset.course, c.dataset.node || null); }
  });
  $('#help-btn').addEventListener('click', () => { $('#help').hidden = false; });
  $('#help-close').addEventListener('click', () => { $('#help').hidden = true; });
  $('#help').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('#help').hidden) { $('#help').hidden = true; return; }
      if (state.focusSet) { exitFocus(); return; }
      clearSelection();
      return;
    }
    keyNav(e);
  });
  window.addEventListener('resize', () => fit(0));
  wirePanZoom();
  wireMarks();
}

main().catch(err => {
  console.error(err);
  $('#view-hint').textContent = 'Could not load course data — ' + err.message;
});
