const fs=require('fs'),path=require('path');
const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2512_before.raw.html'),'utf8');
let raw=original;const changes=[];
function p(prefix,after){const ms=[...original.matchAll(/<p>[\s\S]*?<\/p>/g)].filter(m=>m[0].startsWith('<p>'+prefix));if(ms.length!==1)throw Error(prefix);changes.push({before:ms[0][0],after:'<p>'+after+'</p>'});}
p('スズキ公式サイトでも、ハスラーのメーカーオプション','スズキ公式の<a href="https://www.suzuki.co.jp/car/hustler/interior/" target="_blank" rel="noopener">現行ハスラーの室内装備</a>では、メーカーオプションの9インチナビにHDMI入力を案内しています。ただし、利用には別売の販売会社装着アクセサリーのHDMI接続ケーブルと、機器に合う変換ケーブルなどが必要です（2026年10月12日確認）。この条件を過去の全ハスラーに当てはめず、装着ナビと追加部品を確認してください。<a href=\'https://www.suzuki.co.jp/car/hustler/comfort/\' target=\'_blank\' rel="noopener">快適装備の案内</a>も、購入対象の仕様と照らし合わせましょう。');
p('HDMIが必要かどうかは','HDMIを使うかは、接続したい機器とナビの入力方式で決まります。地図・音楽・通話ならCarPlay／Android Autoで足りる場合があります。HDMI出力の機器を有線でつなぐ場合は、ナビのHDMI入力対応を確認しましょう。ミラーリングの方法すべてがHDMI接続に限られるという意味ではありません。');
changes.push({before:'<h3>スマホ画面や外部機器にはHDMI入力が必要</h3>',after:'<h3>HDMI出力の機器をつなぐならHDMI入力を確認</h3>'});
p('スマホ画面のミラーリング、Fire TV Stick','スマホをHDMI変換アダプター経由でつなぐ場合や、Fire TV Stick・ゲーム機のHDMI出力を接続する場合は、ナビ側のHDMI入力が必要です。CarPlayが起動するUSB端子へHDMI変換器をつなぐだけで、HDMI入力として使えるとは限りません。');
p("<span style='color:#d93025;'><strong>運転者が走行中に映像を注視",'<strong>運転者が走行中にテレビやナビの画像を注視することは禁止されています。</strong>スズキ公式はナビ操作・画面注視の注意を案内しています。<a href="https://www.npa.go.jp/bureau/traffic/keitai/info.html" target="_blank" rel="noopener">警察庁の案内</a>も確認し、操作や視聴は安全な場所に停車して行ってください。同乗者向けでも、走行中に映像表示できるかはナビや機器側の仕様と別に確認する必要があります。');
changes.push({before:'<h2>ハスラーに用意されている施工メニューは何か</h2>',after:'<h2>ハスラーのHDMI後付け見積もりで分けたい費用</h2>'});
p('専門店が車種別に用意しているメニューは','HDMIの相談では、録画用デジタルミラーの施工費をHDMI入力の増設費として比べないでください。必要な作業はナビの入力対応と追加部品で変わるため、次の項目を分けて見積もりを依頼すると比較しやすくなります。');
const t=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('91,300円'));if(!t)throw Error('table missing');
changes.push({before:t[0],after:'<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>見積もり項目</th><th>具体的に確かめる内容</th></tr></thead><tbody><tr><td>ナビ側の接続部品</td><td>HDMI接続ケーブル・専用ユニットの型番と代金。既に装着済みなら重複購入しない。</td></tr><tr><td>施工費</td><td>内装の脱着、ケーブルの引き出し、端子の固定、既存部品の取り外しが含まれるか。</td></tr><tr><td>接続機器と給電</td><td>スマホ用変換器や外部機器、電源部品を自分で用意するか。通信費は別に確認。</td></tr><tr><td>支払総額と保証</td><td>税込総額、追加作業の条件、製品保証と施工保証の窓口。</td></tr></tbody></table></figure>'});
p('扱いが少ないこと自体が情報になります。','公開メニューにHDMI施工が載っていないことだけでは、個別車両への施工可否は決められません。「ハスラーの年式・型式、ナビ型番、希望する接続機器」を添えて確認し、対応しない場合は今のナビで使える接続方法も相談しましょう。');
p('地図・音楽・通話が目的ならCarPlay／Android Autoで足りる場合があります。スマホ画面の表示','地図・音楽・通話が目的ならCarPlay／Android Autoで足りる場合があります。スマホや外部機器をHDMIで接続したい場合は、ナビのHDMI入力対応と、接続機器の給電・映像出力条件を確認してください。');
for(const c of changes){if(raw.split(c.before).length!==2)throw Error('nonunique');raw=raw.replace(c.before,c.after);}
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');
for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
if(!raw.includes('[affi id=7]'))throw Error('ad lost');
fs.writeFileSync(path.join(base,'drafts/2512_proposed.raw.html'),raw);
fs.writeFileSync(path.join(__dirname,'2512_rewrite_patch.json'),JSON.stringify({post_id:2512,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
