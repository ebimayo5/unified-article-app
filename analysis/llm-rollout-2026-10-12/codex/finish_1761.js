const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/1761_before.raw.html'),'utf8');
const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,'<strong>ステップワゴンのHDMI後付けをディーラーへ依頼する費用は、対応する接続コードの部品代と取付工賃を分けて確認します。</strong>Hondaの2026年3月版ステップワゴン用資料では、HDMI接続コードは税込6,600円で、工賃は別です。すべての年式・ナビに同じ部品や費用が当てはまるわけではありません。ナビ品番と前席・後席のどちらに映したいかを先に確定し、必要部品と税込総額を見積もりましょう。');
p(5,'確認の起点になるのはナビ品番です。<a href="https://www.honda.co.jp/navi/stepwgn/" target="_blank" rel="noopener">Honda公式のステップワゴン用ナビ案内</a>では、2026年10月12日確認時点でLXM-264ZFLiとLXM-262ZFNiにHDMI対応を案内しています。これは現行掲載機種の例です。Gathersロゴだけで判断せず、過去機種も含めて、本体の品番と対応する説明書を確認しましょう。');
p(23,'HDMI接続する機器と、USB経由のCarPlayを利用する機器では、確認する経路が異なります。映像機器本体、ケーブル、給電アダプター、通信環境を一度に増やさず、まず使用する機器と接続方法を確定すると、不具合時も原因を追いやすくなります。');
c(ps[31],ps[31].replace('有線CarPlay対応車でUSB接続だけで完結させたい場合は、','有線CarPlayを利用するAI Boxを検討する場合は、').replace('方法があります。一方、','方法があります。ただし給電・通信・対象ナビとの適合を別に確認し、USB端子があるだけで使えるとは判断しないでください。一方、'));
p(32,'施工先を比べるときは、純正コードを使う施工と、端子・給電を追加する専門店の施工について、同じ完成状態になる見積もりを依頼しましょう。');
c('<h2>ディーラー以外に頼むといくらになるか</h2>','<h2>ディーラーの部品代・工賃と専門店の施工例を比べる</h2>');
p(37,'<a href="https://www.honda.co.jp/navi/pdf/cable/cord_stepwgn_2603.pdf" target="_blank" rel="noopener">Honda公式の2026年3月版・接続コード資料</a>では、品番08A40-PL0-900Aは税込6,600円、取付位置はセンターロアーカバー部です。標準取付時間はガソリン車1.4H、e:HEV1.6Hで、ナビと同時装着なら各1.0H・1.2Hと区別されています。これは工賃の金額ではありません。販売店に適用と時間当たりの料金・追加作業を確認し、部品代と工賃を合わせた見積もりを取ります（2026年10月12日確認）。');
const table=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('16,000円'));if(!table)throw Error('table');
c(table[0],'<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>確認する費用</th><th>公開価格の例</th><th>含むもの・別途確認するもの</th></tr></thead><tbody><tr><td>Honda純正HDMI接続コード</td><td>6,600円（税込）</td><td>対象は2026年3月版資料の品番08A40-PL0-900A。取付工賃は別途。</td></tr><tr><td>ナビ男くん・Gathers用HDMI新設</td><td>16,000円（税込・施工込みの基本価格）</td><td>対象ナビ、取付場所、追加オプション、機器と通信の準備を確認。</td></tr></tbody></table><figcaption class="wp-element-caption">2026年10月12日確認。部品だけの価格と施工込み価格をそのまま比べず、必要作業を含む税込総額で比較してください。</figcaption></figure>');
p(38,'専門店の具体例として、<a href="https://naviokun.ocnk.net/product/227" target="_blank" rel="noopener">ナビ男くんのGathers用HDMI新設</a>は税込16,000円の基本価格で、グローブボックスへのHDMI・USB給電の設置を案内しています。メーカーオプションナビやHDMI入力を備えないナビは対象外で、既にHDMI端子がある車両には不要です。接続するFire TV Stickなどと通信環境は別に準備し、後席への出力はモニター品番も添えて確認してください。オプションで総額が変わるため、ディーラーより必ず安いという意味ではありません。');
p(39,'A. 2026年3月版のHondaステップワゴン用資料では、純正HDMI接続コードは税込6,600円で取付工賃別です。これは対象品番の部品代で、全ステップワゴンの施工総額ではありません。ナビ品番、既設配線、前後席への表示希望を伝え、部品代・工賃・追加作業を含む税込総額を確認してください。');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');
for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
if(!raw.includes('[affi id=7]'))throw Error('ad lost');
fs.writeFileSync(path.join(base,'drafts/1761_proposed.raw.html'),raw);
fs.writeFileSync(path.join(__dirname,'1761_rewrite_patch.json'),JSON.stringify({post_id:1761,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
