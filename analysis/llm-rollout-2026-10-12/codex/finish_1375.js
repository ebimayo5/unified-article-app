const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/1375_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>旧普通免許から移行した8t限定中型は、車両総重量8t未満・最大積載量5t未満・乗車定員10人以下のすべてを満たす車が対象です。</strong>5t限定準中型は総重量5t未満・積載量3t未満・定員10人以下。通称の「2t」「4t」ではなく、現在の免許の種類・条件と車検証を照合して判断します。");
p(9,"<a href=\"https://www.keishicho.metro.tokyo.lg.jp/menkyo/menkyo/chugata.html\" target=\"_blank\" rel=\"noopener\">警視庁の準中型新設案内</a>は、改正前の免許で運転できた範囲を改正後も維持することを説明しています。普通免許からの移行は取得期間で分かれ、2007年6月1日以前は8t限定中型、2007年6月2日〜2017年3月11日は5t限定準中型に対応します。現在は上位免許の取得や限定解除などで条件が変わっている場合もあります。");
p(11,"警視庁は、2017年の準中型新設について、貨物自動車による交通死亡事故の削減と若年者の雇用促進を目的に挙げています。安全面だけでなく、若年者が取得できる免許区分を設ける側面もあった制度です。");
p(15,"普通免許を取得した日を手がかりに、2007年6月2日と2017年3月12日の施行日で区分を確認します。取得日だけで最終判断せず、現在の免許の種類と限定条件も確認してください。");
p(18,"2007年6月2日に中型免許が新設されました。2007年6月1日までに普通免許を取得していた人は、従来の範囲を運転できる8t限定中型免許へ移行しました。");
p(23,"2007年6月2日〜2017年3月11日に普通免許を取得した人は、5t限定準中型免許へ移行しました。2007年6月1日以前に取得して8t限定中型になった人まで、5t限定へ狭められたわけではありません。");
p(24,"5t限定準中型は、車両総重量5t未満・最大積載量3t未満・乗車定員10人以下のすべてを満たすことが必要です。AT限定など、これ以外の条件も別に確認します。");
p(31,"<strong>判定に使うのは車検証の車両総重量と最大積載量です。</strong>当日の荷物を減らして実際の重さが軽くなっても、車検証の車両総重量・最大積載量の条件が変わるわけではありません。");
p(37,"次の表は、<a href=\"https://www.police.pref.hyogo.lg.jp/traffic/license/hani/index.htm\" target=\"_blank\" rel=\"noopener\">兵庫県警の取得時期別案内</a>と、<a href=\"https://www.police.pref.osaka.lg.jp/kotsu/untenmenkyo/shurui/5966.html\" target=\"_blank\" rel=\"noopener\">大阪府警の免許区分案内</a>を照合した上限の整理です（2026年10月13日確認）。各行の重量・積載量・定員は、どれか一つではなくすべて満たす必要があります。普通免許からの移行欄は、上位免許取得・限定解除などをしていない場合の目安です。");
const limits=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('主な上限の考え方'));if(!limits)throw Error('limits');c(limits[0],"<figure class=\"wp-block-table\"><table><thead><tr><th>現在の免許・普通免許からの移行</th><th>車両総重量</th><th>最大積載量</th><th>乗車定員</th></tr></thead><tbody><tr><td>現行普通（2017年3月12日以降の取得）</td><td>3.5t未満</td><td>2t未満</td><td>10人以下</td></tr><tr><td>5t限定準中型（2007年6月2日〜2017年3月11日の普通免許から移行）</td><td>5t未満</td><td>3t未満</td><td>10人以下</td></tr><tr><td>8t限定中型（2007年6月1日以前の普通免許から移行）</td><td>8t未満</td><td>5t未満</td><td>10人以下</td></tr><tr><td>限定のない準中型</td><td>7.5t未満</td><td>4.5t未満</td><td>10人以下</td></tr><tr><td>限定のない中型</td><td>11t未満</td><td>6.5t未満</td><td>29人以下</td></tr></tbody></table><figcaption class=\"wp-element-caption\">第一種免許の重量・積載量・定員の範囲を整理。AT限定等の条件や、旅客運送での二種免許などは別途確認してください。「未満」はその数値ちょうどを含みません。</figcaption></figure>");
p(38,"たとえば8t限定中型で、総重量7.9tでも積載量が5tちょうどなら条件から外れます。5t限定準中型も、総重量が5tちょうどなら範囲外です。現行普通では、最大積載量が2tちょうどの車を運転できません。「軽そう」「荷物が少ない」といった印象では判断しないでください。");
p(40,"参考：<a href=\"https://www.keishicho.metro.tokyo.lg.jp/menkyo/menkyo/annai/index.html\">警視庁「運転免許試験のご案内」</a>。免許区分と運転範囲は上の県警案内、手続きは各免許の試験案内で確認してください。");
p(42,"通称ではなく、実際の最大積載量と車両総重量を確認します。現行普通の最大積載量の条件は2t未満なので、車検証の最大積載量が2tの車は範囲外です。「2tクラス」と呼ばれていて実際の積載量が2t未満でも、総重量や定員の条件をすべて確認します。");
p(48,"最大積載量が4tなら、積載量3t未満が条件の5t限定準中型では運転できません。8t限定中型では積載量だけでなく、総重量8t未満・定員10人以下を満たすかも確認します。");
p(53,"まず、免許の「種類」と「条件等」の両方を確認します。条件等欄が空欄でも、あらゆる大きさの車を運転できる意味ではありません。種類を確定したうえで、次のような限定や条件が付いていないかを見ます。");
p(54,"「種類」で運転できる車両区分を確認し、「条件等」でさらに付く限定を確認します。重量の限定だけでなく、AT・眼鏡などの条件も守る必要があります。");
p(62,"車両区分の条件だけでなく、免許の有効期限やAT等の条件、用途に必要な免許も確認します。旅客を運送する業務などは二種免許等の別の確認が必要です。不明点が残る場合は、運転前に免許センターや警察へ照会してください。");
p(65,"予約や配車の段階で確認を済ませ、当日は同じ車両かも確認してから出発しましょう。");
p(73,"必要な教習・審査・手続きは、その免許と限定条件に対応した案内で確認してください。");
p(77,"現行普通は総重量3.5t未満・積載量2t未満・定員10人以下のすべてを満たす必要があります。最大積載量2tちょうど、または総重量3.5t以上なら、現行普通の範囲外です。荷物を減らしてもこの判定は変わりません。");
c("手順1：免許証の「条件等」欄を見る","手順1：免許の「種類」と「条件等」を見る");
c("免許証の<strong>条件等欄</strong>を見る","免許の<strong>種類と条件等欄</strong>を見る");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/1375_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'1375_rewrite_patch.json'),JSON.stringify({post_id:1375,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
