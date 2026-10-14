// Build old->new line replacement pairs from rendered base vs Codex proposal,
// re-inserting first-hand author sentences that the proposal removed.
const fs = require('fs');
const ids = process.argv.slice(2);
const kw = /(整備士?専門学校|整備学校|整備士学校|研修|大型トラック|大型車|トラック|長距離(を|で)?(走|運転)|長距離を運転する立場|二種|タクシー|運行管理者|配車)/;
const out = {};
for (const id of ids) {
  let A;
  const pr = 'codex/' + id + '_public_rest.json', pub = 'snapshots/drive/backups/' + id + '_public_20261014.raw.html';
  if (fs.existsSync(pub)) A = fs.readFileSync(pub, 'utf8');
  else A = JSON.parse(fs.readFileSync(pr, 'utf8')).content.rendered;
  const propF = ['codex/', 'snapshots/drive/drafts/'].map(d => d + id + '_proposed.raw.html').find(f => fs.existsSync(f));
  const B = fs.readFileSync(propF, 'utf8');
  const a = A.split('\n'), b = B.split('\n');
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hunks = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; continue }
    const del = [], ins = [];
    while ((i < n || j < m) && !(i < n && j < m && a[i] === b[j])) {
      if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { ins.push(b[j]); j++ } else { del.push(a[i]); i++ }
    }
    // anchor = previous unchanged nonblank line (for pure inserts)
    let k = i - del.length - 1; while (k >= 0 && !a[k].trim()) k--;
    hunks.push({ del, ins, anchor: k >= 0 ? a[k] : null });
  }
  // bio re-insertion within each hunk
  const notes = [];
  for (const h of hunks) {
    const oldText = h.del.join('\n');
    const sents = oldText.replace(/<[^>]+>/g, '').split(/(?<=[。！？])/).map(s => s.trim()).filter(s => kw.test(s) && s.length < 300);
    for (const s of sents) {
      const newText = h.ins.join('\n');
      if (newText.includes(s.slice(0, 25))) continue;
      if (!oldText.includes(s)) { notes.push('BIO_NOT_PLAIN ' + s.slice(0, 40)); continue }
      // find line in ins most similar to the del line containing s
      const dl = h.del.find(l => l.includes(s));
      const inner = dl.replace(/<[^>]+>/g, '');
      const ss = inner.split(/(?<=[。！？])/); const q = ss.findIndex(x => x.includes(s));
      const prev = q > 0 ? ss[q - 1].trim() : null, next = q < ss.length - 1 ? ss[q + 1].trim() : null;
      let placed = false;
      for (let t = 0; t < h.ins.length && !placed; t++) {
        const line = h.ins[t];
        if (prev && line.split(prev).length === 2) { h.ins[t] = line.replace(prev, prev + s); placed = 'after_prev' }
        else if (next && line.split(next).length === 2) { h.ins[t] = line.replace(next, s + next); placed = 'before_next' }
      }
      if (!placed) {
        const t = h.ins.findIndex(l => /^<p[ >]/.test(l.trim()));
        if (t >= 0) { h.ins[t] = h.ins[t].replace(/^(\s*<p[^>]*>)/, '$1' + s); placed = 'prepend_first_p' }
      }
      notes.push((placed || 'BIO_UNPLACED') + ' ' + s.slice(0, 40));
    }
  }
  out[id] = { hunks, notes };
  console.log(id, 'hunks', hunks.length, 'del', hunks.reduce((x, h) => x + h.del.length, 0), 'ins', hunks.reduce((x, h) => x + h.ins.length, 0), notes.join(' | '));
}
fs.writeFileSync(process.env.OUTP, JSON.stringify(out));
