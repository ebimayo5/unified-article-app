# DRIVE 2750 新型アルファードTVキャンセラー全文監査（公開待ち）

- 公開URL: https://ebimayo5.com/archives/new-alphard-tv-canceller-guide/
- 2026-10-14 JSTに全文（適合・不具合切り分け・安全・保証・料金表・FAQ）を実読。現行公開RESTは `publish`、最終更新 `2026-09-27T12:25:52Z`、タイトル・URLは担当表と一致。
- 旧スナップショットは現行公開本文と不一致（画像3対7、href6対23）。更新基準に使わず、現在のRESTを `snapshots/drive/backups/2750_public_20261014.raw.html` へ保存した（Git除外）。改稿案 `snapshots/drive/drafts/2750_proposed.raw.html`、差分 `codex/2750_rewrite_patch.json`。

## 一次資料と修正理由

- [ナビ男くんの40系専用商品](https://naviokun.ocnk.net/product/264)はアルファード／ヴェルファイア40系のディスプレイオーディオ・Plus向けTVキャンセラー施工を税込・工賃込み40,000円と案内。Xグレード用は欠品と表示。元記事の料金表はトヨタ一般向け24,000円と40系向け40,000円を同じアルファード用の選択肢のように並べていたため、40系向けの表に整理し、適合とオプションを個別確認する条件を加えた。
- [データシステムTV-KIT適合表](https://www.datasystem.co.jp/tekigou/seg/tvkit/seg_tekigou.php)は40系でもハイブリッド・PHEV、ディスプレイ仕様、製品型番・シリアルで条件が分かれる。記事の「40系対応だけで選ばない」という判断軸は妥当で、該当段落に直接リンクを加えた。
- [トヨタの2025年12月以降の操作説明](https://manual.toyota.jp/alphard/3115/cv/ja_JP/contents/nvch01se010402.php)は運転者の走行中操作を避けるよう注意。記事の運転者による画面注視を避ける安全線は保持。

`node codex/finish_2750.js` で現行公開本文を基準に3差分を再現し、画像タグ7件と既存href23件の保持を静的検証。**WP未更新・公開ページ未検証で完了には加算しない。** 公開前に再度RESTを取得し、他者による本文更新がないか確認する。
