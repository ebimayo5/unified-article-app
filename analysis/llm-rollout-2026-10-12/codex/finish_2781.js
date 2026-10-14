const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2781_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('explain_cellular_connected_navi_separately',
  '<p>ディスプレイオーディオのWi-Fiには、スマホと無線連携するためのWi-Fiと、外部ネットワークへ接続するためのWi-Fiがあります。<span style=\'background:linear-gradient(transparent 60%, #fff3a3 60%);\'><strong>「Wi-Fi搭載」だけでは、本体単独でネット通信できるか判断できません。</strong></span></p>',
  '<p>ディスプレイオーディオのWi-Fiには、スマホと無線連携するためのWi-Fiと、外部ネットワークへ接続するためのWi-Fiがあります。<span style=\'background:linear-gradient(transparent 60%, #fff3a3 60%);\'><strong>「Wi-Fi搭載」だけでは、本体単独でネット通信できるか判断できません。</strong></span>さらに車載通信機（DCM等）を使うコネクティッドナビは、スマホのテザリングとは別の契約・通信経路です。<a href="https://toyota.jp/faq/show/11720.html">トヨタ公式の契約別地図案内</a>のように、車載地図を持つ仕様もあるため、Wi-Fi接続方式とナビ用通信を分けて確認してください。</p>');
replaceOnce('remove_unverified_large_vehicle_experience',
  '大型車で長時間運転する場面では、ケーブルを1本つなぐ手間より、案内中に電池残量や接続切れを気にしなくてよいことが負担を減らす場合があります。',
  '長時間運転する場面では、ケーブルを1本つなぐ手間より、案内中に電池残量を気にしなくてよいことが負担を減らす場合があります。');
replaceOnce('source_offline_navigation_limit',
  '遠出する前は、目的地周辺の地図をオフライン保存できるか、通信が切れた際に何が使えなくなるかを確認すると安心です。',
  '<a href="https://support.google.com/maps/answer/6291838?hl=ja">Googleマップの公式案内</a>では、ダウンロードした地域のオフライン車ルート案内が可能ですが、リアルタイム交通情報などは制限されます。遠出する前は目的地周辺の地図を保存し、使うアプリで通信が切れた際の機能を確認してください。');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=([\x27"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2781_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2781_patch.json'), JSON.stringify({post_id:2781, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
