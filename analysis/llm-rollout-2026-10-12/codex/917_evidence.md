# DRIVE BASE post 917 — KTCとSnap-onの工具比較

2026-10-14 JST、[現行公開記事](https://ebimayo5.com/archives/tool-ktc-vs-snapon/)のWordPress公開RESTを全文確認。旧snapshot（画像9・href4）と現行本文（画像10・href10）が違うため、現行を `snapshots/drive/backups/917_public_20261014.raw.html` に保存した。

## 一次資料と修正

- 原文比較表はKTCの生産国を日本、Snap-onを米国と断定。[KTC公式](https://en.ktc.jp/our_brand/philosophy.html)自身が国内生産に例外があると説明し、[KTC資料](https://ktc.jp/files/pdf/dl_man/jae401.pdf)には台湾製製品もある。[Snap-on公式](https://www.snapon.com/EN/Our-Company/Global-Presence)は米国外にも製造施設を示す。製造国は製品型番単位で確認する表に変更。
- 原文表の「永久保証制度」は全製品共通に見える。[Snap-on日本法人の保証案内](https://www.snapon.co.jp/warranty/)は保証規定と誤使用時の対象外を案内する。購入ルートと製品ごとの条件を確認する記述へ変更。
- 「整備学校でKTCを初めて使った」「整備工場の研修でSnap-onを使った」「工具を掛けたまま試走した」は運営者本人の経験と確認できない。具体的な製品寸法・用途・作業前後の安全確認へ置換。危険な試走逸話も削除。
- 「Snap-onなら角なめリスクを最小限」など製品比較で検証できない優劣を、同じサイズ・差込角・グリップ形状と作業条件で比べる基準に変更。単に安価な工具は精度が低いとの一律断定も削除。

`finish_917.js` は現行公開本文から17箇所の限定修正を行い、`917_rewrite_patch.json` と `snapshots/drive/drafts/917_proposed.raw.html` を生成した。現行画像10タグは完全一致、既存href10件は全件保持。公開タイトル・URL・商品リンクは変更しない。WordPress更新と公開ページ検証は未実施で `reviewed_pending_publish`、完了数には加えない。
