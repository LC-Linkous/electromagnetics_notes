import { LAYOUTS, NODE_W, NODE_H } from './layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = sel => document.querySelector(sel);
const el = (tag, attrs = {}, ns = SVG_NS) => {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

// ------------------------------------------------------------------ state
const state = {
  data: null,
  byId: new Map(),
  groupById: new Map(),
  edges: [],              // { kind, source, target, via? }
  adjacency: new Map(),   // id -> Set of neighbor ids across all edge kinds
  view: 'flow',
  layout: null,           // { pos, clusters, edgeVisibility }
  cur: new Map(),         // animated positions id -> {x, y}
  selected: null,
  hovered: null,
  query: '',
  offGroups: new Set(),
  transform: { k: 1, x: 0, y: 0 },
  nodeEls: new Map(),
  edgeEls: [],
  labelEls: [],
  anim: null,
};

// ------------------------------------------------------------------ boot
async function main() {
  const res = await fetch('data/topics.json');
  const data = await res.json();
  state.data = data;
  data.nodes.forEach(n => state.byId.set(n.id, n));
  data.groups.forEach(g => state.groupById.set(g.id, g));
  validate(data);
  buildEdges(data);

  $('#title').textContent = data.meta.title || 'Notes';
  $('#subtitle').textContent = data.meta.subtitle || '';
  document.title = data.meta.title || document.title;

  buildLegend();
  buildNodes();
  buildEdgeElements();
  wireUI();

  const initial = (location.hash || '#flow').slice(1);
  setView(LAYOUTS[initial] ? initial : 'flow', { instant: true });
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
  if (problems.length) console.warn('topics.json problems:\n' + problems.join('\n'));
}

function buildEdges(data) {
  const add = (kind, source, target, extra = {}) => {
    state.edges.push({ kind, source, target, ...extra });
    if (!state.adjacency.has(source)) state.adjacency.set(source, new Set());
    if (!state.adjacency.has(target)) state.adjacency.set(target, new Set());
    state.adjacency.get(source).add(target);
    state.adjacency.get(target).add(source);
  };
  for (const n of data.nodes) for (const r of n.requires) add('requires', r, n.id);
  for (const t of data.translates) add('translates', t.a, t.b, { via: t.via });
  for (const m of data.mirrors) add('mirrors', m.e, m.b);
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
    const grp = el('g', { class: `node kind-${n.kind} group-${n.group}`, 'data-id': n.id, tabindex: 0, role: 'button' });
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

    grp.addEventListener('mouseenter', () => { state.hovered = n.id; applyEmphasis(); });
    grp.addEventListener('mouseleave', () => { state.hovered = null; applyEmphasis(); });
    grp.addEventListener('click', e => { e.stopPropagation(); select(n.id); });
    grp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); } });

    layer.appendChild(grp);
    state.nodeEls.set(n.id, grp);
  }
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

