const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
const original = fs.readFileSync(path.join(base, 'backups/2750_public_20261014.raw.html'), 'utf8');
let raw = original;
const changes = [];
function replace(before, after) {
  if (raw.split(before).length !== 2) throw Error('nonunique ' + before.slice(0, 100));
  raw = raw.replace(before, after);
  changes.push({ before, after });
}
replace('<p>取り付けまで含めて考えるなら、本体代と工賃を別々に見るより、工賃を含んだ総額で比べたほうが判断しやすくなります。アルファードが対象になる施工の価格はこのとおりです。</p>', '<p>40系アルファードの施工費用を比べるときは、車名だけでなく搭載ディスプレイと対象年式を先に確認します。<a href="https://naviokun.ocnk.net/product/264" target="_blank" rel="noopener">ナビ男くんの40系専用商品</a>は、ディスプレイオーディオ／同Plus向けのTVキャンセラー施工を税込・工賃込み40,000円で案内しています。一般的なトヨタ車向けの表示価格を、この40系専用施工の料金として当てはめないでください。</p>');
const oldTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工メニュー</th><th>工賃コミ価格（税込）</th></tr></thead><tbody><tr><td>TVキャンセラー施工（トヨタ純正ナビ・ディスプレイオーディオ）</td><td>24,000円</td></tr><tr><td>TVキャンセラー施工</td><td>40,000円</td></tr></tbody></table><figcaption class="wp-element-caption">ナビ男くん公式サイトの表示価格（税込・工賃コミ）。2026年9月27日時点。車種・ナビの種類・オプションにより変動します。</figcaption></figure>';
const newTable = '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>40系で確認する施工</th><th>掲載価格（税込・工賃込み）</th><th>対象・注意点</th></tr></thead><tbody><tr><td><a href="https://naviokun.ocnk.net/product/264" target="_blank" rel="noopener">アルファード／ヴェルファイア40系専用TVキャンセラー</a></td><td>40,000円</td><td>施工元がディスプレイオーディオ／Plus向けと案内。Xグレード用は欠品表示。年式・グレード・パワートレーンとオプションを注文前に個別確認</td></tr></tbody></table><figcaption class="wp-element-caption">2026年10月14日に施工元の商品ページを確認。追加オプション・出張費などは選択条件で変わる場合があります。</figcaption></figure>';
replace(oldTable, newTable);
replace('<p>同じテレビキャンセラーでも、対応するナビや必要なキットによって金額が変わります。自分の車に付いているナビがどれに当たるかを先に確認してください。</p>', '<p>40系でも車両仕様で適合が分かれます。<a href="https://www.datasystem.co.jp/tekigou/seg/tvkit/seg_tekigou.php" target="_blank" rel="noopener">データシステムの適合表</a>では、ハイブリッドとPHEV、ディスプレイ仕様、製品型番ごとに条件が異なります。ナビ男くんの商品を選ぶ場合も施工元へ年式・グレード・画面仕様を伝え、料金と動作範囲を確認してください。</p>');
const imgs = s => [...s.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
if (JSON.stringify(imgs(raw)) !== JSON.stringify(imgs(original))) throw Error('images changed');
for (const m of original.matchAll(/href=(['"])(.*?)\1/g)) if (!raw.includes(m[2])) throw Error('link lost ' + m[2]);
fs.mkdirSync(path.join(base, 'drafts'), { recursive: true });
fs.writeFileSync(path.join(base, 'drafts/2750_proposed.raw.html'), raw);
fs.writeFileSync(path.join(__dirname, '2750_rewrite_patch.json'), JSON.stringify({post_id:2750,status:'reviewed_pending_publish',changes},null,2)+'\n');
console.log(JSON.stringify({changes:changes.length,images:imgs(raw).length,chars:raw.length}));
