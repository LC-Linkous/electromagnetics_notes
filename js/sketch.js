// Small SVG sketches for the equation builder: a source's field pattern, optionally with a
// candidate Gaussian surface or Amperian loop drawn over it. The point of the drawing is to
// show whether the field is normal/tangent to the shape and constant along it — not to be
// a precise field plot.

const W = 220, H = 150, CX = 110, CY = 75;
const NS = 'http://www.w3.org/2000/svg';

const col = {
  src: '#1f2328', field: '#d97706', fieldB: '#2563eb', shape: '#0e9f6e', shapeBad: '#e02424', shapeNeutral: '#6b7280', faint: '#e5e7eb',
};
const sc = state => (state === 'ok' ? col.shape : state === 'bad' ? col.shapeBad : col.shapeNeutral);
const sd = state => (state === 'bad' ? '5 4' : '');

function arrow(x1, y1, x2, y2, color, w = 1.6) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = x2 - 6 * Math.cos(a), hy = y2 - 6 * Math.sin(a);
  const l = `<line x1="${x1}" y1="${y1}" x2="${hx}" y2="${hy}" stroke="${color}" stroke-width="${w}" />`;
  const p1x = x2 - 7 * Math.cos(a - 0.45), p1y = y2 - 7 * Math.sin(a - 0.45);
  const p2x = x2 - 7 * Math.cos(a + 0.45), p2y = y2 - 7 * Math.sin(a + 0.45);
  return l + `<polygon points="${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}" fill="${color}" />`;
}
const dot = (x, y, r, color = col.src) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" />`;
const odot = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${col.src}" stroke-width="1.4" />` + dot(x, y, 1.6);
const xdot = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${col.src}" stroke-width="1.4" />`
  + `<line x1="${x - 3}" y1="${y - 3}" x2="${x + 3}" y2="${y + 3}" stroke="${col.src}" stroke-width="1.3"/>`
  + `<line x1="${x - 3}" y1="${y + 3}" x2="${x + 3}" y2="${y - 3}" stroke="${col.src}" stroke-width="1.3"/>`;

// ------------------------------------------------------------------ sources & field patterns
const FIELDS = {
  // Point / sphere: radial from the center.
  'radial-point': () => {
    let s = dot(CX, CY, 4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 2 * Math.PI;
      s += arrow(CX + 14 * Math.cos(a), CY + 14 * Math.sin(a), CX + 62 * Math.cos(a), CY + 62 * Math.sin(a), col.field);
    }
    return s;
  },
  // Line / cylinder, side view: a vertical axis; E points straight away from it, the same at every height.
  'radial-axis': () => {
    let s = `<line x1="${CX}" y1="8" x2="${CX}" y2="${H - 8}" stroke="${col.src}" stroke-width="3" />`;
    for (const y of [22, 44, 66, 88, 110, 132]) {
      s += arrow(CX + 8, y, CX + 62, y, col.field) + arrow(CX - 8, y, CX - 62, y, col.field);
    }
    return s;
  },
  // Infinite sheet, edge-on: E straight away from it on both sides, same everywhere.
  'normal-plane': () => {
    let s = `<line x1="8" y1="${CY}" x2="${W - 8}" y2="${CY}" stroke="${col.src}" stroke-width="3" />`;
    for (const x of [30, 60, 90, 120, 150, 180]) {
      s += arrow(x, CY - 6, x, CY - 48, col.field) + arrow(x, CY + 6, x, CY + 48, col.field);
    }
    return s;
  },
  // Wire, end-on (current out of the page): B circles it, weaker further out.
  'circling': () => {
    let s = odot(CX, CY);
    for (const [r, n, w] of [[28, 8, 2], [52, 12, 1.4]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI, da = 0.42;
        s += arrow(CX + r * Math.cos(a), CY + r * Math.sin(a), CX + r * Math.cos(a + da), CY + r * Math.sin(a + da), col.fieldB, w);
      }
    }
    return s;
  },
  // Current sheet, edge-on (current into the page): B parallel to the sheet, opposite on the two sides.
  'parallel-plane-B': () => {
    let s = '';
    for (const x of [26, 54, 82, 110, 138, 166, 194]) s += xdot(x, CY);
    for (const y of [CY - 24, CY - 46]) s += arrow(40, y, 180, y, col.fieldB);
    for (const y of [CY + 24, CY + 46]) s += arrow(180, y, 40, y, col.fieldB);
    return s;
  },
  // Long solenoid, side view cut lengthwise: uniform B inside, nothing outside.
  'solenoid': () => {
    let s = '';
    for (const x of [30, 56, 82, 108, 134, 160, 186]) s += odot(x, 36) + xdot(x, 114);
    for (const y of [56, 75, 94]) s += arrow(26, y, 194, y, col.fieldB);
    s += `<text x="${W - 6}" y="16" text-anchor="end" font-size="9" fill="#6b7280">B = 0 outside</text>`;
    return s;
  },
  // Toroid, top view: B circles the central axis inside the windings only.
  'toroid': () => {
    let s = `<circle cx="${CX}" cy="${CY}" r="64" fill="none" stroke="${col.faint}" stroke-width="30" />`;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * Math.PI, da = 0.3, r = 64;
      s += arrow(CX + r * Math.cos(a), CY + r * Math.sin(a), CX + r * Math.cos(a + da), CY + r * Math.sin(a + da), col.fieldB, 1.4);
    }
    return s;
  },
  // Dipole: two charges, curving field — no surface helps.
  'dipole': () => {
    let s = dot(CX - 30, CY, 5, col.field) + dot(CX + 30, CY, 5, '#2563eb')
      + `<text x="${CX - 30}" y="${CY - 10}" text-anchor="middle" font-size="10" fill="#6b7280">+</text><text x="${CX + 30}" y="${CY - 10}" text-anchor="middle" font-size="10" fill="#6b7280">−</text>`;
    for (const k of [22, 44, 66]) {
      s += `<path d="M ${CX - 30} ${CY - 4} C ${CX - 30 - k} ${CY - k * 1.6}, ${CX + 30 + k} ${CY - k * 1.6}, ${CX + 30} ${CY - 4}" fill="none" stroke="${col.field}" stroke-width="1.3" />`;
      s += `<path d="M ${CX - 30} ${CY + 4} C ${CX - 30 - k} ${CY + k * 1.6}, ${CX + 30 + k} ${CY + k * 1.6}, ${CX + 30} ${CY + 4}" fill="none" stroke="${col.field}" stroke-width="1.3" />`;
    }
    s += arrow(CX - 10, CY, CX + 10, CY, col.field);
    return s;
  },
  // Finite line / segment: ends break the symmetry; field fans out near the ends.
  'finite-line': (law) => {
    const c = law === 'ampere' ? col.fieldB : col.field;
    let s = `<line x1="${CX}" y1="40" x2="${CX}" y2="110" stroke="${col.src}" stroke-width="3" />`;
    if (law === 'ampere') {
      for (const [r, n] of [[26, 8]]) for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI, da = 0.42;
        s += arrow(CX + r * Math.cos(a), CY + r * 0.35 * Math.sin(a), CX + r * Math.cos(a + da), CY + r * 0.35 * Math.sin(a + da), c, 1.4);
      }
      s += `<text x="${CX}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#6b7280">weaker and tilted near the ends</text>`;
    } else {
      for (const y of [50, 75, 100]) s += arrow(CX + 8, y, CX + 56, y, c) + arrow(CX - 8, y, CX - 56, y, c);
      s += arrow(CX, 34, CX, 10, c) + arrow(CX, 116, CX, 140, c);
      s += arrow(CX + 8, 42, CX + 44, 18, c) + arrow(CX - 8, 42, CX - 44, 18, c) + arrow(CX + 8, 108, CX + 44, 132, c) + arrow(CX - 8, 108, CX - 44, 132, c);
    }
    return s;
  },
  // Single loop, side view: dipole-like field.
  'loop': () => {
    let s = xdot(CX - 34, CY) + odot(CX + 34, CY);
    for (const k of [20, 40, 60]) {
      s += `<path d="M ${CX - 10} ${CY - 3} C ${CX - 10 - k * 0.3} ${CY - k * 1.5}, ${CX + 10 + k * 0.3} ${CY - k * 1.5}, ${CX + 10} ${CY - 3}" fill="none" stroke="${col.fieldB}" stroke-width="1.3" />`;
      s += `<path d="M ${CX - 10} ${CY + 3} C ${CX - 10 - k * 0.3} ${CY + k * 1.5}, ${CX + 10 + k * 0.3} ${CY + k * 1.5}, ${CX + 10} ${CY + 3}" fill="none" stroke="${col.fieldB}" stroke-width="1.3" />`;
    }
    s += arrow(CX, CY + 24, CX, CY - 24, col.fieldB);
    return s;
  },
};

