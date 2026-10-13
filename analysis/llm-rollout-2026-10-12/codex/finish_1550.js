const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/1550_before.raw.html'),'utf8');
const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(5,'筆者は整備士専門学校で自動車整備の基礎を学び、整備工場で研修を経験しました。8年放置した個体を見ずに始動や走行の可否を判定することはできません。この記事では、触らず記録できる危険サイン、搬送と点検を頼む順番、見積もりの分け方を整理します。');
p(13,'<a href="https://wwwtb.mlit.go.jp/tohoku/am/am-sub03-031.html" target="_blank" rel="noopener">国土交通省東北運輸局の点検整備案内</a>は、車検合格が有効期間内の無故障を保証するものではないと説明しています。車検が残っていても8年間の放置中の安全は別に確認します。車検が切れていれば通常の公道走行もできません。');
p(19,'エンジンがかかりそうでも、公道を走って工場へ持ち込めるとは限りません。<a href="https://wwwtb.mlit.go.jp/kinki/shaken/rinjiunkou.html" target="_blank" rel="noopener">近畿運輸局の臨時運行許可案内</a>では、車検切れ車の単なる試乗は仮ナンバーの許可目的にならないと明記しています。車検の有効期間と車両の安全状態を分けて確認し、車検切れや危険サインがある場合は搬送方法を工場・ロードサービスへ相談します。');
p(21,'工場へは放置年数と保管場所、地面の漏れ跡、タイヤの状態、ブレーキ固着が疑われるかを伝えます。車両を押したりタイヤを回したりして確認する必要はありません。動かせない可能性をそのまま伝え、積載方法を相談してください。');
c('<li>車両が押して動くかどうか</li>','<li>車両を動かさずに分かる範囲で、ブレーキ固着やタイヤの変形が疑われるか</li>');
p(30,'燃料臭、漏れ、焦げ跡、動物の巣など危険サインがある場合は、ボンネットを開けて原因を探さず、安全な場所から専門家へ連絡してください。危険サインがなく、無理なく開けられる場合だけ、触らず見える範囲を写真に残します。');
p(33,'長期放置ではバッテリーが放電・劣化していることがあります。<a href="https://jaf.or.jp/common/kuruma-qa/category-trouble/subcategory-batteryreplacement/faq-c004" target="_blank" rel="noopener">JAFのバッテリー案内</a>も、長く乗らない間の待機電力による放電を説明しています。ただし、この車の無反応をバッテリーだけが原因と決めず、始動前の全体点検を依頼します。');
p(51,'放置中に空気が抜けたタイヤへ空気を入れても、安全に使えるとは限りません。<a href="https://tire.bridgestone.co.jp/about/maintenance/long-term-tire/" target="_blank" rel="noopener">ブリヂストンの長期経過タイヤの案内</a>は、外観や溝だけで継続使用を判断せず、製造後10年経過したタイヤは交換を推奨しています。10年は一律の使用期限ではなく、8年放置車のタイヤも製造年・保管環境・傷みを専門家に確認してもらいます。');
p(92,'いま手元の30セルシオを直すか別の個体を選ぶか迷う場合は、初回点検・公道復帰・日常使用・快適性回復を分けた見積もりを取り、車両購入費だけでなく同じ用途へ到達する総額で比較します。部品の調達可否と追加作業の上限も先に相談してください。中古相場だけでは自車の修理費や安全状態を判断できません。');
p(99,'A．車検が残っていても、放置中のタイヤ・ブレーキ・燃料・冷却系の安全は保証されません。車検が切れている車は通常の公道走行ができず、仮ナンバーも単なる試乗のためには使えません。始動前点検と、必要なら積載車による搬送を工場へ相談してください。');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');
for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/1550_proposed.raw.html'),raw);
fs.writeFileSync(path.join(__dirname,'1550_rewrite_patch.json'),JSON.stringify({post_id:1550,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
