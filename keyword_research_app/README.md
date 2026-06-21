# Keyword Treasure Finder

ブログ運営者向けの「穴場キーワード調査ツール」の MVP 実装です。

CSV / XLSX から `keyword` 列を読み込み、Selenium で検索結果を取得し、スコア計算を行って CSV / XLSX に出力します。検証用にダミーモードも残しています。

個人使用版として、総合的な `ねらい目判定` を追加しています。競合数、弱いサイトの順位、強いサイトの多さを合わせて判定します。

```text
かなり狙い目: allintitle_count <= 10 かつ intitle_count <= 5000 を強く評価
狙い目: allintitle_count <= 10 かつ intitle_count <= 5000 を基本条件に、弱いサイト順位とスコアも加味
```

## 必要環境

- Python 3.11 以上
- Google Chrome
- `openpyxl`
- `selenium`

```powershell
python -m pip install -r requirements.txt
```

## 使い方

GUIで起動する場合:

```powershell
python main.py
```

または:

```powershell
python main.py --gui
```

固定キーワードシートで使う場合:

1. GUIの `キーワードシートを開く` を押します。
2. `keyword_input.xlsx` の `keywords` シートが開きます。
3. `keyword` 列に調査したいキーワードを入れて保存します。
4. 保存を検知するとアプリが前面に戻ります。
5. アプリで `開始` を押します。
6. 調査が終わると結果Excelを `output` フォルダに保存し、アプリは自動終了します。

`keyword_input.xlsx` はアプリフォルダ直下に固定で置かれます。ファイルがない場合は起動時に自動作成されます。

CLIで実行する場合:

```powershell
python main.py --input sample\keyword_sample.csv --output output --format both
```

GUIでは結果Excelのみ出力します。CLIでは `csv`、`xlsx`、`both` から選べます。指定しない場合は `config.json` の `output_format` を使います。

実検索を行う場合:

```powershell
python main.py --input sample\keyword_sample.csv --output output --format both --mode live
```

ダミーデータで動作確認する場合:

```powershell
python main.py --input sample\keyword_sample.csv --output output --format both --mode dummy
```

実検索では Selenium が Chrome を起動し、Yahoo 検索、`allintitle:`、`intitle:` の検索結果を取得します。短時間で大量アクセスしないよう、`config.json` の `wait_seconds` を小さくしすぎないでください。

初期設定は live / headlessオン / 出力先はDownloads / 判定 allintitle=10 / 判定 intitle=5000 です。`判定 allintitle` と `判定 intitle` の数値を変えると、狙い目判定の基本しきい値を調整できます。

## 入力ファイル

必須列:

- `keyword`

任意列:

- `genre`
- `memo`
- `priority`

## 出力

`output` フォルダに以下のようなファイルを作成します。

- `keyword_results_YYYYMMDD_HHMMSS.csv`
- `keyword_results_YYYYMMDD_HHMMSS.xlsx`

主な見方:

- `ねらい目判定`: かなり狙い目 / 狙い目 / 要検討 などの総合判定
- `allintitle_count`: タイトルにキーワード全体を含む競合数
- `intitle_count`: タイトルにキーワードを含む競合数
- `opportunity_score`: Q&A、無料ブログ、SNSが上位何位にあるか、強い競合が多いかを含めた独自スコア

## Dokusou風の見方に寄せた部分

既存アプリのコードはコピーせず、出力Excelの構造から個人使用向けに近い見方を再現しています。

- `ねらい目判定`: 競合数、Q&A順位、無料ブログ順位、SNS順位、強いドメイン数を総合して判定
- `Q&A順位`: 検索上位でQ&A系サイトが最初に出た順位
- `無料ブログ順位`: 検索上位で無料ブログ・個人投稿系が最初に出た順位
- `TikTok順位` / `Instagram順位` / `エックス順位` / `Threads順位` / `Facebook順位`: SNSごとに最初に出た順位

Excel出力は `results` シート1枚だけです。Dokusou風の順位列、ねらい目判定、スコアを同じシートにまとめて出力します。

`opportunity_score` は弱いサイトが上位にあるほど高くなります。目安として、1〜3位にQ&Aや無料ブログがある場合は強く加点、4〜5位は中加点、6〜10位は軽く加点します。

## 次の実装候補

## exe化

```powershell
build_exe.bat
```

作成後は以下に配置されます。

- `dist\KeywordTreasureFinder.exe`
- `dist\keyword_input.xlsx`
- `dist\config.json`
- `dist\data`
- `dist\sample`
- `dist\output`
- `dist\logs`

CLIとしてexeを検証する場合:

```powershell
dist\KeywordTreasureFinder.exe --input sample\keyword_sample.csv --output output --format csv --mode dummy
```

## 検証済み

- Python実行でCSV入力、CSV出力
- Python実行でGUI起動
- 停止フラグによる処理停止
- PyInstallerによる `dist\KeywordTreasureFinder.exe` 作成
- exeからCSV入力、CSV出力
- exeからGUI起動
- exeからSelenium live検索を1キーワード実行

## 次の実装候補

1. 検索結果HTML変更時のパーサー調整をしやすくする
2. 検索エンジン側のブロックやCAPTCHA発生時の案内を追加する
3. 配布先PCでのChrome/ChromeDriver要件をREADMEに詳しく追記する
