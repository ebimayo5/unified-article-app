const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2727_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(3,'<strong>フォレスターのHDMI後付けは、ナビに対応する映像入力があるかを確認してから検討します。</strong>DIATONEという名称だけで、パナソニック向けのHDMIユニットが使えるとは判断できません。<a href="https://www.subaru.jp/accessory/catalog/oldmodel/pdf/forester_acc_sk.pdf" target="_blank" rel="noopener">SUBARU公式の旧型SKアクセサリーカタログ</a>でも、ナビごとに外部入力部品と入力方式を分けています。自車の品番と、掲載機種の違いを先に照合しましょう。');
p(4,'同カタログの掲載機種を例にすると、パナソニックH0012SJ010SS向けはHDMI/USBの外部入力ユニット、DIATONE H0014SJ040SS向けはUSB/AUX（音声のみ）のユニットです。名前の似た端子増設部品でも役割が異なります。この例を2021年式の全ナビへ流用せず、自車の品番・入力仕様・既設配線を確定してください。');
p(17,'DIATONEなどのディーラーオプションナビでは、販売店にナビ品番と使用したい映像機器を伝え、映像入力の可否を確認します。USB/AUXの追加部品を、HDMI映像入力の追加部品として買わないことが大切です。純正接続部品で対応できない場合は、適合する別方式または外部モニターを含めて相談しましょう。');
p(37,'費用を比較する際は、部品・配線・内装復元・動作確認の範囲をそろえます。持ち込み品と店舗手配品では、初期不良の交換窓口や点検・脱着費の負担が異なる場合があるため、保証書と店舗の条件を確認してください。持ち込みだけで製品保証が狭くなる、と一律には判断しません。');
const vendor=ps.find(t=>t.startsWith('<p>純正ナビの機能拡張やHDMI接続を施工込みで相談したい場合は'));if(!vendor)throw Error('vendor');
c(vendor,vendor.replace('純正ナビの機能拡張やHDMI接続を施工込みで相談したい場合は、','専門店にも相談する場合は、').replace('でフォレスターのナビ仕様に合う施工内容と、出張取付を含む対応範囲を確認できます。','へ、フォレスターのナビ品番に対してHDMI入力の施工を扱っているか、必要部品と保証範囲から問い合わせてください。車種名だけで施工や出張対応があるとは決めないでください。'));
p(45,'運転者が走行中に映像を注視することは、<a href="https://www.npa.go.jp/bureau/traffic/keitai/info.html" target="_blank" rel="noopener">警察庁の案内</a>で禁止されています。HDMI入力を増設しても、この注意は変わりません。動画の選択・通信接続・機器操作は安全な場所に停車して行い、走行中の映像は同乗者向けとして扱ってください。');
const heading=(original.match(/<h2[^>]*>端子にこだわらず「車内で映像を見る」なら別の手もある<\/h2>/)||[])[0];if(!heading)throw Error('heading');
c(heading,'<h2>HDMI対応部品の価格例はナビ品番と条件をセットで見る</h2>');
p(47,'上記のSUBARU公式SKカタログには、2025年10月1日からの価格改訂リストが添付されています。パナソニック掲載機種向けの外部入力部品を例に、金額と設置方法を分けて確認できます。これは掲載部品の価格例であり、今の自車への後付け総額を保証するものではありません（2026年10月13日確認）。');
const table=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('57,000円'));if(!table)throw Error('table');
c(table[0],'<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>掲載部品と品番</th><th>改訂リストの税込価格</th><th>使い方と条件</th></tr></thead><tbody><tr><td>外部入力ユニット インパネ H0012FL900</td><td>13,200円（標準工賃を含む）</td><td>掲載パナソニックナビ用のHDMI/USB接続部をセンタートレイへ設置。</td></tr><tr><td>HDMI変換ケーブル H0012FJ900</td><td>4,730円（標準工賃を含む）</td><td>掲載パナソニックナビの映像入力をグローブボックスに設置する方法。上記ユニットと共着不可。</td></tr></tbody></table><figcaption class="wp-element-caption">SUBARU公式SKカタログの2025年10月1日価格改訂表。対応ナビ・取付構成を確認し、2種類の部品代を単純に合算しないでください。</figcaption></figure>');
p(48,'カタログの標準工賃を、既存ナビの脱着や追加加工を伴う全施工の料金として使わないでください。今の車両で必要な作業・部品の供給・税込総額は販売店へ確認します。テレビキャンセラーはHDMI入力を追加する機器ではなく、レーダー探知機も動画表示の代替手段にはなりません。目的に合う映像経路を決めてから見積もりを依頼しましょう。');
for(const i of [15,44]){const url=ps[i].slice(3,-4);p(i,'<a href="'+url+'">'+(i===15?'フォレスターの端子位置と装備の確認手順':'ナビのテレビだけが映らない場合の確認手順')+'</a>');}
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);if(!raw.includes('[affi id=7]'))throw Error('ad lost');
fs.writeFileSync(path.join(base,'drafts/2727_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2727_rewrite_patch.json'),JSON.stringify({post_id:2727,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
