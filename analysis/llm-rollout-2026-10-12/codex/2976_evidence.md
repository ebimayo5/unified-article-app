# DRIVE BASE post 2976 — レクサスRXのHDMI端子

2026-10-14 JST、[現行公開記事](https://ebimayo5.com/archives/lexus-rx-hdmi-doko/)のWordPress公開RESTを全文確認。現行本文は2026-09-27更新。旧snapshot（画像2・href5）と差があるため、公開本文（画像5・href17）を `snapshots/drive/backups/2976_public_20261014.raw.html` に保存した。

## 修正が必要な点

1. 現行RXのHDMIを単に「仕様次第」としている。[RX350の2025年9月以降のレクサス取扱説明書](https://manual.lexus.jp/rx/3076/cv/ja_JP/contents/edo1749090458948.php)は、HDMIを**販売店オプションの入力端子装着車**に限定している。冒頭でオプション明細の確認を直接案内する。
2. 記事の「104,500円のRX HDMI後付け」は新旧型を区別していない。[施工元の商品149](https://naviokun.ocnk.net/product/149)の対象RXは**2019年9月〜2022年11月のMC後**のみ。2025年12月に在庫限り・生産終了予定と案内し、追加オプションで価格が変わる場合がある。現行RXへその価格を当てはめない。レクサスの[現行RX販売店オプション冊子](https://lexus.jp/models/rx/pdf/dealer_option.pdf)はHDMI端子本体6,050円（税込）、標準取付0.7Hを掲載するが、取付費と年式別装着可否は販売店確認とする。関連性の低いTVキャンセラー等の価格は表から外す。
3. 大型トラック長距離運転の実体験は本人確認できていない。配線の引っ掛かりや発熱の具体的確認手順に置き換える。
4. 本文のRinker説明は車両適合やスマホ映像出力を調べる前に変換アダプター準備を勧めている。適合確認後の比較へ修正する。

`finish_2976.js` は現行公開本文から9箇所を置換し、`2976_rewrite_patch.json` と `snapshots/drive/drafts/2976_proposed.raw.html` を生成する。現行画像5タグの完全一致と既存href17件の保持を検証した。タイトル・公開URL・アフィリエイトリンクは変更しない。WordPress更新・公開ページ検証は未実施のため `reviewed_pending_publish` とし、完了数へ加えない。
