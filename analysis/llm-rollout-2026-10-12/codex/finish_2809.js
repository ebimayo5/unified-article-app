const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../snapshots/drive');
const original=fs.readFileSync(path.join(base,'backups/2809_before.raw.html'),'utf8');const ps=[...original.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]);let raw=original;const changes=[];
function c(before,after){if(raw.split(before).length!==2)throw Error('nonunique');raw=raw.replace(before,after);changes.push({before,after});}
function p(i,t){c(ps[i],'<p>'+t+'</p>');}
p(0,"<strong>純正ナビなしでも、対応するディスプレイオーディオとスマホがあればGoogleマップで案内できます。</strong>購入前にCarPlay・Android Autoへの対応、接続方式、通信・給電環境を確認してください。通信が不安定な場所へ行く場合は、オフライン地図の条件と代替の案内手段も準備します。画面付きという理由だけで対応とは判断できません。");
p(7,"Google搭載車など、本体側でGoogleマップを使う方式もあります。<a href=\"https://developers.google.com/cars\" target=\"_blank\" rel=\"noopener\">Googleの車載システム案内</a>では、スマホと連携するAndroid Autoと車両上で動くAndroid Automotive OSを区別しています。Android Automotive OSの採用だけでGoogleアプリの搭載まで決まるわけではないため、実車の装備と通信サービスを確認してください。");
p(13,"Android Autoの有線接続について、<a href=\"https://support.google.com/androidauto/answer/6348019?hl=ja\" target=\"_blank\" rel=\"noopener\">Google公式の必要条件</a>はAndroid 9.0以降のスマートフォン、有効なデータプラン、対応する車載器、高品質のUSBケーブルです。Android Goは非対応。無線は対応する車載器と5GHz Wi-Fi等の条件が別に必要なので、有線対応を無線対応と読み替えないでください。");
p(14,"iPhoneは<a href=\"https://support.apple.com/ja-jp/108415\" target=\"_blank\" rel=\"noopener\">Apple公式のCarPlay設定手順</a>に沿い、Siriを有効にして対応車載器へ接続します。有線・無線の設定は車両指定の方法に従い、接続後にGoogleマップを選びます。<a href=\"https://support.google.com/maps/answer/9432062?hl=ja\" target=\"_blank\" rel=\"noopener\">GoogleのCarPlay向け案内</a>でもGoogleマップの操作方法を確認できます。初回の許可と目的地設定は停車中に済ませます。");
p(19,"有線接続は、対応するUSB端子から通信と給電をまとめられる場合があります。ただし、給電量とナビ使用時の消費量によっては電池残量が増えないこともあります。ケーブルの傷みや誤ったUSB端子でも接続は切れるため、有線なら必ず安定するとは考えず、停車中に実機で確認してください。配線は運転操作を妨げない位置に収めます。");
p(21,"<span style=\"background:linear-gradient(transparent 60%, #fff3a3 60%);\"><strong>長距離では、接続方式と給電の両方を出発前に試す</strong></span>ことを優先します。無線対応でも有線接続が使えるとは限らないため、遠出だけケーブルへ切り替える運用は、両方の方式に対応する車載器で検討してください。");
p(25,"純正ナビなしで困らないかは、通信エリア、未知の道を走る頻度、接続・給電の準備、案内が途切れた場合の代替手段で判断します。日常と旅行の経路を一つずつ想定して、停車中に目的地検索から音声案内まで試すと、必要な装備を具体的に確認できます。");
p(30,"通信量は地図だけでなく音楽等の使い方でも変わります。<a href=\"https://support.google.com/maps/answer/6291838?hl=ja\" target=\"_blank\" rel=\"noopener\">Google公式のオフライン地図案内</a>では、経路全体が保存エリア内なら自動車のナビを利用できますが、オフラインでは交通情報や代替経路を利用できません。出発地だけでなく目的地まで含めて保存・更新してください。地図の保存はAndroid Auto等の接続要件をなくすものではありません。");
p(32,"スマホ連携以外にHDMI入力、後席モニター、純正機能との兼ね合いも検討する場合は、次の記事の接続条件を確認してください。HDMI入力の追加とCarPlay・Android Auto機能の追加は別です。");
p(33,"<a href=\"https://ebimayo5.com/archives/display-audio-mirroring-hdmi-not-working/\">HDMI・ミラーリングが映らない場合の接続条件と確認手順</a>");
p(34,"目的地設定や接続不良への対処は安全な場所に停車して行います。運転者が走行中にカーナビ等の画像を注視することは禁止されています。<a href=\"https://www.npa.go.jp/bureau/traffic/keitai/info.html\" target=\"_blank\" rel=\"noopener\">警察庁の案内</a>に沿い、音声案内を使う場合も交通規制と実際の道路状況を優先してください。");
p(41,"A. Google公式の条件では、経路全体が事前に保存したエリア内にあれば自動車のナビを利用できます。ただし、オフラインでは交通情報や代替経路が使えません。地図の有効期限と保存範囲を確認し、車載画面との接続条件も別に満たしてください。保存地図があっても、圏外やトンネルで常に正確な現在地表示が続くという保証ではありません。");
const imgs=s=>s.match(/<img\b[^>]*>/g)||[];if(JSON.stringify(imgs(raw))!==JSON.stringify(imgs(original)))throw Error('image mismatch');for(const m of original.matchAll(/href=(['"])(.*?)\1/g))if(!raw.includes(m[2]))throw Error('link lost '+m[2]);
fs.writeFileSync(path.join(base,'drafts/2809_proposed.raw.html'),raw);fs.writeFileSync(path.join(__dirname,'2809_rewrite_patch.json'),JSON.stringify({post_id:2809,status:'verified_ready_to_publish',changes},null,2)+'\n');
function hash(s){let h=2166136261;for(const c of s.replace(/\r\n/g,'\n')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
console.log(JSON.stringify({changes:changes.length,originalChars:original.length,proposedChars:raw.length,images:imgs(raw).length,originalFNV:hash(original),proposedFNV:hash(raw)}));
