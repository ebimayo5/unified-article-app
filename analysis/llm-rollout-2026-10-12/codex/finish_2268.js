const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2268_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('distinguish_built_in_connected_navigation',
  '<p>ディスプレイオーディオは、スマホの地図・音楽・通話を車載画面で扱いやすくする装備です。一方で、スマホへの依存、通信状態、接続準備を負担に感じる使い方では、初期費用を抑えられても満足しにくくなります。</p>',
  '<p>ディスプレイオーディオはスマホの地図・音楽・通話を車載画面で扱える仕様が多い一方、車載ナビを内蔵する仕様もあります。たとえば<a href="https://toyota.jp/faq/show/11720.html">トヨタ公式FAQ</a>は、ディスプレイオーディオPlusには車載地図データがあり、コネクティッドナビ未契約でも地図を使えると案内しています。「ディスプレイオーディオ＝スマホなしではナビ不可」と決めず、検討車の画面型式、車載地図、通信契約を確認してください。スマホ連携中心の構成では、接続準備や通信状態を負担に感じる使い方もあります。</p>');
replaceOnce('remove_unverified_large_vehicle_experience',
  '大型車で長時間走る場面を経験すると、目的地までの案内そのものより、乗車直後に迷わず使い始められることが小さな負担を減らすと感じます。',
  '長時間の運転では、目的地までの案内だけでなく、乗車直後に迷わず使い始められるかも負担を左右します。');
replaceOnce('source_offline_navigation_limits',
  '遠出の前には、利用中の地図アプリでオフライン時の機能や事前ダウンロードの可否を確認しておくと安心です。',
  '<a href="https://support.google.com/maps/answer/6291838?hl=ja">Googleマップの公式案内</a>では、事前に地図をダウンロードした地域でオフラインの車ルート案内が可能ですが、リアルタイム交通情報などの制限があります。遠出の前には利用中のアプリで対象地域を保存し、オフライン時の機能を確認してください。');
replaceOnce('remove_unverified_workshop_experience',
  '整備工場での研修経験から見ても、電装品は見た目では判断できない配線処理と適合確認が品質を左右します。',
  '電装品は見た目では判断できない配線処理と適合確認が品質を左右します。');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2268_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2268_patch.json'), JSON.stringify({post_id:2268, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
