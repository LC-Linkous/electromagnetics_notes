// Layout algorithms. Each returns { pos: Map<id, {x, y}>, clusters: [...] }
// where x,y is the top-left corner of the node box.
// All three views are plain functions of the data, so swapping data/topics.json
// for another course gives a new map with no code changes.

export const NODE_W = 176;
export const NODE_H = 58;

const COL_GAP = 60;  // flow view: horizontal gap between depth columns
const ROW_GAP = 16;   // vertical gap between stacked nodes

/** Longest-path depth over `requires` edges. Roots are depth 0. */
export function computeDepth(nodes, byId) {
  const depth = new Map();
  const visit = (n, stack = new Set()) => {
    if (depth.has(n.id)) return depth.get(n.id);
    if (stack.has(n.id)) throw new Error(`Cycle in requires at ${n.id}`);
    stack.add(n.id);
    let d = 0;
    for (const p of n.requires) {
      const parent = byId.get(p);
      if (!parent) throw new Error(`${n.id} requires unknown node ${p}`);
      d = Math.max(d, visit(parent, stack) + 1);
    }
    stack.delete(n.id);
    depth.set(n.id, d);
    return d;
  };
  nodes.forEach(n => visit(n));
  return depth;
}

/** Order groups the way they are listed in the data. */
function groupIndex(groups) {
  const m = new Map();
  groups.forEach((g, i) => m.set(g.id, i));
  return m;
}

function stackColumn(ids, x, pos, rowH = NODE_H + ROW_GAP) {
  ids.forEach((id, i) => pos.set(id, { x, y: i * rowH }));
  return ids.length * rowH - ROW_GAP;
}

/** Center each column vertically around y = 0. */
function centerColumns(columns, pos, rowH = NODE_H + ROW_GAP) {
  for (const ids of columns) {
    const h = ids.length * rowH - ROW_GAP;
    ids.forEach(id => { const p = pos.get(id); p.y -= h / 2; });
  }
}

// ---------------------------------------------------------------- Flow view
export function layoutFlow(data, byId) {
  const depth = computeDepth(data.nodes, byId);
  const gi = groupIndex(data.groups);
  const maxD = Math.max(...depth.values());
  const columns = Array.from({ length: maxD + 1 }, () => []);
  data.nodes.forEach(n => columns[depth.get(n.id)].push(n));

  const pos = new Map();
  const rowH = NODE_H + ROW_GAP;

  // Initial order: by unit, then by name. Then two barycenter passes to reduce crossings.
  columns.forEach(col => col.sort((a, b) => gi.get(a.group) - gi.get(b.group) || a.name.localeCompare(b.name)));
  columns.forEach((col, ci) => stackColumn(col.map(n => n.id), ci * (NODE_W + COL_GAP), pos, rowH));

  for (let pass = 0; pass < 3; pass++) {
    for (let ci = 1; ci < columns.length; ci++) {
      const col = columns[ci];
      const bary = n => {
        const ys = n.requires.map(p => pos.get(p).y);
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : pos.get(n.id).y;
      };
      // Keep unit grouping as the primary key so colors stay in bands; barycenter within a unit.
      col.sort((a, b) => gi.get(a.group) - gi.get(b.group) || bary(a) - bary(b));
      stackColumn(col.map(n => n.id), ci * (NODE_W + COL_GAP), pos, rowH);
    }
  }
  centerColumns(columns.map(c => c.map(n => n.id)), pos, rowH);
  return { pos, clusters: [], edgeVisibility: { requires: true, translates: true, mirrors: false } };
}

