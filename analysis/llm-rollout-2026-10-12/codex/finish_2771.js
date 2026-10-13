const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2771_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>ディスプレイオーディオのWi-Fi接続は、目的と止まっている段階を分けて確認します。</strong>本体をネットにつなぐテザリングと、無線CarPlay・Android Autoは別の接続です。まず型番ごとの対応方式を確認し、SSIDが見えない／認証失敗／IP設定エラー／接続後に通信できない、の順に症状を絞ります。本体の全初期化を先に行う必要はありません。");
p(7,"<a href=\"https://www.suzuki.co.jp/car/afterservice/display_audio/9inch/\" target=\"_blank\" rel=\"noopener\">スズキの9インチディスプレイオーディオ公式案内</a>の接続表では、iPhoneはUSBとWi-Fi、AndroidスマートフォンはUSBに対応し、AndroidのWi-Fi欄は非対応です。この機種の無線CarPlay対応を、無線Android Autoや本体のインターネット受信対応と読み替えないでください。別機種では、その型番の説明書で確認します。");
p(10,"入力するのは、スマホのテザリング設定に表示されるネットワーク名（SSID）とパスワードです。<a href=\"https://support.apple.com/ja-jp/119837\" target=\"_blank\" rel=\"noopener\">Apple公式の接続不良時の案内</a>では、iPhoneの「設定」→「インターネット共有」で「ほかの人の接続を許可」を確認し、接続できるまでその画面を表示します。<a href=\"https://support.google.com/android/answer/9059108?hl=ja\" target=\"_blank\" rel=\"noopener\">Androidの公式テザリング案内</a>も参照し、端末ごとの設定名を確認してください。");
p(25,"正しいパスワードでも失敗するなら、車載器側に保存された該当SSIDを削除して再登録します。入力ミスの確認を目的に、認証を無効にしたり推測されやすいパスワードへ変更したりする必要はありません。文字入力の制約がある場合は、本体の説明書とメーカーサポートへ確認します。");
p(26,"「IP設定エラー」やIPアドレス取得中の停止は、ネットワーク設定が完了していない症状です。この表示だけでは、認証が正常に完了したことや、スマホ・車載器のどちらが故障しているかまでは断定できません。エラーの全文と発生時点を記録して、接続できる組み合わせと比較します。");
p(29,"省電力やデータ通信を制限する設定、VPNなどを利用している場合は、その有無も相談時に伝えます。エラー表示だけを理由に保護設定を無効化するのではなく、端末・アプリの公式案内で影響を確認してください。業務用・会社支給のスマホは管理者へ相談します。");
p(33,"周波数帯はスマホと車載器の双方に対応が必要です。iPhone 12以降のインターネット共有では、Appleは接続できない場合に「互換性を優先」を試す手順を案内していますが、性能やWi-Fiセキュリティが低下する場合もあるとしています。これはテザリングの確認手順であり、無線Android Autoの必要条件を変更する方法ではありません。");
p(34,"OSや本体ソフトウェアの更新は、その型番の公式手順で確認します。<a href=\"https://jpn.pioneer/ja/corp/news/press/index/2962/\" target=\"_blank\" rel=\"noopener\">Pioneerの2025年5月8日発表</a>では、DMH-SF600が無線CarPlay・Android Autoに対応しています。これは製品固有の機能で、ソフトウェア更新だけで非対応機へ無線連携が追加される根拠ではありません。更新時の電源条件も説明書に従います。");
p(38,"<a href=\"https://ebimayo5.com/archives/display-audio-regret-guide/\">ディスプレイオーディオで後悔しないための機能・使い方の確認</a>");
p(40,"<span style=\"color:#d93025;\"><strong>車載器の本体初期化と、スマホのネットワーク設定リセットは消去範囲が異なります。</strong></span>Appleの上記案内では、iPhoneのネットワーク設定リセットで保存済みWi-Fiとパスワード、モバイルデータ通信設定、VPN・APN設定もリセットされます。SSID単体の削除と混同せず、必要な設定の復元方法を確認してから判断してください。");
p(42,"HDMI入力や後席モニターの増設は、Wi-Fi接続不良とは別の相談です。HDMI端子を追加しても、Wi-Fiの認証・IP設定エラーが直るわけではありません。増設を希望する場合は、車両と装着機器への適合、純正機能への影響、施工後の相談先を確認します。");
p(46,"接続・設定・再起動・更新作業は安全な場所に停車して行います。運転者が走行中にカーナビ等の画像を注視することは禁止されています。<a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁の案内</a>に沿い、ケーブルやスマホの置き方も運転操作を妨げない状態にしてください。");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2771_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2771_rewrite_patch.json'),JSON.stringify({post_id:2771,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
