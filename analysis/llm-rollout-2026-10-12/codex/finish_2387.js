const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2387_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>N-BOXの純正HDMI接続コードは、Hondaの車種別資料ではセンターロアーボックス内に取り付けます。</strong>ただし、旧型や社外ナビまで同じ位置ではありません。まず実際のナビ品番と接続コードの装着有無を確認し、<a href=\"https://www.honda.co.jp/navi/pdf/cable/cord_n-box_2607.pdf\" target=\"_blank\" rel=\"noopener\">Honda公式のN-BOX用接続コード資料</a>と照合してください。");
p(13,"<a href=\"https://www.honda.co.jp/navi/nbox/\" target=\"_blank\" rel=\"noopener\">Honda公式のN-BOXナビ案内</a>から、接続コード類の車種別資料を確認できます。掲載資料は9インチHonda CONNECTナビ（LXU-272NBi）、VXM-264ZFEi、VX-240ZFEを分けています。Gathersという名称だけで判断せず、自車の品番に対応するコード・入力規格・取付条件を確認しましょう。");
p(15,"上記車種別資料の08A40-PL0-900Aは、センターロアーボックス内が取付位置です。別のナビや後付け配線の場合は、施工明細と説明書に沿って端子パネルや収納部を確認してください。内装をこじって探さず、見える範囲で確認します。");
p(38,"接続・設定・映像の確認は安全な場所に停車して行います。運転者が走行中にカーナビ等の画像を注視することは禁止されています。<a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁の案内</a>を確認し、同乗者利用でもケーブルや機器が運転操作を妨げないようにします。");
p(40,"<a href=\"https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/\">HDMIやミラーリングが映らない場合の接続条件と確認手順</a>");
p(55,"HDMI入力のないナビに、端子や延長コードだけを追加しても入力機能は増えません。対応ナビへコードを追加する場合の部品代と、取付・配線・復元の工賃を分けて見積もります。次はHonda公式車種別資料の掲載例です（2026年10月13日確認）。");
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('12,000円'));if(!fee)throw Error('fee');c(fee[0],"<figure class=\"wp-block-table is-style-stripes\"><table><thead><tr><th>掲載例</th><th>価格・扱い</th><th>確認する条件</th></tr></thead><tbody><tr><td>純正HDMI接続コード 08A40-PL0-900A</td><td>6,600円（税込、工賃別）</td><td>掲載取付位置はセンターロアーボックス内。自車とナビ品番への適合を確認。</td></tr><tr><td>取付工賃</td><td>Honda販売店へ確認</td><td>標準取付時間0.7H、ギャザズナビまたはディスプレイオーディオと同時装着の場合0.4H。時間を金額と混同しない。</td></tr><tr><td>接続機器と別売品</td><td>必要な構成で見積もり</td><td>HDMIケーブル、映像出力アダプター、指定電源など。後席表示は別に適合確認。</td></tr></tbody></table><figcaption class=\"wp-element-caption\">Honda車種別資料の価格例。旧型や別ナビへの一律適合・施工総額を示す表ではありません。</figcaption></figure>");
p(56,"テレビキャンセラーはHDMI入力を追加する部品ではありません。また、入力端子が使えても、スマホ・アプリ・映像形式・給電の条件が合わなければ再生できません。部品名だけで購入せず、必要部品と工賃を含む総額を確認してください。");
p(58,"A. <a href=\"https://jpn.pioneer/ja/support/manual/manual_pdf.php?dl=1&amp;m_id=17342\" target=\"_blank\" rel=\"noopener\">PioneerのAVIC-RZ812-D等の取付説明書</a>では、本体側にHDMI入力Type DとHDMI出力Type Dが別々に示されています。差し間違えず、対応するケーブルと現車の既設接続を施工店へ確認してください。<a href=\"https://jpn.pioneer/ja/support/manual/navi/21raku_h/36464.php\" target=\"_blank\" rel=\"noopener\">同機種の公式ガイド</a>にはHDMI入力設定の手順もあります。別機種へこの端子仕様を流用せず、品番ごとに確認します。");
p(59,"A. 走行中の映像表示や操作制限はナビ仕様で異なりますが、運転者の画像注視は禁止されています。接続・設定・映像確認は安全な場所に停車して行い、機器やケーブルが安全運転を妨げないようにしてください。");
c('後付けは、ナビ本体にHDMI入力がある場合だけ検討します。','端子の引き出し施工は、ナビ側に対応入力があるか確認してから検討します。');
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2387_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2387_rewrite_patch.json'),JSON.stringify({post_id:2387,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
