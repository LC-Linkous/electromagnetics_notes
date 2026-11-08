// Equation builder: a guided walk from "what is the source?" to the collapsed form of
// Gauss's or Ampère's law. Everything it says lives in data/builder.json.

import { sketch, collapseSketch, plotSketch } from './sketch.js';

const $ = sel => document.querySelector(sel);
const tex = (s, display = false) => {
  if (window.katex) { try { return katex.renderToString(s, { displayMode: display, throwOnError: false }); } catch { /* fall through */ } }
  return `<code>${s}</code>`;
};
const md = s => (window.marked ? marked.parseInline(s) : s);
/** Plain text with $…$ math segments rendered inline. */
const texInline = s => s.replace(/\$([^$]+)\$/g, (_, t) => tex(t));

const state = { data: null, law: 'gauss', config: null, steps: [] };

async function main() {
  state.data = await (await fetch('data/builder.json')).json();
  $('#b-intro').textContent = state.data.intro;
  document.querySelectorAll('.views a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    setLaw(a.dataset.law);
  }));
  $('#b-restart').addEventListener('click', () => setLaw(state.law));
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

function fromHash() {
  const [law, cfg] = location.hash.replace(/^#/, '').split('/');
  const l = state.data.laws[law] ? law : 'gauss';
  if (l !== state.law || !state.config || (cfg && state.config.id !== cfg)) {
    setLaw(l, cfg || null);
  }
}

function writeHash() {
  const h = '#' + state.law + (state.config ? '/' + state.config.id : '');
  if (location.hash !== h) history.replaceState(null, '', h);
}

// ------------------------------------------------------------------ law
function setLaw(law, preselect = null) {
  state.law = law;
  state.config = null;
  const L = state.data.laws[law];
  document.querySelectorAll('.views a').forEach(a => a.classList.toggle('active', a.dataset.law === law));
  $('#b-law-eq').innerHTML = tex(L.law, true);
  $('#b-law-note').textContent = `${L.name}: always true for any closed ${L.shapeWord.split(' ')[1] || 'surface'}. The question is whether it hands you ${L.field === '\\mathbf{E}' ? 'E' : 'B'}.`;
  $('#b-map-link').href = `index.html#flow/${L.mapTopic}`;
  $('#b-steps').innerHTML = '';
  state.steps = [];
  writeHash();
  stepPick();
  if (preselect) {
    const c = state.data.configs.find(x => x.id === preselect && x.law === law);
    if (c) choose(0, c.id);
  }
}

// ------------------------------------------------------------------ step machinery
function addStep(title, lead, options, { onChoose }) {
  const li = document.createElement('li');
  li.className = 'b-step';
  li.innerHTML = `<h2>${title}</h2>${lead ? `<p class="lead">${lead}</p>` : ''}<div class="b-options"></div><div class="fb"></div><div class="extra"></div>`;
  const box = li.querySelector('.b-options');
  for (const o of options) {
    const b = document.createElement('button');
    b.className = 'b-opt';
    b.dataset.id = o.id;
    b.innerHTML = o.html;
    b.addEventListener('click', () => onChoose(o.id, b));
    box.appendChild(b);
  }
  $('#b-steps').appendChild(li);
  state.steps.push(li);
  li.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return li;
}

function truncateAfter(li) {
  // Remove any steps after this one (user is re-answering).
  const i = state.steps.indexOf(li);
  state.steps.slice(i + 1).forEach(s => s.remove());
  state.steps.length = i + 1;
}

function mark(li, btn, ok, feedbackHtml) {
  li.querySelectorAll('.b-opt').forEach(b => { b.classList.remove('right'); if (ok) b.classList.add('locked'); });
  btn.classList.toggle('right', ok);
  btn.classList.toggle('wrong', !ok);
  if (ok) { li.classList.add('done'); btn.classList.remove('locked'); }
  li.querySelector('.fb').innerHTML = `<div class="b-feedback ${ok ? 'ok' : 'no'}">${feedbackHtml}</div>`;
}

function choose(stepIndex, id) {
  const li = state.steps[stepIndex];
  const btn = li?.querySelector(`.b-opt[data-id="${id}"]`);
  if (btn) btn.click();
}

// ------------------------------------------------------------------ step 1: source
function stepPick() {
  const L = state.data.laws[state.law];
  const configs = state.data.configs.filter(c => c.law === state.law);
  addStep(L.stepWords.pick, 'Pick the source. Some of these will turn out not to work — that is part of the point.',
    configs.map(c => ({ id: c.id, html: c.name })), {
      onChoose: (id, btn) => {
        const li = state.steps[0];
        truncateAfter(li);
        state.config = configs.find(c => c.id === id);
        writeHash();
        li.querySelectorAll('.b-opt').forEach(b => b.classList.toggle('right', b === btn));
        li.classList.add('done');
        li.querySelector('.fb').innerHTML = '';
        stepSymmetry();
      },
    });
}

// ------------------------------------------------------------------ step 2: symmetry
function stepSymmetry() {
  const S = state.data.symmetries;
  const c = state.config;
  const li = addStep('What symmetry does it have?',
    `<span class="lead-row">${sketch(c.sketch, { law: state.law })}<span>Ask: what can I do to this source — rotate it, slide it — without changing anything? Each such move constrains the field. The sketch shows the source and the direction its field must take.</span></span>`,
    Object.entries(S).map(([id, s]) => ({ id, html: `${s.name}<small>${s.test}</small>` })), {
      onChoose: (id, btn) => {
        truncateAfter(li);
        const ok = id === c.symmetry;
        let fb;
        if (ok) {
          if (id === 'none') {
            fb = `<strong>Right — and that is the end of the road for ${state.data.laws[state.law].name} here.</strong>${md(c.symmetryWhy)}<p>${md(c.dead)}</p>`;
            mark(li, btn, true, fb);
            li.querySelector('.b-feedback').classList.add('dead');
            li.classList.add('dead');
            stepFinish(true);
            return;
          }
          const s = S[id];
          fb = `<strong>${s.name} symmetry.</strong>${md(c.symmetryWhy)}<p>So: work in <em>${s.coords}</em>; the field depends on <em>${s.depends}</em>; its direction is ${texInline(s.direction)}.</p>`;
          mark(li, btn, true, fb);
          stepShape();
        } else {
          const W = state.data.symmetryWrong;
          let text;
          if (state.law === 'ampere' && id === 'spherical') text = W['B>spherical'];
          else if (id === 'none') text = W['any>none'];
          else text = W[`${c.symmetry}>${id}`] || 'Not this one.';
          mark(li, btn, false, `<strong>Not ${S[id].name.toLowerCase()}.</strong>${md(text)}`);
        }
      },
    });
}

// ------------------------------------------------------------------ step 3: coordinate system & surface / loop
function stepShape() {
  const L = state.data.laws[state.law];
  const shapes = state.data.shapes[state.law];
  const c = state.config;
  const li = addStep(L.stepWords.shape,
    `You want a ${L.shapeWord} on which the field is everywhere ${state.law === 'gauss' ? 'normal to the surface' : 'tangent to the path'} (or exactly perpendicular, so it contributes nothing) and constant in magnitude wherever it contributes.`,
    Object.entries(shapes).map(([id, s]) => ({ id, html: `<span class="opt-row">${sketch(c.sketch, { law: state.law, shape: id })}<span>${s.name}<small>${s.coords} coordinates</small></span></span>` })), {
      onChoose: (id, btn) => {
        truncateAfter(li);
        const ok = id === c.shape;
        btn.querySelector('.sketch').outerHTML = sketch(c.sketch, { law: state.law, shape: id, ok: ok ? 'ok' : 'bad' });
        if (ok) {
          mark(li, btn, true, `<strong>Yes.</strong>${md(shapes[id].why)}`);
          stepCollapse();
        } else {
          const override = c.shapeWrong && c.shapeWrong[id];
          const generic = state.data.shapeWrong[state.law][`${c.symmetry}>${id}`];
          const always = shapes[id].for === null ? shapes[id].why : null;
          mark(li, btn, false, `<strong>Not that one.</strong>${md(override || generic || always || 'The field is not normal/tangent with constant magnitude on this choice.')}`);
        }
      },
    });
}

// ------------------------------------------------------------------ step 4: collapse the integral
function stepCollapse() {
  const L = state.data.laws[state.law];
  const opts = state.data.collapseOptions[state.law];
  const c = state.config;
  const li = addStep(L.stepWords.collapse,
    'Where the field is parallel to the element, the dot product is just |field| × element and the magnitude comes out of the integral. Where it is perpendicular, the piece contributes nothing.',
    opts.map(o => ({ id: o.id, html: tex(o.latex) })), {
      onChoose: (id, btn) => {
        truncateAfter(li);
        const ok = id === c.collapse;
        const opt = opts.find(o => o.id === id);
        if (ok) {
          const rhs = L.law.split('=').slice(1).join('=').trim();
          mark(li, btn, true, `<strong>That's the collapsed form.</strong>`);
          li.querySelector('.extra').innerHTML = `<div class="b-chain chain-row">
              ${collapseSketch(c.sketch, state.law, c.shape)}
              <div>
                ${tex(L.law, true)}
                <p class="why">Field is parallel to the element where it contributes, and constant there — pull it out. Green parts contribute; grey parts give zero:</p>
                ${tex(`${opt.latex} = ${rhs}`, true)}
              </div>
            </div>`;
          stepEnclosed();
        } else {
          const override = c.collapseWrong && c.collapseWrong[id];
          mark(li, btn, false, `<strong>Not quite.</strong>${md(override || opt.wrong)}`);
        }
      },
    });
}

// ------------------------------------------------------------------ step 5: enclosed source, region by region
function stepEnclosed() {
  const L = state.data.laws[state.law];
  const c = state.config;
  const opts = state.data.collapseOptions[state.law];
  const factor = opts.find(o => o.id === c.collapse).latex;
  const li = document.createElement('li');
  li.className = 'b-step done';
  li.innerHTML = `<h2>${L.stepWords.enclosed}</h2>
    <p class="lead">Only ${L.sourceWord} ${state.law === 'gauss' ? 'inside the surface' : 'threading the loop'} counts. ${c.regions.length > 1 ? 'Pick the region — the enclosed amount changes, the left side does not.' : ''}</p>
    <div class="b-regions"></div>
    <div class="result-row"><div class="b-result"></div><div class="b-plot"></div></div>`;
  const regions = li.querySelector('.b-regions');
  const result = li.querySelector('.b-result');
  const plotBox = li.querySelector('.b-plot');
  const letter = state.law === 'gauss' ? 'E' : 'B';
  const show = i => {
    const r = c.regions[i];
    regions.querySelectorAll('.b-region').forEach((b, j) => b.classList.toggle('on', i === j));
    plotBox.innerHTML = c.plot ? plotSketch(c.plot, letter, i) + `<p class="note">|${letter}| against distance — the shape of the curve, not to scale. Check: does it match the formula in each region? Is it continuous where you expect?</p>` : '';
    const rhs = L.law.split('=').slice(1).join('=').trim();
    result.innerHTML = `
      <div class="row"><span class="k">Enclosed</span><span>${tex(r.enclosed, true)}</span></div>
      <div class="row"><span class="k">Equation</span><span>${tex(`${factor} = ${rhs.replace(/Q_\{\\text\{enc\}\}|I_\{\\text\{enc\}\}/, r.enclosed.split('=').pop().trim())}`, true)}</span></div>
      <div class="row"><span class="k">Solve</span><span class="final">${tex(r.result, true)}</span></div>
      ${r.note ? `<p class="note">${md(r.note)}</p>` : ''}`;
  };
  c.regions.forEach((r, i) => {
    const b = document.createElement('button');
    b.className = 'b-region';
    b.textContent = r.label;
    b.addEventListener('click', () => show(i));
    regions.appendChild(b);
  });
  $('#b-steps').appendChild(li);
  state.steps.push(li);
  show(0);
  li.scrollIntoView({ behavior: 'smooth', block: 'start' });
  stepFinish(false);
}

// ------------------------------------------------------------------ step 6: sanity checks, twin, links
function stepFinish(dead) {
  const L = state.data.laws[state.law];
  const c = state.config;
  const li = document.createElement('li');
  li.className = 'b-step done';
  const twin = c.twin ? state.data.configs.find(x => x.id === c.twin) : null;
  const otherLaw = state.law === 'gauss' ? 'ampere' : 'gauss';
  li.innerHTML = `<h2>${dead ? 'What to do instead' : 'Does it make sense?'}</h2>
    ${dead ? '' : `<div class="b-sanity">${md(c.sanity)}</div>`}
    <div class="b-twin"><h3>The ${otherLaw === 'ampere' ? 'magnetic' : 'electric'} twin</h3>
      <p>${md(c.twinNote || '')} ${twin ? `<a href="#${otherLaw}/${twin.id}">Run the same steps for ${twin.name.split(',')[0].split(':')[0]} →</a>` : ''}</p></div>
    <div class="b-links">
      <a class="btn small" href="index.html#flow/${L.mapTopic}">Open “${L.mapTopic === 'gauss-apps' ? 'Applying Gauss' : 'Applying Ampère'}” in the map</a>
      <button class="btn small" id="b-again">Try another source</button>
    </div>`;
  $('#b-steps').appendChild(li);
  state.steps.push(li);
  li.querySelector('#b-again').addEventListener('click', () => setLaw(state.law));
  li.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

main().catch(err => {
  console.error(err);
  $('#b-intro').textContent = 'Could not load data/builder.json — ' + err.message;
});
