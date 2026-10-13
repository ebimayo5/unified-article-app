# Home記事115：UCLA/Princeton研究の原典照合と公開修正待ち

記事: https://kurashi-ie.com/organized-home-storage-ideas/ （WP ID 115）。現在の公開タイトルは「なぜか部屋が片付かない？リバウンドを防ぐ片付く収納アイデアと便利グッズ」、公開更新は2026-10-13 12:23:18 JST。クロの `claude/evidence/kurashi-115_storage-ideas-tidy.md` は論文原典を未確認と明記していた。

## 一次資料と測定範囲

- Saxbe & Repetti, *No Place Like Home: Home Tours Correlate With Daily Patterns of Mood and Cortisol* ([UCLA著者の論文PDF](https://repettilab.psych.ucla.edu/wp-content/uploads/sites/302/2023/03/no-place-like-home.pdf), DOI 10.1177/0146167209352864): 共働き夫婦60人の自宅ツアーで使われた言葉を分析。散らかり・未完成の言葉を多く使う家庭の妻では、3平日に測ったコルチゾールの日内変化が平坦で、抑うつ気分の増加との**関連**が報告された。「散らかった家ではコルチゾールの値が高くなる」という単純な結果や片付けの因果効果ではない。
- McMains & Kastner, *Interactions of Top-Down and Bottom-Up Mechanisms in Human Visual Cortex* ([PubMed原著概要](https://pubmed.ncbi.nlm.nih.gov/21228167/), [PMC全文](https://pmc.ncbi.nlm.nih.gov/articles/PMC3072218/), DOI 10.1523/JNEUROSCI.3766-10.2011): 視野内に同時提示された複数刺激の視覚皮質での競合と注意の調整を実験した。家庭の散らかりや日常の集中力低下は測定していない。

## 公開本文の修正対象

1. 「UCLA（カリフォルニア大学ロサンゼルス校）の研究では、自宅が散らかっていると感じる女性はストレスホルモンの値が高くなることがという報告があります。」は文法が崩れており、論文の結果も誤る。最小案: 「UCLAの研究では、自宅を散らかっている・未完成だと表現する傾向と、女性のコルチゾールの日内変化との関連が報告されています。ただし、片付ければホルモン値が下がると示した研究ではありません。」原著への出典リンクを付ける。
2. 「プリンストン大学神経科学研究所の研究によると、視界に入る『物理的な散らかり』は脳の集中力を低下させると言われています。」は実験結果を家庭環境に飛躍させる。最小案: 「視界に入る物が多くて気が散ると感じるなら、まず作業する場所の周りから整えると取りかかりやすくなります。」研究名による裏付けの表示は削除する。

更新前に現行の公開本文と更新時刻を再取得する。上の2文以外の本文、URL、タイトル、画像、既存リンク、Rinkerショートコードを保持し、公開後RESTと実ページで確認する。公開更新・ページ検証は**未実施**。`claude/home_audit.csv` は `source_review_pending` として完了数から除外した。
