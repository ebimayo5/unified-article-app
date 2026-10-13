const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2224_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>LBXを選ぶ前は、後席・荷室・駐車場への適合と、希望仕様の支払総額を確認してください。</strong>一人・二人中心でも、家族を乗せる日や旅行の荷物を省かず実車で試します。そのうえで、コンパクトな車体や内装に払う差額に納得できるかを判断します。");
p(6,"LBXは全長だけでなく全幅も確認してください。<a href=\"https://lexus.jp/models/lbx/pdf/specificationslist.pdf\" target=\"_blank\" rel=\"noopener\">公式ハイブリッド主要諸元（2026年5月）</a>では、全長4,190mm・全幅1,825mm・全高1,545mm、最小回転半径5.2mです。「コンパクトだから狭い駐車枠でも大丈夫」とは判断せず、機械式駐車場の寸法・重量制限とドアを開ける余裕を確認します。");
p(8,"価格の納得度は、車体の大きさだけでは決まりません。必要な装備と実際の支払総額をそろえ、内装・扱いやすさ・後席や荷室に求める条件を比較します。自分が何に費用を払いたいかを整理してください。");
p(12,"<a href=\"https://lexus.jp/models/lbx/\" target=\"_blank\" rel=\"noopener\">レクサス公式のLBX価格案内</a>では、ハイブリッドのElegantは420万〜446万円、Cool／Relaxは460万〜486万円、MORIZO RRは680万円と掲載されています（2026年10月13日確認）。車両価格と諸費用込みの支払総額は別です。仕様・オプション・駆動方式をそろえ、契約予定の見積書で確認してください。");
p(15,"上記ハイブリッド諸元の乗車定員は5人ですが、定員内で乗れることと、大人5人やチャイルドシートを含む移動が快適なことは別です。前席を普段の運転位置に合わせた状態で、後席の足元・頭上・乗降と実際の荷物を確認してください。");
p(21,"<a href=\"https://ebimayo5.com/archives/corolla-sport-regret/\">別車種の比較例：カローラスポーツの後席・荷室の確認観点</a>");
p(22,"内装の見た目・触感と、走行中の音・揺れは分けて確認します。静粛性を評価するなら、試乗車のグレード・タイヤ・路面・速度を控え、自分が毎日使う条件で許容できるかを確かめてください。ブランド名だけから全速度域の快適さを保証することはできません。");
p(33,"燃料代を比較する際は、ハイブリッドとMORIZO RRを区別します。公式ハイブリッド諸元の使用燃料はレギュラー、<a href=\"https://lexus.jp/models/lbx/pdf/morizo_rr_specificationslist.pdf\" target=\"_blank\" rel=\"noopener\">MORIZO RRの公式諸元</a>はプレミアムガソリンです。実燃費も同じではありません。保険・点検・税金・タイヤは別に見積もり、WLTC値だけをそのまま年間燃料費に使わないようにします。");
p(34,"タイヤは快適性に加え、車両指定サイズ、負荷能力、速度記号、指定空気圧を確認します。車種名だけで全グレード共通と判断せず、実車のラベルと該当説明書を照合してください。<a href=\"https://www.mlit.go.jp/jidosha/jidosha/tenkenseibi/tenken/\" target=\"_blank\" rel=\"noopener\">国土交通省の点検整備案内</a>も参照し、変更する場合の適合は販売店・専門店へ確認します。");
p(40,"大型トラックの運転経験を踏まえ、筆者は寸法だけでなく、実際の出入口での見切りと切り返しを確認することを勧めます。<strong>MORIZO RRは全幅1,840mm・最小回転半径5.4m</strong>で、上記ハイブリッドと異なります。全長が同じでも取り回しを同一と考えず、希望仕様の試乗車で確かめてください。");
p(46,"<a href=\"https://ebimayo5.com/archives/range-rover-evoque-regret-checkpoints/\">別車種の比較例：イヴォークの用途・維持費・保証の確認</a>");
p(48,"A. 一人・二人利用で全長の短さを活かせるかが判断材料です。ただしハイブリッドの全幅は1,825mm、MORIZO RRは1,840mmあり、狭い駐車枠に合うとは限りません。普段の駐車場・乗降・通勤路を想定し、音・揺れ・シート・給油条件を希望仕様で確認してください。");
p(53,"LBXは、後席・荷室・駐車場の条件と希望仕様の総額が自分の用途に合うかで判断します。ハイブリッドとMORIZO RRでは幅・取り回し・燃料なども異なります。所有感を重視する場合も、使う人数と荷物を実車で確認してから、納得できる差額かを考えてください。");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2224_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2224_rewrite_patch.json'),JSON.stringify({post_id:2224,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
