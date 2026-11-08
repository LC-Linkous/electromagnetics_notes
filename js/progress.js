// My progress: the self-check marks saved in this browser, as a study list.
// Reads localStorage only. Nothing is sent anywhere.

const $ = sel => document.querySelector(sel);
const LEVELS = ['shaky', 'okay', 'solid'];
let catalog = null;

async function main() {
  catalog = await (await fetch('data/courses.json')).json();
  const sel = $('#pg-course');
  for (const c of catalog.courses.filter(c => c.file)) {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.status === 'draft' ? `${c.name} (draft)` : c.name;
    sel.appendChild(o);
  }
  const remembered = read('emnotes:course');
  if (remembered && [...sel.options].some(o => o.value === remembered)) sel.value = remembered;
  sel.addEventListener('change', () => show(sel.value));
  $('#pg-print').addEventListener('click', () => { try { window.print(); } catch { /* not available here */ } });
  show(sel.value);
}

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }

async function show(courseId) {
  const course = catalog.courses.find(c => c.id === courseId);
  const data = await (await fetch(course.file)).json();
  let levels = {};
  try { levels = JSON.parse(read(`emnotes:levels:${courseId}`) || '{}'); } catch { levels = {}; }
  const byId = new Map(data.nodes.map(n => [n.id, n]));
  const unit = new Map(data.groups.map(g => [g.id, g.short || g.name]));
  const topics = data.nodes.filter(n => n.kind !== 'exit');

  const buckets = { shaky: [], okay: [], solid: [], unmarked: [] };
  for (const n of topics) buckets[LEVELS.includes(levels[n.id]) ? levels[n.id] : 'unmarked'].push(n);

  const marked = topics.length - buckets.unmarked.length;
  $('#pg-summary').innerHTML = marked
    ? `<b>${marked}</b> of ${topics.length} topics marked · <b>${buckets.shaky.length}</b> shaky · ${buckets.okay.length} okay · ${buckets.solid.length} solid`
    : '';
  $('#pg-empty').hidden = marked > 0;

  const item = (n, withDeps) => {
    const deps = withDeps ? n.requires.filter(id => byId.has(id)).map(id => {
      const lvl = levels[id];
      const name = byId.get(id).name;
      return lvl === 'shaky' ? `<span class="shaky">${name}</span>` : name;
    }) : [];
    return `<li><span class="name"><a href="index.html#flow/${n.id}">${n.name}</a></span><span class="unit">${unit.get(n.group) || ''}</span>
      ${deps.length ? `<div class="deps">builds on: ${deps.join(', ')}</div>` : ''}</li>`;
  };
  for (const [key, list] of Object.entries(buckets)) {
    const sec = $(`#pg-${key}`);
    sec.hidden = !list.length || (key === 'unmarked' && !marked);
    sec.querySelector('.count').textContent = list.length ? `· ${list.length}` : '';
    sec.querySelector('ul').innerHTML = list.map(n => item(n, key === 'shaky')).join('');
  }
}

main().catch(err => { $('#pg-summary').textContent = 'Could not load course data — ' + err.message; });
