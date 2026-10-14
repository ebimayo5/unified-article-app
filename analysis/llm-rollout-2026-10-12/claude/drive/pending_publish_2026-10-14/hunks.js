const fs = require('fs');
const P = require(process.env.PJ);
const ids = process.argv.slice(2);
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return h };
const out = fs.existsSync(process.env.OUTH) ? JSON.parse(fs.readFileSync(process.env.OUTH, 'utf8')) : {};
let total = 0;
for (const id of ids) {
  const base = process.env['BASE_' + id] || P[id].base;
  const b = fs.readFileSync(base, 'utf8'), f = fs.readFileSync(process.env.FD + '/' + id + '_final.raw.html', 'utf8');
  const A = b.split('\n'), B = f.split('\n'); const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const h = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { i++; j++; continue }
    const s = i, ins = []; let del = 0;
    while ((i < n || j < m) && !(i < n && j < m && A[i] === B[j])) {
      if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { ins.push(B[j]); j++ } else { del++; i++ }
    }
    h.push([s, del, ins]);
  }
  const C = A.slice(); for (const [s, d, ins] of h.slice().reverse()) C.splice(s, d, ...ins);
  const ok = C.join('\n') === f;
  out[id] = { base: fnv(b), final: fnv(f), h }; total += JSON.stringify(h).length;
  console.log(id, 'hunks', h.length, 'ok', ok, 'bytes', JSON.stringify(h).length);
}
fs.writeFileSync(process.env.OUTH, JSON.stringify(out)); console.log('total', total);
