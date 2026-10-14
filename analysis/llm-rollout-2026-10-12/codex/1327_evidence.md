# DRIVE 1327 ルーミー「買ってよかった」全文監査（未完了）

- 公開URL: https://ebimayo5.com/archives/roomy-yokatta-reasons/
- 2026-10-14 10時台JSTに全見出し・本文・表・リンク・画像を実読。現行公開RESTは `publish`、最終更新 `2026-08-23T06:18:27Z`、タイトル・URLは担当表と一致。
- 当初の `snapshots/drive/backups/1327_before.raw.html` は公開本文と一致せず、画像が7対9、リンクが3対5。旧版のまま更新すると既存要素を失うため、現在のRESTを `snapshots/drive/backups/1327_public_20261014.raw.html` に保存し直した（Git除外）。改稿案は `snapshots/drive/drafts/1327_proposed.raw.html`（Git除外）、差分は `codex/1327_rewrite_patch.json`。

## 一次資料照合

- [トヨタのルーミー主要諸元](https://toyota.jp/roomy/specification/)は、掲載例のX（2WD）WLTC 18.4km/L、カスタムG-T（2WD）16.8km/Lを示す。本文はWLTCを参照するよう勧めながら直接リンクがなかったため追記した。
- [トヨタの室内・スライドドア案内](https://toyota.jp/roomy/usability/)は両側パワースライドドアと後席の使い方を案内し、装備はグレードで変わる。記事は装備を車両ごとに確認するよう記しており、この留保は保持した。
- [スズキのソリオ主要諸元PDF](https://www.suzuki.co.jp/car/solio/asset/pdf/detail/detail.pdf)は2WDマイルドハイブリッドのWLTC 25.6km/Lを掲載。記事の「ソリオ側も燃費を確認」という比較を、同条件の公式掲載例を示す文章にした。実燃費と価格・装備は別に比較する留保を付けた。
- 「高速道路の合流が週1回以上」という閾値は一次資料や検証データに根拠がないため、「日常的に使い加速の余裕を重視する」へ変更案を作成した。

## 未確認事項・公開前条件

「筆者は大型トラックで長距離を走ってきた」「筆者が整備工場で研修した」等は本人経験で外部確認できない。ユーザーへ真偽を確認中。回答に応じて維持・訂正・一般記述への変更を決める。これが済むまで完了扱いしない。

`node codex/finish_1327.js` で現行公開本文を基準に4差分を再現し、元画像タグ9件と既存href5件の保持を確認。**WP未更新・公開ページ検証未実施**。公開時は再度RESTを取得して他者の更新がないか照合する。