// ------------------------------------------------------------------ views
function setView(view, { instant = false } = {}) {
  state.view = view;
  document.querySelectorAll('.views a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);

  const hints = {
    flow: 'Left → right: what you need first. Hover a topic to trace what it builds on and what it unlocks.',
    duality: 'Electrostatics ↔ magnetostatics, twin by twin. Hover a topic to see its own prerequisites.',
    units: 'Topics grouped the way the course is organized. Hover a topic to see what it connects to.',
  };
  $('#view-hint').textContent = hints[view] || '';

  state.layout = LAYOUTS[view](state.data, state.byId);
  drawClusters(state.layout.clusters);
  applyEmphasis();
  animateTo(state.layout.pos, instant ? 0 : 480).then(() => fit(instant ? 0 : 300));
}

function drawClusters(clusters) {
  const layer = $('#clusters');
  layer.innerHTML = '';
  for (const c of clusters) {
    const g = el('g', { class: 'cluster' });
    g.appendChild(el('rect', { x: c.x, y: c.y, width: c.w, height: c.h, ...(c.color ? { stroke: c.color } : {}) }));
    const t = el('text', { x: c.x + 16, y: c.y + 22, ...(c.color ? { fill: c.color } : {}) });
    t.textContent = c.label;
    g.appendChild(t);
    layer.appendChild(g);
  }
}

// ------------------------------------------------------------------ animation
function animateTo(target, ms) {
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

// ------------------------------------------------------------------ emphasis (hover / select / search / legend)
function matchesQuery(n) {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return n.name.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q) || (n.equation || '').toLowerCase().includes(q);
}

function applyEmphasis() {
  const focusId = state.hovered || state.selected;
  const near = focusId ? state.adjacency.get(focusId) || new Set() : null;
  const vis = state.layout?.edgeVisibility || { requires: true, translates: true, mirrors: true };

  for (const n of state.data.nodes) {
    const g = state.nodeEls.get(n.id);
    const off = state.offGroups.has(n.group) || !matchesQuery(n);
    const isFocus = n.id === focusId;
    const isNear = near ? near.has(n.id) : false;
    g.classList.toggle('focus', isFocus);
    g.classList.toggle('selected', n.id === state.selected);
    g.classList.toggle('near', !!(near && isNear));
    g.classList.toggle('dim', off || (!!near && !isFocus && !isNear));
  }

  state.edges.forEach((e, i) => {
    const p = state.edgeEls[i];
    const touches = focusId && (e.source === focusId || e.target === focusId);
    // In a view that hides this edge kind, still show it while it touches the focused node.
    const hidden = !vis[e.kind] && !touches;
    const srcOff = state.offGroups.has(state.byId.get(e.source).group) || !matchesQuery(state.byId.get(e.source));
    const tgtOff = state.offGroups.has(state.byId.get(e.target).group) || !matchesQuery(state.byId.get(e.target));
    p.classList.toggle('hidden', hidden);
    p.classList.toggle('hi', !!touches);
    p.classList.toggle('dim', !touches && (!!focusId || srcOff || tgtOff));
    const lab = state.labelEls[i];
    if (lab) {
      lab.el.classList.toggle('hidden', hidden);
      lab.el.classList.toggle('dim', !touches && (!!focusId || srcOff || tgtOff));
    }
  });
}

// ------------------------------------------------------------------ selection & panel
function select(id) {
  const wasHidden = $('#panel').hidden;
  state.selected = id;
  applyEmphasis();
  showPanel(state.byId.get(id));
  if (wasHidden) fit(250);   // make room for the panel
}

function clearSelection() {
  state.selected = null;
  applyEmphasis();
  $('#panel').hidden = true;
}

function linkList(ids) {
  return ids.map(id => `<a data-goto="${id}">${state.byId.get(id).name}</a>`).join(', ');
}

function showPanel(n) {
  const panel = $('#panel');
  const g = state.groupById.get(n.group);
  $('#p-group').textContent = g.short || g.name;
  $('#p-group').style.background = g.color;
  $('#p-kind').textContent = state.data.kinds[n.kind] || n.kind;
  $('#p-name').textContent = n.name;
  $('#p-summary').textContent = n.summary;

  $('#p-eq-wrap').hidden = !n.equation;
  $('#p-eq').textContent = n.equation || '';

  $('#p-read-wrap').hidden = !n.sadiku;
  $('#p-read').textContent = n.sadiku ? `${state.data.meta.text ? state.data.meta.text.split(',')[0] : ''} §${n.sadiku}`.trim() : '';

  const tryWrap = $('#p-try-wrap');
  if (n.tryIt && n.tryIt.url) {
    tryWrap.hidden = false;
    $('#p-try').innerHTML = `<a href="${n.tryIt.url}" target="_blank" rel="noopener">${n.tryIt.label || 'Open the simulator'}</a>`;
  } else tryWrap.hidden = true;

  const res = $('#p-res');
  res.innerHTML = '';
  for (const r of n.resources || []) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${r.url}" target="_blank" rel="noopener">${r.label}</a>`;
    res.appendChild(li);
  }
  $('#p-res-wrap').hidden = !(n.resources && n.resources.length);

  const builds = n.requires;
  const unlocks = state.data.nodes.filter(m => m.requires.includes(n.id)).map(m => m.id);
  const mirrors = state.data.mirrors.filter(m => m.e === n.id || m.b === n.id).map(m => (m.e === n.id ? m.b : m.e));
  const trans = state.data.translates.filter(t => t.a === n.id || t.b === n.id);

  $('#p-builds').innerHTML = builds.length ? `<span class="lbl">Builds on:</span> ${linkList(builds)}` : '';
  $('#p-unlocks').innerHTML = unlocks.length ? `<span class="lbl">Unlocks:</span> ${linkList(unlocks)}` : '';
  $('#p-mirror').innerHTML = mirrors.length ? `<span class="lbl">Twin:</span> ${linkList(mirrors)}` : '';
  $('#p-trans').innerHTML = trans.length
    ? trans.map(t => `<span class="lbl">Same law as</span> ${linkList([t.a === n.id ? t.b : t.a])} <span class="lbl">via</span> ${linkList([t.via])}`).join('<br>')
    : '';

  const notesWrap = $('#p-notes-wrap');
  if (n.notes) { notesWrap.hidden = false; $('#p-notes').textContent = n.notes; } else notesWrap.hidden = true;

  panel.hidden = false;
  panel.scrollTop = 0;
}

// ------------------------------------------------------------------ pan / zoom
function applyTransform() {
  const { k, x, y } = state.transform;
  $('#viewport').setAttribute('transform', `translate(${x},${y}) scale(${k})`);
}

function bounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of state.layout.pos.values()) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H);
  }
  for (const c of state.layout.clusters) {
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
  }
  return { minX, minY, maxX, maxY };
}

function fit(ms = 300) {
  const svg = $('#map');
  const W = svg.clientWidth, H = svg.clientHeight;
  const panelOpen = !$('#panel').hidden && window.innerWidth > 760;
  const usableW = W - (panelOpen ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) : 0) - 40;
  const legendW = window.innerWidth > 760 ? 180 : 0;
  const b = bounds();
  const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
  const k = Math.min(1.1, (usableW - legendW) / bw, (H - 80) / bh);
  const x = legendW + 20 + ((usableW - legendW) - bw * k) / 2 - b.minX * k;
  const y = 20 + ((H - 40) - bh * k) / 2 - b.minY * k;
  tweenTransform({ k, x, y }, ms);
}

function tweenTransform(to, ms) {
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
    const v = location.hash.slice(1);
    if (LAYOUTS[v] && v !== state.view) setView(v);
  });

  $('#search').addEventListener('input', e => { state.query = e.target.value.trim(); applyEmphasis(); });
  $('#fit').addEventListener('click', () => fit());
  $('#panel-close').addEventListener('click', clearSelection);
  $('#panel').addEventListener('click', e => {
    const a = e.target.closest('a[data-goto]');
    if (a) { e.preventDefault(); select(a.dataset.goto); }
  });
  $('#help-btn').addEventListener('click', () => { $('#help').hidden = false; });
  $('#help-close').addEventListener('click', () => { $('#help').hidden = true; });
  $('#help').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#help').hidden = true; clearSelection(); }
  });
  window.addEventListener('resize', () => fit(0));
  wirePanZoom();
}

main().catch(err => {
  console.error(err);
  $('#view-hint').textContent = 'Could not load data/topics.json — ' + err.message;
});
