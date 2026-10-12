const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../snapshots/drive');
let raw = fs.readFileSync(path.join(base, 'backups/967_before.raw.html'), 'utf8');
const initial = JSON.parse(fs.readFileSync(path.join(__dirname, '967_rewrite_patch.json'), 'utf8'));
const changes = initial.changes.slice(0,2).map(x => ({before:x.before, after:x.after, reason:x.reason}));
function paragraph(prefix, after) {
  const matches = [...raw.matchAll(/<p>[\s\S]*?<\/p>/g)].filter(m=>m[0].startsWith('<p>'+prefix));
  if(matches.length!==1) throw Error('Paragraph count '+prefix+': '+matches.length);
  changes.push({before:matches[0][0],after:'<p>'+after+'</p>',reason:'一次資料照合・条件と判断手順の明確化'});
}
paragraph('テレビキャンセラーは、車両の配線に割り込ませて', 'テレビキャンセラーの働き方やナビへの影響は、車両と製品の組み合わせで異なります。テレビが映ること、助手席からナビを操作できること、自車位置やルート案内が通常どおり動くことは、それぞれ別に確かめる項目です。');
paragraph('安価な製品や適合が不明確な製品を取り付けると', '価格だけで動作の良し悪しは判断できません。年式・型式・ナビの種類を特定し、メーカーの適合表と注意事項を確認してください。<a href="https://www.datasystem.co.jp/tekigou/" target="_blank" rel="noopener">データシステムの適合情報</a>では、ナビ操作と地図動作を分けて案内しています。');
paragraph('新車保証を重視するなら', '新車保証を重視するなら、装着予定の製品名と施工内容を販売店へ伝え、車載の保証書に沿って扱いを確認してください。保証の条件は<a href="https://toyota.jp/faq/show/182.html" target="_blank" rel="noopener">トヨタの保証案内</a>とメンテナンスノートを確認するのが出発点です。');
paragraph('これは、半分正解で半分誤解があります。', '車検の判断と、運転者の走行中の画面注視に関する禁止は別の問題です。');
paragraph('テレビキャンセラーそのものが、必ず車検に通らなくなる', '車検に通るかは、装着後の車両が適用される保安基準に適合するかで判断されます。「テレビキャンセラーなら一律に合格・不合格」「配線がきれいなら必ず合格」とは言えません。<a href="https://www.naltec.go.jp/faq/0007.html" target="_blank" rel="noopener">自動車技術総合機構の案内</a>も、同機構の業務を保安基準への適合性の審査と説明しています。');
paragraph('また、検査員や整備工場の判断によって', '施工前に製品の型番、取り付け位置、車両の仕様を整備工場へ示し、確認が必要な装置や施工後の点検内容を相談しましょう。');
paragraph('製品は数千円のものから', '料金は本体だけの価格と、製品・取り付け工賃を含む価格を区別してください。下の施工例では、ナビ男くんが90系ノア・ヴォクシー対応のTVキャンセラー施工を税込・工賃込み30,000円で案内しています（2026年10月12日確認）。');
paragraph('お店に依頼する場合、工賃は1万円', '工賃単独の一律相場としては扱わず、自分の車両条件で総額を比較しましょう。見積もりは「製品代・取り付け工賃・追加部品・既存品の取り外し・税込総額」に分けると、工賃込みプランとの違いが分かります。');
paragraph('通常なら、そのたびに安全な場所に車を停めて', '助手席の同乗者による目的地設定を希望する場合は、「テレビ視聴」だけでなく「ナビ操作」にも対応する製品かを確認してください。テレビが映る製品すべてで、目的地変更やルート案内が同じように使えるわけではありません。');
paragraph('ここでは、主な3つのタイプを比較します。', '比較するときは、配線への接続方法とON/OFFの操作方法を分けましょう。カプラーオン接続と、別付けスイッチやステアリングスイッチによる操作は両立するため、排他的な3種類として選ぶものではありません。');
const table = [...raw.matchAll(/<figure class="wp-block-table[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('カプラーオンタイプ'));
if(!table) throw Error('comparison table missing');
changes.push({before:table[0],after:'<figure class="wp-block-table"><table><thead><tr><th>比較する軸</th><th>確認する内容</th><th>購入前の質問</th></tr></thead><tbody><tr><td>配線への接続方法</td><td>カプラーオンなど。操作方法とは別の軸。</td><td>車両配線の加工は必要か、純正状態へ戻せるか。</td></tr><tr><td>ON/OFFの操作方法</td><td>別付けスイッチ・純正風スイッチ・純正ステアリングスイッチなど。</td><td>自分のナビに適合する操作方式とスイッチ位置はどれか。</td></tr><tr><td>使用中のナビ動作</td><td>ナビ操作、自車位置表示、ルート案内、CarPlayなどへの影響。</td><td>機能ごとの制限と、OFFへ戻す必要がある場面は何か。</td></tr></tbody></table></figure>',reason:'接続方式と操作方式の比較軸を分離'});
paragraph('より確実にON/OFFを切り替えたい方は', '操作方式の例として、<a href="https://www.datasystem.co.jp/products/tvkit_sr.html" target="_blank" rel="noopener">データシステムのTV-KITシリーズ</a>には別付けスイッチ、純正風スイッチ、純正ステアリングスイッチを使う製品があります。シリーズに方式があることと、自分の車両に各方式が適合することは別なので、適合表で絞り込んでください。');
paragraph('基本的に、ディーラーは社外品の取り付けを', 'トヨタは保証の範囲・条件を、車載のメンテナンスノート内の保証書で確認するよう案内しています。販売店全体の方針や個別故障の保証可否を、装着の有無だけで決めつけないでください。');
paragraph('ただし、テレビキャンセラーとまったく関係ないエンジン', '「装着すると車両全体の保証が消える」「関係なさそうな故障なら必ず保証される」のどちらも、本記事では断定しません。製品自体・施工の保証と、トヨタの新車保証は分けて確認しましょう。');
changes.push({before:'車検は「取り付けの丁寧さ」が重要',after:'車検は装着後の車両状態で確認する',reason:'施工外観だけによる合否の一般化を修正'});
paragraph('テレビキャンセラーを付けていること自体が、直接的に', 'この記事で特定の製品や施工後の車検合格を保証することはできません。配線・固定の状態だけでなく、装置の動作や車両側の異常も含め、整備工場で確認する項目を事前に整理してください。');
paragraph('このような状態だと、整備不良や保安基準不適合と', 'これらは施工後に点検しておきたい例です。この一覧だけで車検の合否を判定できるものではありません。');
paragraph('テレビキャンセラーの取り付けは、工賃を含んだ価格で', '次は、ナビ男くんが90系ノア・ヴォクシー向けに案内する税込・工賃込みの施工例です。全国一律の相場ではなく、対象車両・ナビ・追加作業をそろえて比べるための具体例として見てください。');
const price = [...raw.matchAll(/<figure class="wp-block-table[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('30,000円'));
changes.push({before:price[0],after:'<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>施工例と対象</th><th>税込・工賃込みの表示価格</th><th>含まれないもの・注意点</th></tr></thead><tbody><tr><td>90系ノア・ヴォクシー／純正ディスプレイオーディオ・Plus向けTVキャンセラー施工（S-DJV-98）</td><td>30,000円</td><td>HDMI新設などの追加作業は別。ナビ種類・年式・既存装着品を指定して総額を確認。</td></tr></tbody></table><figcaption class="wp-element-caption"><a href="https://naviokun.ocnk.net/product/236" target="_blank" rel="noopener">ナビ男くんの商品詳細</a>の基本施工価格。2026年10月12日確認。カテゴリ一覧は30,000円〜表示です。最新の選択条件・見積もりを優先してください。</figcaption></figure>',reason:'条件付き基本施工価格・確認日・近接出典を明示'});
paragraph('同じテレビキャンセラーでも、メーカーによって金額が', '後席用モニターの追加はTVキャンセラーとは別の施工です。必要な画面枚数や映像の接続方法によって構成が変わるため、<a href="https://naviokun.ocnk.net/product/241" target="_blank" rel="noopener">後席用モニターの商品詳細</a>で自分の希望する組み合わせを確認してください。他車種の料金を90系ノア・ヴォクシーの見積もりへ当てはめないようにしましょう。');
paragraph('最近の製品は対策されているものもありますが', 'たとえば上記S-DJV-98の施工案内には、自車位置の動きが通常と異なる場合があること、Apple CarPlayのナビアプリ利用時はキャンセラーをOFFにすること、車両側アップデートによって動作が変わる可能性が記載されています。これは同商品の条件であり、ほかの製品へ一律に当てはめないでください。');
paragraph('A. 基本的に、自動車メーカーやディーラーは', 'A. 本記事で紹介したナビ男くん・データシステムの商品は、トヨタ純正オプションとして紹介しているものではありません。販売店で取り付け可能と言われた場合も、純正品か社外品か、製品名、製品保証と施工保証の窓口を確認してください。');
paragraph('安全上の理由から、走行中は機能が制限されるのが', '販売店への依頼可否と、装着後の新車保証の扱いも別の確認事項です。取り付けの相談時に、予定する型番と車載ナビの種類を伝えましょう。');
paragraph('□ <strong>1. 90系ノア', '□ <strong>1. 年式・型式・ナビをそろえて適合を確認</strong><br>車検証とナビの装備情報から年式・型式・ディスプレイオーディオ／Plusなどを特定し、メーカー適合表の該当行と注意番号を確認します。90系という車名だけで判断せず、改良前後の区分と自分が使いたい機能も伝えてください。');
for(const c of changes){if(raw.split(c.before).length!==2) throw Error('nonunique change '+c.before.slice(0,50)); raw=raw.replace(c.before,c.after);}
const original=fs.readFileSync(path.join(base,'backups/967_before.raw.html'),'utf8');
const images=s=>(s.match(/<img\b[^>]*>/g)||[]);
if(JSON.stringify(images(original))!==JSON.stringify(images(raw)))throw Error('image changed');
for(const href of original.matchAll(/href="([^"]+)"/g))if(!raw.includes(href[0]))throw Error('link lost '+href[0]);
const stack=[];for(const m of raw.matchAll(/<!-- (\/?)wp:([\w/-]+)([\s\S]*?)-->/g)){if(m[3].trim().endsWith('/'))continue;if(m[1]){if(stack.pop()!==m[2])throw Error('block mismatch');}else stack.push(m[2]);}if(stack.length)throw Error('block open');
fs.mkdirSync(path.join(base,'drafts'),{recursive:true});fs.writeFileSync(path.join(base,'drafts/967_proposed.raw.html'),raw);
fs.writeFileSync(path.join(__dirname,'967_rewrite_patch.json'),JSON.stringify({post_id:967,url:initial.url,status:'verified_ready_to_publish',changes,remaining_checks:['公開直前の最新本文一致と公開後の検証']},null,2)+'\n');
let hash=2166136261;for(const c of original.replace(/\r\n/g,'\n')){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:images(raw).length,originalNormalizedFNV:hash}));
