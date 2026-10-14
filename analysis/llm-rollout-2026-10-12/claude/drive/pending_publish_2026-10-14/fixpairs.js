const fs = require('fs'); const f = process.argv[2]; const P = JSON.parse(fs.readFileSync(f, 'utf8'));
const log = [];
// 2258: Codex only removed the author sentences in these hunks -> keep original lines
for (const h of P['2258'].hunks) {
  const d = h.del.join('\n');
  if (d.includes('整備士専門学校で基礎を学び') || d.includes('大型トラックで長距離を運転してきた')) { h.ins = h.del.slice(); log.push('2258 reverted hunk') }
}
// 917: keep the first impression sentence of the Snap-on anecdote
for (const h of P['917'].hunks) {
  h.ins = h.ins.map(l => l.includes('僕自身、整備工場での研修中にSnap-onの工具を使ったことがあります。持ちやすさは')
    ? (log.push('917 added impression'), l.replace('使ったことがあります。持ちやすさは', '使ったことがあります。最初に感じたのは、持ちやすさと力の入れやすさの違いでした。持ちやすさは')) : l);
}
// 1529: re-insert author sentence before the rewritten line
for (const h of P['1529'].hunks) {
  h.ins = h.ins.map(l => l.includes('明細に追加項目が入る前に、何が必要で何が任意か')
    ? (log.push('1529 inserted'), l.replace('明細に追加項目が入る前に、何が必要で何が任意か', '筆者は整備工場での研修経験から、施工品質の不安は「腕」よりも作業条件と確認不足で増えると感じています。明細に追加項目が入る前に、何が必要で何が任意か')) : l);
}
// drop no-op hunks
for (const id of Object.keys(P)) P[id].hunks = P[id].hunks.filter(h => h.del.join('\n') !== h.ins.join('\n'));
fs.writeFileSync(f, JSON.stringify(P)); console.log(log.join('\n'));
for (const id of Object.keys(P)) console.log(id, P[id].hunks.length);
