# 健康管理ダッシュボード

体重・食事データを CSV でインポートし、React 製のインタラクティブなダッシュボードで可視化する個人用 Web アプリ。

## 機能

- **体重推移**：日次体重 + 7日単純移動平均（SMA）
- **体重増減ペース**：直近30日の線形回帰から週あたり変化量を算出
- **栄養素グラフ**：カロリー・タンパク質・脂質・炭水化物・糖質・食物繊維・塩分（各目安ライン付き）
- **期間フィルター**：30日 / 90日 / 半年 / 1年 / 全期間を切り替え
- **年度表示**：長期データでは `YYYY/MM` 形式 + 年区切り線を自動表示
- **レスポンシブ**：PC・スマホ対応
- **HTTP Basic 認証**によるアクセス制限
- **CSV アップロード**：ブラウザからデータを一括更新
- **データ直接入力**：Web UI から体重・食事データを日付単位で追加・編集
- **エントリ削除**：入力フォームで全フィールドを空にして保存するとその日のデータを削除
- **CSV エクスポート**：内部データ（`data.csv`）をそのままダウンロード

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite + Recharts |
| バックエンド | Flask + Flask-HTTPAuth |
| データ処理 | pandas + numpy |
| パッケージ管理 | uv（Python）/ npm（Node） |

## ファイル構成

```
├── app.py                  # Flask アプリ（API・アップロード・静的ファイル配信）
├── data_processor.py       # CSV 読み書き・集計ロジック
├── generate_dummy.py       # 開発用ダミーデータ生成スクリプト
├── data.csv                # マスターデータ（gitignore）
├── templates/
│   └── upload.html         # アップロードページ
├── src/                    # React ソース
│   ├── App.tsx
│   ├── components/         # StatCard / WeightChart / SlopeChart / NutrientChart / RangeFilter / EntryForm / EmptyState
│   ├── hooks/
│   │   └── useHealthData.ts
│   ├── utils/
│   │   ├── filterData.ts   # 期間フィルター・X軸間隔計算
│   │   └── dateFormat.ts   # 軸ラベルフォーマット
│   └── types.ts
├── dist/                   # React ビルド成果物（gitignore）
├── pyproject.toml
├── package.json
└── requirements.txt        # Render デプロイ用（uv export で生成）
```

## セットアップ

```bash
# Python 依存インストール
uv sync

# Node 依存インストール
npm install
```

## 開発サーバーの起動

2 つのターミナルで起動する。

```bash
# ターミナル 1：Flask API（ポート 5000）
uv run python app.py

# ターミナル 2：Vite 開発サーバー（ポート 5173）
npm run dev
```

ブラウザで `http://localhost:5173` を開く。

> **ポート 5173 と 5000 の違い**
> - **5173**：Vite の開発専用サーバー。コード変更が即座にブラウザに反映される（HMR）。`/api/*` は自動で 5000 にプロキシされる。
> - **5000**：Flask 本体。本番環境ではこちらだけが動く。

> **macOS でポート 5000 が使用中の場合**
> システム設定 → 一般 → AirDrop と Handoff → AirPlay Receiver をオフ、または別ポートで起動：
> ```bash
> PORT=5001 uv run python app.py
> ```

## 本番ビルドと起動

```bash
# React をビルド（dist/ を生成）
npm run build

# Flask が dist/ を配信
uv run gunicorn app:app
```

ブラウザで `http://localhost:8000` を開く。

## 環境変数

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `DASHBOARD_USER` | `test` | 認証ユーザー名 |
| `DASHBOARD_PASS` | `pw2026@` | 認証パスワード |
| `SECRET_KEY` | `dev-secret-key-change-in-prod` | Flask セッション用シークレットキー |
| `PORT` | `5000` | サーバーのポート番号 |

本番環境では `DASHBOARD_USER`・`DASHBOARD_PASS`・`SECRET_KEY` を必ず変更すること。

## CSV ファイルの形式

アップロードする `.csv` ファイルに必要なカラム。余分なカラム（`曜日`・`備考` など）があっても無視される。

| カラム名 | 必須 | 説明 |
|---|---|---|
| `日付` | ○ | `YYYY/M/D` 形式（例: `2026/3/8`） |
| `体重` | ○ | kg |
| `カロリー` | ○ | kcal |
| `たんぱく質` | ○ | g |
| `脂質` | ○ | g |
| `炭水化物` | ○ | g |
| `糖質` | ○ | g |
| `食物繊維` | ○ | g |
| `塩分` | ○ | g |
| `カロリー(目安)` | ○ | kcal |
| `たんぱく質(目安)` | ○ | g |
| `脂質(目安)` | ○ | g |
| `炭水化物(目安)` | ○ | g |
| `糖質(目安)` | ○ | g |
| `食物繊維(目安)` | ○ | g |
| `塩分(目安)` | ○ | g |

文字コードは UTF-8（BOM あり/なし両対応）または Shift-JIS。

## ダミーデータの生成

開発・テスト用に 1 年分（365 日）のダミーデータを生成できる：

```bash
uv run python generate_dummy.py
```

`data.csv` が生成され、サーバー起動後すぐに確認できる。

---

## 付録：Render へのデプロイ

### ビルドと起動

| 項目 | 設定値 |
|---|---|
| **Environment** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt && npm install && npm run build` |
| **Start Command** | `gunicorn app:app` |

> **注意** Build Command には `npm install && npm run build` が必須です。
> これを省略すると Flask 起動時に `dist/` が存在せず "React build not found" エラーになります。
> Render の Python 3 環境には Node.js が同梱されているので `npm` はそのまま使えます。

### 環境変数（Render の Environment タブで設定）

| 変数名 | 説明 |
|---|---|
| `DASHBOARD_USER` | 認証ユーザー名 |
| `DASHBOARD_PASS` | 認証パスワード |
| `SECRET_KEY` | ランダムな文字列（例：`python -c "import secrets; print(secrets.token_hex())"` で生成） |

### `requirements.txt` の更新

Python 依存関係を変更した際は再生成してコミット：

```bash
uv export --no-hashes -o requirements.txt
git add requirements.txt && git commit -m "update requirements.txt"
```

### トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| "React build not found" | Build Command に `npm run build` が含まれていない | Build Command を上記の通り修正して再デプロイ |
| 認証が通らない | 環境変数 `DASHBOARD_USER` / `DASHBOARD_PASS` 未設定 | Render の Environment タブで設定 |
| アップロード後データが消える | Free プランはディスクが非永続（再デプロイでリセット） | 永続ディスクが必要な場合は有料プランへ移行 |
