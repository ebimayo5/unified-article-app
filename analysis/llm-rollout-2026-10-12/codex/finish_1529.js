const fs = require('fs');
const path = require('path');
const root = __dirname;
const current = JSON.parse(fs.readFileSync(path.join(root, '1529_public_rest.json'), 'utf8'));
const before = current.content.rendered;
let after = before;
const changes = [];
function replaceOnce(label, from, to) {
  const first = after.indexOf(from);
  if (first < 0 || after.indexOf(from, first + from.length) >= 0) throw new Error(`Expected one match: ${label}`);
  after = after.replace(from, to);
  changes.push(label);
}
replaceOnce('add_current_official_prices',
  '<p>イエローハットのオイル交換総額は、基本的に<strong>「オイル代＋交換工賃＋（必要なら）フィルター代」</strong>で決まります。金額を断定しにくいのは、車ごとに必要量や指定規格が違い、選ぶオイルと作業内容でブレるからです。</p>',
  '<p>イエローハットのオイル交換総額は、基本的に<strong>「オイル代＋交換工賃＋（必要なら）フィルター代・交換工賃」</strong>で決まります。<a href="https://www.yellowhat.jp/store_service/engine_oil/index.html">イエローハット公式のオイル交換案内</a>では、エンジンオイル交換工賃は税込550円から、オイルフィルター交換工賃は税込770円から、3L缶のオイルは税込2,480円からと表示されています。これは各項目の下限で、すべての車の総額を示すものではありません。車種ごとの必要量・指定規格、選ぶ商品、追加作業によって見積もりが変わります。</p>');
replaceOnce('correct_membership_fee_description',
  '年に何回交換するかで「年会費を回収できるか」を計算する',
  '税込550円のメンテナンスパックに加入する条件と、対象作業の工賃を比較する');
replaceOnce('explain_maintenance_pack_conditions',
  '<h3>見積りで見るべき内訳チェック（明細の読み方）</h3>',
  '<p><a href="https://www.yellowhat.jp/store_service/card/">イエローハットの会員特典案内</a>によると、無料のメンバーズカード会員が車両1台につき税込550円のメンテナンスパックを購入すると、登録車両のエンジンオイル・オイルフィルターなどの交換工賃が1年間無料になります。対象商品を同店で購入し、会員証を提示するなどの条件があり、一部車両は作業を受けられません。オイルやフィルターの商品代まで無料になる制度ではありません。</p>\n\n<h3>見積りで見るべき内訳チェック（明細の読み方）</h3>');
replaceOnce('remove_unverified_training_claim',
  '<p>筆者は整備工場での研修経験から、施工品質の不安は「腕」よりも<strong>作業条件と確認不足</strong>で増えると感じています。だからこそ、明細に追加項目が入る前に「何が必要で、何が任意か」を区別しておくと納得しやすいです。</p>',
  '<p>明細に追加項目が入る前に、何が必要で何が任意か、どの条件で追加料金になるかを確認しておくと判断しやすくなります。</p>');
replaceOnce('remove_subjective_filter_effect',
  '結果としてオイルが汚れやすくなったり、交換しても“新油の気持ちよさ”が出にくかったりします。',
  '交換時期は車種の取扱説明書・整備記録で確認し、指定周期を過ぎたフィルターをそのまま使わないことが大切です。');
replaceOnce('avoid_unsupported_filter_performance_claim',
  '<li><strong>上位が効きやすいケース</strong>：短距離が多い、渋滞が多い、汚れやすい使い方、交換サイクルが伸びがち</li>',
  '<li><strong>上位製品を検討する場合</strong>：車両への適合とメーカーが示す性能・交換条件を確認する。交換時期を延ばせるとは決めつけない</li>');
const oldImgs = [...before.matchAll(/<img\b[^>]*>/g)].map(x => x[0]);
const newImgs = [...after.matchAll(/<img\b[^>]*>/g)].map(x => x[0]);
const oldLinks = [...before.matchAll(/\bhref=(['"])(.*?)\1/g)].map(x => x[2]);
const newLinks = [...after.matchAll(/\bhref=(['"])(.*?)\1/g)].map(x => x[2]);
if (JSON.stringify(oldImgs) !== JSON.stringify(newImgs)) throw new Error('Original image tags changed');
for (const href of oldLinks) if (!newLinks.includes(href)) throw new Error(`Original link missing: ${href}`);
if (after.includes('筆者は整備工場での研修経験')) throw new Error('Author claim remains');
fs.writeFileSync(path.join(root, '1529_proposed.raw.html'), after);
fs.writeFileSync(path.join(root, '1529_patch.json'), JSON.stringify({post_id:1529, original_modified:current.modified, changes, original_images:oldImgs.length, original_hrefs:oldLinks.length, proposed_hrefs:newLinks.length, published:false}, null, 2));
console.log(JSON.stringify({changes:changes.length, images:oldImgs.length, original_hrefs:oldLinks.length, proposed_hrefs:newLinks.length, before_chars:before.length, after_chars:after.length}));
