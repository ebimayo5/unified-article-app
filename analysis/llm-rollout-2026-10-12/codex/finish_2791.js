const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2791_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('specify_offline_limit',
  'ただし、オフライン時に使える検索や交通情報、案内機能には制約があり得ます。通信が不要になるものとして扱わず、出発前に実機で確認してください。',
  'Google公式ヘルプによると、経路全体が保存済みエリア内ならオフラインでも運転案内を使えますが、リアルタイム交通情報と代替ルートは表示できません。地域によっては地図をダウンロードできない場合もあります。出発前に<a href="https://support.google.com/maps/answer/6291838?hl=ja">Googleマップのオフライン利用条件</a>と実機を確認してください。');
replaceOnce('remove_unverified_truck_experience',
  '大型トラックで長時間運転を経験した筆者としても、案内そのものより「充電が追いつかない」「端末が熱くなって動作が鈍る」といった小さなストレスのほうが、休憩計画を崩す原因になりやすいと感じます。',
  '長時間の案内では、充電不足や端末の発熱によって案内を確認しづらくなることがあります。出発前に給電方法を確かめ、発熱時は安全な場所に停車して端末を確認してください。');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
if (after.includes('大型トラックで長時間運転を経験した筆者')) throw new Error('Author claim remains');
fs.writeFileSync(path.join(root, '2791_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2791_patch.json'), JSON.stringify({post_id:2791, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
