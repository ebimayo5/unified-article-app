const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '967_public_rest_20261014.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('remove_unverified_mechanic_school',
  '僕も整備学校で車の構造を学びましたが、慣れていないと内装パネルに傷を付けてしまうリスクがあります。',
  '慣れない作業では内装パネルに傷を付けたり、配線を傷めたりするリスクがあります。');
replaceOnce('remove_unverified_truck_experience',
  '僕もトラックで長距離を走っていた経験がありますが、同乗者がいる場合、車内の雰囲気は運転のしやすさにかなり影響します。同乗者がリラックスできる環境は、安全運転にも関係してくると感じます。',
  '同乗者がいる場合は、会話や車内の音が運転の妨げにならないよう配慮が必要です。映像を使うときも、運転者が画面を注視しないことを優先してください。');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '967_author_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '967_author_patch.json'), JSON.stringify({post_id:967, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