// ------------------------------------------------------------------ candidate shapes
const SHAPES = {
  gauss: {
    sphere: ok => `<circle cx="${CX}" cy="${CY}" r="48" fill="none" stroke="${sc(ok)}" stroke-width="2.2" stroke-dasharray="${sd(ok)}" />`,
    cylinder: ok => {
      const c = sc(ok), d = sd(ok);
      return `<rect x="${CX - 34}" y="26" width="68" height="98" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="${d}" />`
        + `<ellipse cx="${CX}" cy="26" rx="34" ry="9" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="${d}" />`
        + `<ellipse cx="${CX}" cy="124" rx="34" ry="9" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="${d}" />`;
    },
    pillbox: ok => `<rect x="${CX - 42}" y="${CY - 22}" width="84" height="44" fill="none" stroke="${sc(ok)}" stroke-width="2.2" stroke-dasharray="${sd(ok)}" />`,
    cube: ok => `<rect x="${CX - 48}" y="${CY - 48}" width="96" height="96" fill="none" stroke="${sc(ok)}" stroke-width="2.2" stroke-dasharray="${sd(ok)}" />`,
  },
  ampere: {
    circle: ok => `<circle cx="${CX}" cy="${CY}" r="52" fill="none" stroke="${sc(ok)}" stroke-width="2.2" stroke-dasharray="${sd(ok)}" />`,
    rectangle: (ok, field) => {
      const c = sc(ok), d = sd(ok);
      // straddle the sheet, or the top winding of a solenoid
      const y0 = field === 'solenoid' ? 14 : CY - 34, h = field === 'solenoid' ? 62 : 68;
      return `<rect x="${CX - 56}" y="${y0}" width="112" height="${h}" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="${d}" />`;
    },
    'circle-off': ok => `<circle cx="${CX + 26}" cy="${CY - 14}" r="44" fill="none" stroke="${sc(ok)}" stroke-width="2.2" stroke-dasharray="${sd(ok)}" />`,
    square: ok => `<rect x="${CX - 50}" y="${CY - 50}" width="100" height="100" fill="none" stroke="${sc(ok)}" stroke-width="2.2" stroke-dasharray="${sd(ok)}" />`,
  },
};

/** SVG markup of a source's field pattern, optionally with a shape drawn over it. */
export function sketch(field, { law = 'gauss', shape = null, ok = 'neutral' } = {}) {
  const f = FIELDS[field];
  if (!f) return '';
  const inner = f(law) + (shape && SHAPES[law][shape] ? SHAPES[law][shape](ok, field) : '');
  return `<svg class="sketch" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="${NS}" aria-hidden="true">${inner}</svg>`;
}
