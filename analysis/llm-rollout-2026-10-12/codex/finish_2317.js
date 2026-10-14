const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '2317_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const i = after.indexOf(from);
  if (i < 0 || after.indexOf(from, i + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('cite_police_navigation_screen_warning',
  '<p>走行中解除を施工しても、運転者が画面を見続けたり操作したりしてよいことにはなりません。カーナビ画面の利用は、同乗者による操作・視聴、または安全な場所へ停車してからの操作を前提に考えてください。</p>',
  '<p>走行中解除を施工しても、運転者が画面を注視したり操作したりしてよいことにはなりません。<a href="https://www.npa.go.jp/bureau/traffic/keitai/info.html">警察庁の注意喚起</a>は、走行中にカーナビゲーション装置などの画像を注視すると周囲への注意が不十分になり危険だとしています。映像は同乗者向けとし、運転者の目的地設定や細かな操作は安全な場所へ停車してから行ってください。</p>');
replaceOnce('explain_navigation_tradeoff_for_product',
  '<p>同じ施工でもホンダの12,000円からレクサスの40,000円まで3倍以上開きます。ナビの世代や仕様で必要な部品と作業量が変わるためで、相場をひとつの数字で覚えても意味がありません。</p>',
  '<p>同じ施工でもホンダの12,000円からレクサスの40,000円まで3倍以上開きます。ナビの世代や仕様で必要な部品と作業量が変わるためで、相場をひとつの数字で覚えても意味がありません。機能上の影響も品番別に確認してください。たとえば<a href="https://naviokun.ocnk.net/product/250">施工元のHonda CONNECT向け商品250</a>は、ナビ操作可能状態では自車位置が固まりルート案内が停止すると案内しています。希望する表示・操作と、通常の案内が続くかを施工前に分けて確認します。</p>');
const imgs = h => [...h.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const links = h => [...h.matchAll(/\bhref=(['"])(.*?)\1/g)].map(m => m[2]);
if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after))) throw new Error('Original image tags changed');
for (const link of links(before)) if (!links(after).includes(link)) throw new Error(`Original href missing: ${link}`);
fs.writeFileSync(path.join(root, '2317_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '2317_patch.json'), JSON.stringify({post_id:2317, original_modified:current.modified, changes, original_images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:imgs(before).length, original_hrefs:links(before).length, proposed_hrefs:links(after).length}));
