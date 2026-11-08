// Class gaps: tally many students' marks codes ("<course> shaky:a,b okay:c solid:d") into a table.
// Purely client-side; the course data is loaded only to show topic names and units.

const $ = sel => document.querySelector(sel);
const LEVELS = ['shaky', 'okay', 'solid'];
let catalog = null, course = null, data = null, rows = [];

async function main() {
  catalog = await (await fetch('data/courses.json')).json();
  $('#agg-run').addEventListener('click', run);
  $('#agg-copy').addEventListener('click', copyTable);
  document.querySelectorAll('input[name="sort"]').forEach(r => r.addEventListener('change', render));
  $('#agg-hide-empty').addEventListener('change', render);
}

function parseCodes(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const perCourse = new Map();   // courseId -> [ {id: level}, ... ]
  const bad = [];
  for (const line of lines) {
    const tokens = line.split(/\s+/);
    const cid = tokens.shift();
    const marks = {};
    let ok = true;
    for (const t of tokens) {
      const [lvl, list] = t.split(':');
      if (!LEVELS.includes(lvl) || list == null) { ok = false; break; }
      list.split(',').filter(Boolean).forEach(id => { marks[id] = lvl; });
    }
    if (!ok || !cid) { bad.push(line); continue; }
    if (!perCourse.has(cid)) perCourse.set(cid, []);
    perCourse.get(cid).push(marks);
  }
  return { perCourse, bad };
}

async function run() {
  const msg = $('#agg-msg');
  const { perCourse, bad } = parseCodes($('#agg-codes').value);
  if (!perCourse.size) { msg.textContent = bad.length ? `Couldn't read ${bad.length} line(s). Each should look like: intro-emf shaky:V,curl okay:E` : 'Paste some codes first.'; return; }
  // Use the course with the most codes; mention others.
  const [cid, codes] = [...perCourse.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  course = catalog.courses.find(c => c.id === cid);
  if (!course || !course.file) { msg.textContent = `Unknown course “${cid}”.`; return; }
  data = await (await fetch(course.file)).json();
  const groupName = new Map(data.groups.map(g => [g.id, g.short || g.name]));

  const tally = new Map();
  data.nodes.filter(n => n.kind !== 'exit').forEach((n, i) => tally.set(n.id, { id: n.id, name: n.name, unit: groupName.get(n.group), order: i, shaky: 0, okay: 0, solid: 0 }));
  let unknown = 0;
  for (const marks of codes) for (const [id, lvl] of Object.entries(marks)) {
    const t = tally.get(id);
    if (t) t[lvl]++; else unknown++;
  }
  rows = [...tally.values()];
  const others = [...perCourse.keys()].filter(k => k !== cid);
  $('#agg-title').textContent = `${course.name} — ${codes.length} student${codes.length === 1 ? '' : 's'}`;
  $('#agg-sub').textContent = [
    `${rows.filter(r => r.shaky + r.okay + r.solid).length} of ${rows.length} topics marked by someone.`,
    unknown ? `${unknown} marks on unknown topics skipped.` : '',
    others.length ? `Codes for other courses ignored: ${others.join(', ')}.` : '',
    bad.length ? `${bad.length} line(s) not understood.` : '',
  ].filter(Boolean).join(' ');
  msg.textContent = '';
  $('#agg-out').hidden = false;
  $('#agg-copy').disabled = false;
  render();
}

function sorted() {
  const by = document.querySelector('input[name="sort"]:checked').value;
  const hideEmpty = $('#agg-hide-empty').checked;
  let r = rows.filter(x => !hideEmpty || x.shaky + x.okay + x.solid > 0);
  if (by === 'shaky') r = r.slice().sort((a, b) => b.shaky - a.shaky || (b.okay - a.okay) || a.order - b.order);
  else r = r.slice().sort((a, b) => a.order - b.order);
  return r;
}

function render() {
  const tbody = $('#agg-table tbody');
  tbody.innerHTML = '';
  const r = sorted();
  const maxTotal = Math.max(1, ...r.map(x => x.shaky + x.okay + x.solid));
  for (const x of r) {
    const total = x.shaky + x.okay + x.solid;
    const w = v => `${(v / maxTotal) * 100}%`;
    const tr = document.createElement('tr');
    if (x.shaky && x.shaky >= Math.max(2, total / 2)) tr.className = 'hot';
    tr.innerHTML = `<td class="topic"><a href="index.html#flow/${x.id}" title="Open in the map">${x.name}</a></td>
      <td class="unit">${x.unit || ''}</td>
      <td class="num">${x.shaky || ''}</td><td class="num">${x.okay || ''}</td><td class="num">${x.solid || ''}</td>
      <td><div class="spread" title="${x.shaky} shaky · ${x.okay} okay · ${x.solid} solid">
        <span class="s" style="width:${w(x.shaky)}"></span><span class="o" style="width:${w(x.okay)}"></span><span class="d" style="width:${w(x.solid)}"></span>
      </div></td>`;
    tbody.appendChild(tr);
  }
}

async function copyTable() {
  const r = sorted();
  const text = [`${course.name} — class marks`, 'topic\tunit\tshaky\tokay\tsolid',
    ...r.map(x => `${x.name}\t${x.unit || ''}\t${x.shaky}\t${x.okay}\t${x.solid}`)].join('\n');
  try { await navigator.clipboard.writeText(text); $('#agg-msg').textContent = 'Copied as tab-separated text.'; }
  catch { $('#agg-msg').textContent = 'Clipboard not available here — select the table and copy.'; }
}

main().catch(err => { $('#agg-msg').textContent = 'Could not load course data — ' + err.message; });
