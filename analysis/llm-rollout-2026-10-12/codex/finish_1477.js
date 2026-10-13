const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/1477_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>ディスプレイオーディオでミラーリングするには、スマホの映像出力、車載器の対応入力、接続機器の条件をそろえる必要があります。</strong>HDMI端子を増やしたりCarPlayをオフにしたりするだけでは成立しません。まず車載器とスマホの品番を確かめ、入力方式→入力選択→配線・給電→アプリの順に確認します。");
p(1,"HDMIのソースが見つからない場合も、入力非対応、別名の外部入力、設定条件、追加ユニットの構成を区別します。変換器を使う場合は、ソース名が「HDMI」とは限りません。");
p(3,"この記事では、HDMIが選べない・黒画面・音だけ出る症状を分け、必要な部品を買う前に確認する条件と相談先を整理します。");
p(4,"CarPlay・Android Autoは対応アプリの車載表示、ミラーリングはスマホ画面等の外部表示、HDMIは映像・音声信号を入力する接続方式です。目的の機能と、そのための接続経路を分けて確認します。");
p(7,"ミラーリングはスマホ画面の複製を基本としますが、すべての動画やアプリが同じように表示されるわけではありません。セカンドスクリーン表示や外部出力制限もあります。無線はスマホと車載器が同じ規格に対応する必要があり、MiracastとiPhoneのAirPlayを同じ方式とは扱いません。有線ではスマホの映像出力と車載入力を照合します。");
p(8,"市販機もメーカー名だけでは対応を判断できません。<a href=\"https://www.kenwood.com/jp/car/receivers/\" target=\"_blank\" rel=\"noopener\">KENWOOD公式の製品一覧</a>から装着品番の仕様・説明書へ進み、HDMIの入力か出力か、無線表示の規格、対応端末と別売ケーブルを確認します。全機種がHDMIや無線ミラーリング対応という意味ではありません。");
p(10,"物理端子の追加と、車載器の入力機能は別です。端子を付けても対応入力がなければ映像は受けられません。一方、HDMIをアナログ映像へ変換する構成では、車載画面の「外部入力」等から選ぶ場合があります。ソース名がHDMIでないことだけで、非対応や故障と判断しないでください。");
p(11,"<a href=\"https://www.honda.co.jp/navi/audio/displayaudio/\" target=\"_blank\" rel=\"noopener\">Honda公式案内</a>では、掲載するLX-240ZFE・VX-240ZFEについて、HDMI接続後にHDMIアイコンを選ぶ操作を説明しています。これは掲載機種の例です。Hondaの全ナビへ同じ操作を流用せず、実際の型番と車種別接続コードを確認してください。");
p(13,"確認する順番は、対応入力、ソース選択、接続構成、映像表示条件です。すべての故障がこの順で直るという意味ではなく、買い足す前に確認項目を整理するための手順です。");
p(14,"整備工場での研修経験を踏まえ、筆者は内装を外す前にナビの入力仕様と接続部品を確認することを勧めます。入力に対応していない場合、配線を差し直すだけでは機能は増えません。");
p(18,"端子形状に加えて正確なiPhoneモデルを確認します。<a href=\"https://support.apple.com/ja-jp/105099\" target=\"_blank\" rel=\"noopener\">Apple公式のUSB-C接続案内</a>では、USB-C外部ディスプレイ対応モデルを限定しており、例えばiPhone 16eは対象から除かれています。USB-C搭載という理由だけでHDMI変換が使えると判断しないでください。");
p(19,"対応するUSB-C iPhoneでは、USB-C–HDMIアダプターまたは映像対応ケーブルを使う方法があります。Lightning機では対応するDigital AVアダプター等を確認します。<a href=\"https://support.apple.com/ja-jp/108399\" target=\"_blank\" rel=\"noopener\">Apple公式のAVアダプター案内</a>で対応と制限を照合し、充電用変換を映像用と取り違えないようにします。");
p(20,"LightningからHDMIへ出す構成では対応アダプターとHDMIケーブル、USB-C対応機では映像対応アダプターまたはケーブルを確認します。必要な給電は製品ごとです。さらに車載器が受けられる解像度・音声形式と、アプリの外部出力対応を照合してください。");
p(22,"アナログ映像入力がある車載器へHDMIを入れる場合には、信号を変換する機器が必要です。ただし音声のみのAUX端子には映像を入力できません。<a href=\"https://www.datasystem.co.jp/products/hda433/\" target=\"_blank\" rel=\"noopener\">データシステムのHDA433</a>のような変換製品も、車載入力・端末・著作権保護の条件を確認します。AppleはAVアダプターから別映像形式への変換アクセサリに互換性がないと案内しており、変換器の追加でiPhone動画が必ず映るとは保証できません。");
p(24,"入力・出力・変換方向をそろえたうえで、各メーカーが確認する接続構成、給電、映像保護の条件を照合します。HDCPなどを回避する目的で変換器を追加しないでください。");
p(28,"黒画面や一瞬だけ映る症状だけでは、信号が届いているか、どの部品が原因かは断定できません。入力選択、対応解像度、給電、接続、アプリの外部出力対応を一つずつ確認します。Apple公式案内も、アプリ側のアダプター非対応やケーブルの問題を確認対象としています。");
p(37,"<a href=\"https://www.alpine.co.jp/products/displayaudio_test\" target=\"_blank\" rel=\"noopener\">アルパインの掲載製品紹介</a>にもHDMI接続による映像再生が案内されています。ただし、スマホ等の機種で接続ケーブルが異なります。掲載機種の適合表・説明書を確認し、製品紹介だけで全スマホ・全アプリの再生対応を判断しないでください。");
p(44,"運転者が走行中にカーナビ等の画像を注視することは禁止されています。機器を接続できてもこの注意は変わりません。接続・設定・動画選択は安全な場所に停車して行い、配線や端末も運転操作を妨げない位置に配置します。");
p(47,"後付け費用は、対応入力の引き出し、変換ユニットの追加、車載器交換などの作業範囲で変わります。メーカー名だけで料金を比較せず、次の確認項目を同じ条件で見積もってください。");
p(48,"同じHDMI接続が目的でも、純正入力の引き出しと新たなインターフェース追加では部品も作業も異なります。メーカー名だけで一律の施工価格は決められません。適合ナビ、税込総額、含まれる工賃、追加オプションと保証窓口を確認してください。");
p(49,"A. 端子を増やしても対応入力がなければ使えません。一方、変換構成ではソース名が「外部入力」等の場合もあります。車載器と追加ユニットの説明書で入力方式、ソース選択、表示条件を確認し、HDMIという名前がないだけで故障とは判断しないでください。");
p(50,"A. Lightning機では対応アダプター等、映像出力対応USB-C機では映像対応アダプターまたはケーブルが必要です。iPhone 16eのようにUSB-C映像出力に対応しない機種もあるため、先にApple公式のモデル別対応を確認してください。給電やアプリ制限は別に照合します。");
p(51,"A. オフにするだけではミラーリング機能や映像入力は増えません。車載器が自動的にCarPlayへ切り替わる場合も、入力の選択方法を機種の説明書で確認してください。対応する映像経路とスマホ出力が必要です。");
p(55,"A. 安全な場所に停車し、車載器の説明書に従う表示条件を満たして接続・操作します。発進前に操作を終え、配線や端末がペダル・シフト操作や視界を妨げないことを確認してください。");
p(57,"次は、①車載器とスマホの品番を控える、②対応する入力と映像出力・アプリ制限を確認する、③指定構成で停車中に試す、④改善しなければ型番・症状・接続図を販売店や機器メーカーへ伝える、の順に進めてください。");
const fee=[...original.matchAll(/<figure[\s\S]*?<\/figure>/g)].find(m=>m[0].includes('55,000円'));if(!fee)throw Error('fee');c(fee[0],"<figure class=\"wp-block-table is-style-stripes\"><table><thead><tr><th>必要な作業</th><th>費用を確認する内容</th></tr></thead><tbody><tr><td>対応入力を車内へ引き出す</td><td>ナビ品番、指定コード、設置場所、脱着と復元の工賃</td></tr><tr><td>映像インターフェース・変換器を追加する</td><td>入出力方式、車両適合、給電、アプリ制限、設定と動作確認</td></tr><tr><td>後席モニターへ表示する</td><td>前席入力とは別の出力可否、必要配線、画面数、機器と工賃</td></tr></tbody></table><figcaption class=\"wp-element-caption\">同じ作業範囲で税込総額を比較します。TVキャンセラーは映像入力を追加する部品ではありません。</figcaption></figure>");
c(ps[41],ps[41].replace('有線CarPlay対応車でUSB接続だけで完結させたい場合は、','AI Boxは通常のスマホミラーリングや単なる無線化アダプターとは別の機器です。').replace('方法があります。一方、','前に、<a href="https://ottocast.jp/pages/faq" target="_blank" rel="noopener">メーカー公式FAQ</a>と製品別適合で、純正有線CarPlay等の条件、通信と給電、操作方式を確認してください。有線対応だけで全製品の適合は確定せず、BMW向け等の専用製品もあります。一方、'));
c('<li><strong>USB-C</strong>：USB-C→HDMI変換（映像出力対応のもの）を使う発想</li>','<li><strong>USB-C</strong>：iPhone本体の映像出力対応を先に確認し、対応アダプターまたは映像ケーブルを選ぶ</li>');
c('ソース編集（表示/非表示）や、機能OFF設定がある機種もあります。','変換器経由では別のソース名の場合もあります。説明書で選択方法と表示設定を確認します。');
const malformed=(raw.match(/<a\b[^>]*target="_blank" rel="noopener" rel="nofollow sponsored noopener"[^>]*>[\s\S]*?<\/a>/)||[])[0];if(!malformed)throw Error('duplicate rel anchor missing');c(malformed,malformed.replace(' rel="noopener" rel="nofollow sponsored noopener"',' rel="nofollow sponsored noopener"'));
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/1477_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'1477_rewrite_patch.json'),JSON.stringify({post_id:1477,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
