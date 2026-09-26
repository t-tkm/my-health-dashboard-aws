# データの取り込み

## CSV とダッシュボードの関係

CSV をマスターデータ、Web アプリをダッシュボードとして扱う想定。「CSVで置き換える」は**置き換え**で動く。

- CSV にある日付は、その日のデータを CSV の内容で上書きする
- **CSV にない日付のデータは削除する**（取り込み後の DynamoDB は CSV と同じ内容になる）
- データ行が 0 行の CSV、同じ日付が複数ある CSV はエラーにして、既存データには触れない

Web の「データを入力する」で追加・編集した分は DynamoDB にだけ入る。CSV をマスターとして運用する場合は、入力後に「CSVエクスポート」で CSV を取り直しておく。
誤って置き換えた場合は、DynamoDB のポイントインタイムリカバリ（直近 35 日）で置き換え前の時点に戻せる（別テーブルとして復元される）。

## CSV ファイルの形式

インポートする `.csv` に必要なカラム（余分なカラムは無視）：

| カラム名 | 説明 |
|---|---|
| `日付` | `YYYY/M/D` 形式（例: `2026/3/8`） |
| `体重` | kg |
| `カロリー` / `たんぱく質` / `脂質` / `炭水化物` / `糖質` / `食物繊維` / `塩分` | 各栄養素 |
| `カロリー(目安)` / `たんぱく質(目安)` … | 各目安値 |

文字コードは UTF-8（BOM あり/なし両対応）または Shift-JIS。

## ダミー CSV の生成（動作確認用）

Web UI の「CSVで置き換える」（データが空のときは「CSVをインポートする」）で使えるダミーデータを生成できる。

```bash
# 依存インストール（初回のみ）
pip install pandas   # または: uv run python scripts/generate_dummy_csv.py

# 1年分（デフォルト）生成
python scripts/generate_dummy_csv.py

# 期間・ファイル名を指定
python scripts/generate_dummy_csv.py --days 90 --out test_data.csv
```

生成した `dummy_health_data.csv` をブラウザの「CSVで置き換える」ボタンでアップロードするとダッシュボードが表示される（既存データはダミーで置き換わるので、先に「CSVエクスポート」で退避しておく）。

| オプション | デフォルト | 説明 |
|---|---|---|
| `--days` | `365` | 生成する日数 |
| `--out` | `dummy_health_data.csv` | 出力ファイル名 |
| `--weight-start` | `80.0` | 開始体重（kg） |
| `--weight-end` | `73.5` | 終了体重（kg） |

## 既存 CSV データの移行

Render 版から移行する場合、`migrate_csv_to_dynamodb.py` を使う：

```bash
# Cognito で取得した自分のユーザー ID（sub）を確認してから実行
python scripts/migrate_csv_to_dynamodb.py \
    --csv data.csv \
    --user-id <cognito-user-sub> \
    --region ap-northeast-1

# DynamoDB Local でテストする場合
python scripts/migrate_csv_to_dynamodb.py \
    --csv data.csv \
    --user-id dummy-user-001 \
    --endpoint http://localhost:8000 \
    --create-table
```
