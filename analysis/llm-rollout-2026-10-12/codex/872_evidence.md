# DRIVE 872 ステップワゴン TVキャンセラー（公開待ち）

- 公開URL: https://ebimayo5.com/archives/stepwgn-navi-canceller/
- 元記事を全文実読。原文: `snapshots/drive/backups/872_before.raw.html`。提案: `snapshots/drive/drafts/872_proposed.raw.html`（両方Git除外）。差分: `codex/872_rewrite_patch.json`、再生成用 `codex/finish_872.js`。
- 2026-10-14 05時台JSTに改稿案を作成。**WordPress未更新、公開後検証未実施。** 完了には数えない。

## 根拠と修正

1. [施工元の商品ページ](https://naviokun.ocnk.net/product/222)は12,000円（税込・工賃込み）の対象をディーラーオプション「Gathers」と明記。メーカーオプションナビは別商品。Gathersロゴでの見分け方を追記した。
2. 同ページはTVチューナーなしのエントリーインターナビでTV視聴不可、映像はナビに備わるソースに限定と記す。冒頭・まとめ・確認手順へ条件を追記した。
3. 同ページは単体施工約1時間、ルーフコンソール装着車は約30分追加と記す。時間のFAQを具体化した。
4. [HondaのSTEP WGN適用表](https://www.honda.co.jp/navi/pdf/apptable/STEPWGN_apptable_2205.pdf)で2022年の11.4/9/8インチ機種を確認。画面サイズのみでは適合判定できないと明示した。
5. [警察庁の注意喚起](https://www.npa.go.jp/bureau/traffic/keitai/info.html)を踏まえ、元記事の運転者の画面注視禁止・同乗者向けという安全線は保持した。施工元の車検・測位精度の主張は引き続き施工元の案内として扱う。
6. 根拠のない「DIY品は数千円台」の相場断定を除いた。価格表は対象ナビと別商品・オプション料金の条件を加えた。

静的検証は `node codex/finish_872.js` で通過。元記事の画像タグ8件と全既存hrefを保持した。公開時は現行WP本文・タイトル・URL・更新時刻を再取得し、他者更新がないことを照合してから差分を適用する。公開RESTと実ページで本文、画像、リンクを再照合した後だけ `published_verified` にする。