// ------------------------------------------------------------- Duality view
export function layoutDuality(data, byId) {
  const depth = computeDepth(data.nodes, byId);
  const byDepth = (a, b) => depth.get(a.id) - depth.get(b.id) || a.name.localeCompare(b.name);

  // Keep the integral and differential forms of a law stacked next to each other.
  const pairUp = list => {
    const out = list.slice();
    for (const t of data.translates) {
      const ia = out.findIndex(n => n.id === t.a), ib = out.findIndex(n => n.id === t.b);
      if (ia < 0 || ib < 0) continue;
      const [bNode] = out.splice(ib, 1);
      out.splice(out.findIndex(n => n.id === t.a) + 1, 0, bNode);
    }
    return out;
  };
  const eNodes = pairUp(data.nodes.filter(n => n.side === 'E').sort(byDepth));
  const bNodes = pairUp(data.nodes.filter(n => n.side === 'B').sort(byDepth));
  const cNodes = data.nodes.filter(n => n.side === 'center' && n.kind !== 'exit').sort(byDepth);
  const exits = data.nodes.filter(n => n.kind === 'exit').sort(byDepth);

  const mirrorOf = new Map();
  for (const m of data.mirrors) {
    if (!mirrorOf.has(m.e)) mirrorOf.set(m.e, m.b);
  }

  // Build rows: each E node gets a row; its mirror (if any, and not yet placed) shares it.
  const rows = [];
  const placedB = new Set();
  for (const e of eNodes) {
    const b = mirrorOf.get(e.id);
    if (b && !placedB.has(b)) { rows.push({ e: e.id, b }); placedB.add(b); }
    else rows.push({ e: e.id, b: null });
  }
  for (const b of bNodes) if (!placedB.has(b.id)) rows.push({ e: null, b: b.id });

  const pos = new Map();
  const rowH = NODE_H + ROW_GAP;
  const colGap = 150;
  const xE = 0, xC = NODE_W + colGap, xB = 2 * (NODE_W + colGap);

  rows.forEach((r, i) => {
    if (r.e) pos.set(r.e, { x: xE, y: i * rowH });
    if (r.b) pos.set(r.b, { x: xB, y: i * rowH });
  });
  const totalH = rows.length * rowH - ROW_GAP;

  // Center column: tools on top, then the bridge law(s), then exits at the bottom.
  const centerIds = cNodes.map(n => n.id);
  const exitIds = exits.map(n => n.id);
  const centerH = (centerIds.length + exitIds.length) * rowH - ROW_GAP + 40;
  let y = (totalH - centerH) / 2;
  centerIds.forEach(id => { pos.set(id, { x: xC, y }); y += rowH; });
  y += 40;
  exitIds.forEach(id => { pos.set(id, { x: xC, y }); y += rowH; });

  // Recenter everything on y = 0
  for (const p of pos.values()) p.y -= totalH / 2;

  const clusters = [
    { label: 'Electrostatics', x: xE - 18, y: -totalH / 2 - 34, w: NODE_W + 36, h: totalH + 50 },
    { label: 'Magnetostatics', x: xB - 18, y: -totalH / 2 - 34, w: NODE_W + 36, h: totalH + 50 },
  ];
  return { pos, clusters, edgeVisibility: { requires: false, translates: true, mirrors: true } };
}

// --------------------------------------------------------------- Units view
export function layoutUnits(data, byId) {
  const depth = computeDepth(data.nodes, byId);
  const byDepth = (a, b) => depth.get(a.id) - depth.get(b.id) || a.name.localeCompare(b.name);

  // Two rows of clusters, filled row by row in the order groups are listed, with any
  // group that holds only exit nodes moved to the end. For the intro course that gives
  // Units 1–3 over Units 4–5 + Beyond, so the electric half sits above the magnetic half.
  const isExitGroup = g => data.nodes.filter(n => n.group === g.id).every(n => n.kind === 'exit');
  const order = [...data.groups.filter(g => !isExitGroup(g)), ...data.groups.filter(isExitGroup)].map(g => g.id);
  const cols = Math.ceil(order.length / 2);
  const slots = {};
  order.forEach((id, i) => { slots[id] = { col: i % cols, row: Math.floor(i / cols) }; });

  const pos = new Map();
  const clusters = [];
  const perRow = 2;
  const pad = 22, title = 30;
  const cellW = NODE_W + 14, cellH = NODE_H + 14;
  const clusterW = perRow * cellW - 14 + 2 * pad;
  const clusterGapX = 60, clusterGapY = 60;

  // Column widths are equal; row heights depend on tallest cluster in the row.
  const rowHeights = [0, 0];
  const clusterNodes = new Map();
  for (const g of data.groups) {
    const ns = data.nodes.filter(n => n.group === g.id).sort(byDepth);
    clusterNodes.set(g.id, ns);
    const h = Math.ceil(ns.length / perRow) * cellH - 14 + 2 * pad + title;
    const r = slots[g.id].row;
    rowHeights[r] = Math.max(rowHeights[r] || 0, h);
  }

  for (const g of data.groups) {
    const { col, row } = slots[g.id];
    const ns = clusterNodes.get(g.id);
    const h = Math.ceil(ns.length / perRow) * cellH - 14 + 2 * pad + title;
    const cx = col * (clusterW + clusterGapX);
    const cy = row === 0 ? 0 : rowHeights[0] + clusterGapY;
    clusters.push({ label: g.name, x: cx, y: cy, w: clusterW, h, color: g.color });
    ns.forEach((n, i) => {
      pos.set(n.id, {
        x: cx + pad + (i % perRow) * cellW,
        y: cy + pad + title + Math.floor(i / perRow) * cellH,
      });
    });
  }
  // Edges only appear on hover here; drawn all at once they hide the grouping.
  return { pos, clusters, edgeVisibility: { requires: false, translates: true, mirrors: false, labels: false } };
}

export const LAYOUTS = { flow: layoutFlow, duality: layoutDuality, units: layoutUnits };
