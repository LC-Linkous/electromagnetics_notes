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
  const collapsed = data.collapsedGroups || new Set();
  const clusterH = (g, ns) => (collapsed.has(g.id) ? title + 2 * pad : Math.ceil(ns.length / perRow) * cellH - 14 + 2 * pad + title);
  for (const g of data.groups) {
    const ns = data.nodes.filter(n => n.group === g.id).sort(byDepth);
    clusterNodes.set(g.id, ns);
    const r = slots[g.id].row;
    rowHeights[r] = Math.max(rowHeights[r] || 0, clusterH(g, ns));
  }

  for (const g of data.groups) {
    const { col, row } = slots[g.id];
    const ns = clusterNodes.get(g.id);
    const h = clusterH(g, ns);
    const cx = col * (clusterW + clusterGapX);
    const cy = row === 0 ? 0 : rowHeights[0] + clusterGapY;
    const isCollapsed = collapsed.has(g.id);
    clusters.push({
      label: `${isCollapsed ? '▸' : '▾'} ${g.name}${isCollapsed ? `  ·  ${g.count ?? ns.length} topics` : ''}`,
      x: cx, y: cy, w: clusterW, h, color: g.color, groupId: g.id, collapsed: isCollapsed,
    });
    if (isCollapsed) continue;
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

// -------------------------------------------------------------- Maxwell view
/**
 * The 2×2 grid described by data.maxwell:
 *   rows    – one per field; the row's own node (E, B) is the row header
 *   columns – divergence / curl; each has a stack of header nodes (concept, operator, theorem)
 *   cells   – [integralForm, differentialForm] pairs
 *   below   – nodes hanging under each cell (sources and explicit solutions, potentials)
 *   bridge  – the one law that touches both rows (Lorentz), placed between them
 *   future  – the exit that fills the empty-looking cells once fields vary in time
 * Ids missing from the data (hidden by focus or gaps mode) are skipped.
 */
export function layoutMaxwell(data, byId) {
  const spec = data.maxwell;
  const pos = new Map();
  const clusters = [];
  if (!spec) return { pos, clusters, edgeVisibility: { requires: true, translates: true, mirrors: false } };

  const has = id => data.nodes.some(n => n.id === id);
  const PAIR_GAP = 70;                 // between integral and differential form
  const CELL_W = 2 * NODE_W + PAIR_GAP;
  const COL_GAPX = 120;
  const ROW_GAP = 16;
  const rowH = NODE_H + ROW_GAP;
  const xRowHeader = 0;
  const xCol = c => NODE_W + 110 + c * (CELL_W + COL_GAPX);
  const pad = 22;

  // Column headers: stacked at the top, centered on the cell.
  const headerCount = Math.max(...spec.columns.map(c => c.header.length));
  let y = 0;
  spec.columns.forEach((col, c) => {
    const cx = xCol(c) + CELL_W / 2 - NODE_W / 2;
    col.header.forEach((id, i) => { if (has(id)) pos.set(id, { x: cx, y: i * rowH }); });
  });
  y = headerCount * rowH + 30;

  // Rows
  const rowTops = [];
  spec.rows.forEach((row, r) => {
    const top = y;
    const belowDepth = Math.max(...row.below.map(b => b.filter(has).length), 0);
    const blockH = rowH + belowDepth * rowH;
    if (has(row.node)) pos.set(row.node, { x: xRowHeader, y: top + (blockH - ROW_GAP) / 2 - NODE_H / 2 });
    row.cells.forEach((pair, c) => {
      const [intId, diffId] = pair;
      if (has(intId)) pos.set(intId, { x: xCol(c), y: top });
      if (has(diffId)) pos.set(diffId, { x: xCol(c) + NODE_W + PAIR_GAP, y: top });
      const below = (row.below[c] || []).filter(has);
      below.forEach((id, i) => pos.set(id, { x: xCol(c) + CELL_W / 2 - NODE_W / 2, y: top + (i + 1) * rowH }));
    });
    rowTops.push({ top, h: blockH });
    y = top + blockH + (r < spec.rows.length - 1 ? 110 : 0);   // room for the bridge between rows
  });

  // Bridge: between the two rows, under the row headers.
  if (spec.bridge && has(spec.bridge) && rowTops.length >= 2) {
    const a = rowTops[0], b = rowTops[1];
    const mid = (a.top + a.h + b.top) / 2;
    pos.set(spec.bridge, { x: xRowHeader, y: mid - NODE_H / 2 });
  }
  // Future: to the right of the curl column, between the two rows.
  if (spec.future && has(spec.future) && rowTops.length >= 2) {
    const a = rowTops[0], b = rowTops[1];
    const mid = (a.top + a.h + b.top) / 2;
    pos.set(spec.future, { x: xCol(spec.columns.length - 1) + CELL_W + 90, y: mid - NODE_H / 2 });
  }

  // Column frames
  const totalBottom = y;
  spec.columns.forEach((col, c) => {
    clusters.push({ label: col.label, x: xCol(c) - pad, y: -pad - 14, w: CELL_W + 2 * pad, h: totalBottom + 2 * pad + 14, labelSize: 12 });
  });

  // Center on y = 0 like the other views
  const shift = totalBottom / 2;
  for (const p of pos.values()) p.y -= shift;
  for (const c of clusters) c.y -= shift;

  return { pos, clusters, edgeVisibility: { requires: true, translates: true, mirrors: false, labels: false } };
}

export const LAYOUTS = { flow: layoutFlow, duality: layoutDuality, units: layoutUnits, maxwell: layoutMaxwell };
