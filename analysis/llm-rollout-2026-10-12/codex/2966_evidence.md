# DRIVE BASE post 2966 — アクアのHDMI端子

2026-10-14 JST、[現行公開記事](https://ebimayo5.com/archives/aqua-hdmi-doko/)をWordPress公開RESTで全文確認。現行本文は2026-09-27更新で、旧snapshot（画像3・href3）と異なるため現行版（画像4・href5）を `snapshots/drive/backups/2966_public_20261014.raw.html` に別保存した。現行公開記事はまだ旧記述である。

## 修正が必要な点

1. 冒頭・本文・まとめが「現行世代も場所は一律に案内できない」と読める。トヨタは[2025年9月以降のアクアFAQ](https://toyota.jp/faq/show/6344.html)で、HDMI入力端子を**全車のフロントコンソール前部**と明示し、[取扱説明書の室内図](https://manual.toyota.jp/aqua/2509/hev/ja_JP/contents/alw1741570176907.php)にも掲載している。旧年式・ナビ交換車とは明確に分けて回答する。
2. 55,000円をアクアの「HDMI入力追加・工賃コミ」の確定価格として提示している。[施工元の商品12](https://naviokun.ocnk.net/product/12)はオールインワン本体メニューを55,000円と表示し、HDMIアダプターは追加オプションで選ぶ。対応車種欄にはアクア「2021.07〜」とあるが、すべての年式・仕様への適合を保証する情報ではない。現行純正車には先に標準端子の確認を案内する。HDMIと直接関係しないTVキャンセラー30,000円の行を外す。
3. 「筆者が整備工場での研修経験から感じる」は本人の実体験が未確認。読者に必要な、USB/HDMIの役割と入力配線の確認手順に置き換え、架空の経歴に依存しない表現にする。

`finish_2966.js` は現行公開本文から14箇所だけを置換し、`2966_rewrite_patch.json` と `snapshots/drive/drafts/2966_proposed.raw.html` を作る。実行時に現行画像4タグが同一であること、既存href5件がすべて残ることを検証した。タイトル・URL・アフィリエイトリンクは変更しない。WordPress更新と公開ページ検証は未実施のため `reviewed_pending_publish` とし、完了数へ加えない。
