const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2337_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('add_official_model_comparison',
  '検討中の車両の数値は、販売店の見積書やメーカーの最新カタログ、現車で確認してください。',
  '検討中の車両の数値は、<a href="https://www.landrover.co.jp/defender/defender/models-and-specifications.html">ランドローバー公式の90・110・130モデル別仕様</a>と販売店の見積書、現車で確認してください。2026年モデルの一覧を旧年式の中古車にそのまま当てはめないことも大切です。');
replaceOnce('remove_unverified_long_distance_experience',
  '長距離を運転する立場から見ると、休憩のたびに狭い区画へ止めにくい車は、小さな緊張を繰り返すことになります。',
  '長距離移動では、休憩のたびに狭い区画へ止めにくい車だと負担が重なります。');
replaceOnce('remove_unverified_mechanic_training',
  '整備士研修で学んだ基礎から見ても、点検整備では異常の有無だけでなく、説明と記録のつながりが重要です。',
  '点検整備では異常の有無だけでなく、作業内容の説明と整備記録を照合できることも重要です。');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2337_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2337_patch.json'), JSON.stringify({post_id:2337, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
