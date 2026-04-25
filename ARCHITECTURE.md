# Architecture

個人用健康管理ダッシュボードの設計ドキュメント。

---

## システム全体像

```
┌─────────────────────────────────────────────┐
│  ブラウザ                                     │
│  React SPA (Vite ビルド)                     │
│   ├── 期間フィルター (30日〜全期間)            │
│   ├── 体重チャート群                          │
│   ├── 栄養素チャート群                        │
│   └── EntryForm (体重・食事の直接入力・削除)   │
└────────────┬────────────────────────────────┘
             │ HTTP (Basic Auth)
             ▼
┌─────────────────────────────────────────────┐
│  Flask (Python)                              │
│   ├── GET  /              → dist/index.html  │
│   ├── GET  /api/data      → compute(CSV)     │
│   ├── POST /api/entry     → 1行追加・更新    │
│   ├── DELETE /api/entry   → 1行削除          │
│   ├── GET  /api/export    → data.csv DL      │
│   └── GET|POST /upload    → CSV 一括取込     │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  data.csv  (マスターデータ・gitignore)        │
│  ←── アップロード時に上書き / エントリ操作   │
│      で行単位に更新                          │
└─────────────────────────────────────────────┘
```

### データの一生

**CSV 一括取込（アップロード）**
1. ユーザーが `.csv` をアップロード
2. Flask が受け取り `import_csv(file_storage)` を呼ぶ
3. `load_csv()` → pandas で解析・日付正規化
4. `save_csv()` → 必要カラムだけ抽出して `data.csv` に上書き保存
5. ダッシュボードへリダイレクト

**直接入力（EntryForm）**
1. ユーザーがフォームから日付・体重・食事を送信
2. `POST /api/entry` → `add_entry()` が `data.csv` を読み込み・更新・保存
3. `compute()` で集計して JSON を返す → React が再描画

**エントリ削除**
1. 既存エントリの全フィールドを空にして保存
2. `DELETE /api/entry` → `delete_entry()` が該当行を削除して保存
3. `compute()` で集計して JSON を返す

---

## ディレクトリ構成

```
my-health-dashboard/
│
├── app.py                  # Flask エントリポイント
├── data_processor.py       # データ処理コア
├── generate_dummy.py       # 開発用ダミーデータ生成
├── data.csv                # マスターデータ (gitignore)
│
├── templates/
│   └── upload.html         # アップロードページ（Jinja2）
│
├── src/                    # React ソース
│   ├── main.tsx            # エントリポイント
│   ├── App.tsx             # ルートコンポーネント・状態管理
│   ├── index.css           # グローバルスタイル
│   ├── types.ts            # HealthData 型定義
│   │
│   ├── components/
│   │   ├── StatCard.tsx      # サマリーカード（体重/カロリー/日数）
│   │   ├── RangeFilter.tsx   # 期間切り替えボタン群
│   │   ├── EntryForm.tsx     # 体重・食事の直接入力モーダル
│   │   ├── WeightChart.tsx   # 体重推移折れ線（SMA・年区切り・Brush）
│   │   ├── SlopeChart.tsx    # 週次増減ペース棒グラフ
│   │   ├── NutrientChart.tsx # 栄養素棒グラフ（目安ライン付き）
│   │   └── EmptyState.tsx    # データなし・エラー時の画面
│   │
│   ├── hooks/
│   │   └── useHealthData.ts  # /api/data フェッチ・状態管理
│   │
│   └── utils/
│       ├── filterData.ts   # 期間フィルター・X軸間隔計算
│       └── dateFormat.ts   # 軸ラベルフォーマット
│
├── dist/                   # Vite ビルド成果物 (gitignore)
├── index.html              # Vite エントリ HTML
├── vite.config.ts          # Vite 設定（dev プロキシ含む）
├── tsconfig.json
├── package.json
├── pyproject.toml
└── requirements.txt        # Render デプロイ用
```

---

## バックエンド (`app.py` / `data_processor.py`)

### Flask ルート

| メソッド | パス | 処理 |
|---|---|---|
| `GET` | `/` | `dist/index.html` を配信 |
| `GET` | `/assets/<path>` | `dist/assets/` の静的ファイルを配信 |
| `GET` | `/api/data` | `compute(load_csv())` の結果を JSON で返す |
| `POST` | `/api/entry` | 1日分のデータを追加・更新して JSON を返す |
| `DELETE` | `/api/entry` | 指定日のデータを削除して JSON を返す |
| `GET` | `/api/export` | `data.csv` をそのままダウンロード |
| `GET` | `/upload` | アップロードフォームを表示 |
| `POST` | `/upload` | CSV を受け取り `data.csv` に上書き保存 |

すべてのルートに `@auth.login_required` が付いており、HTTP Basic 認証が必要。

### `data_processor.py` の公開 API

```python
load_csv(source=DATA_CSV_PATH) -> pd.DataFrame
    # CSV をファイルパスまたは file-like から読み込み、日付を YYYY-MM-DD に正規化

save_csv(df, path=DATA_CSV_PATH) -> None
    # DataFrame を _COLS 列順で data.csv に書き出し

import_csv(file_storage, path=DATA_CSV_PATH) -> None
    # アップロードされた CSV を load → save（一括取込）

compute(df) -> dict
    # DataFrame から React 用 API dict（HealthData）を生成

add_entry(date, weight=None, nutrition=None, path=DATA_CSV_PATH) -> dict
    # 1日分を追加または更新して compute() の結果を返す

delete_entry(date, path=DATA_CSV_PATH) -> dict
    # 指定日の行を削除して compute() の結果を返す
```

`compute()` がコアで、他は入出力のラッパー。`generate_dummy.py` も `save_csv` / `compute` を直接呼ぶ。

### `HealthData` dict のキー一覧

| キー | 型 | 説明 |
|---|---|---|
| `dates` | `str[]` | `YYYY-MM-DD` の日付配列（全データの軸） |
| `weights` | `float[]` | 体重（kg）。欠損は線形補間済み |
| `sma7` | `float[]` | 体重の7日単純移動平均 |
| `calories` | `float[]` | 摂取カロリー |
| `protein/fat/carb/sugar/fiber/salt_gram` | `float[]` | 各栄養素（g） |
| `slope_dates` | `str[]` | 傾き計算の週次サンプリング日 |
| `slope_values` | `(float\|null)[]` | 30日線形回帰の傾き（kg/日） |
| `*_target` | `float` | 各栄養素の目安値（CSV の目安列の最終非欠損値） |
| `current_weight` | `float` | 最新の体重 |
| `sma7_start/end` | `float` | 期間両端の SMA 値 |
| `weight_diff` | `float` | `sma7_start - sma7_end`（正 = 減量） |
| `avg_cal` | `int` | 平均摂取カロリー |
| `record_days` | `int` | データ日数 |
| `weight_min/max` | `float` | グラフ Y 軸範囲（±1kg のマージン付き） |

---

## フロントエンド

### データフロー

```
useHealthData()
  └─ fetch /api/data
        │
        ▼
  HealthData (全期間)
        │
        ▼
  filterData(data, range)  ← RangeFilter の選択に応じて
        │
        ▼
  filtered HealthData (表示期間のみ)
        │
  ┌─────┼──────────────────────────┐
  ▼     ▼                          ▼
StatCard  WeightChart / SlopeChart  NutrientChart × 7

  EntryForm（モーダル）
    ├── POST /api/entry → 追加・更新
    └── DELETE /api/entry → 削除（全フィールド空で保存時）
```

### EntryForm の挙動

- 日付変更時：既存エントリがあれば値を自動プリフィル
- 保存時：
  - 値あり → `POST /api/entry` で追加・更新
  - 全フィールド空 + 既存エントリあり → 確認後 `DELETE /api/entry` で削除
  - 全フィールド空 + 新規日付 → バリデーションエラー

### 期間フィルターの仕組み（`filterData.ts`）

- `data.dates` の末尾から `days` 件をスライス
- `slope_dates` は `cutDate` 以降を `findIndex` で切り出す
- `weight_min/max`・`sma7_start/end`・`weight_diff`・`avg_cal` をフィルター後の値で再計算
- フィルターはすべてクライアントサイド。再フェッチなし

### 軸ラベルの仕組み（`dateFormat.ts`）

| データ点数 | X 軸ラベル形式 |
|---|---|
| > 120 日 | `YYYY/MM`（月次） |
| ≤ 120 日 | `MM/DD`（週次・日次） |

`xInterval(count)` で Recharts の `interval` prop に渡す間隔も自動計算（約 10〜13 本のラベルになるよう調整）。

### WeightChart の特殊挙動

- **90日超**：個々のドットを非表示（線のみ）、下部に `Brush`（ズームスライダー）を追加
- **年区切り線**：`getYearStarts()` が 1月1日に当たる日付を抽出し `<ReferenceLine>` で描画
- **Brush のラベル**：`tickFormatter` で `YYYY/MM` 形式に変換

### NutrientChart の特殊挙動

- **90日超**（`dense` フラグ）：棒を細く（`maxBarSize: 6`）・半透明（`opacity: 0.6`）にして密度を視覚化

---

## 認証

Flask-HTTPAuth による HTTP Basic 認証。環境変数 `DASHBOARD_USER` / `DASHBOARD_PASS` で資格情報を設定。ブラウザが認証情報をセッション中にキャッシュするため、React からの `fetch` も同一オリジン内で認証が引き継がれる。

---

## 開発環境 vs 本番環境

| | 開発 | 本番 |
|---|---|---|
| フロントエンド | Vite dev server (`:5173`) | Flask が `dist/` を配信 |
| バックエンド | Flask (`:5000`) | Flask (gunicorn) |
| API プロキシ | `vite.config.ts` が `/api`・`/upload` を `:5000` へ転送 | 不要（同一サーバー） |
| HMR | あり | なし |

---

## 新機能の追加ガイド

### 新しい栄養素グラフを追加する

1. **`data_processor.py`** の `compute()` に列の読み込みと return dict へのキー追加
2. **`src/types.ts`** の `HealthData` に対応する型を追加
3. **`src/App.tsx`** に `<NutrientChart>` を追加（既存のものをコピーして props を変えるだけ）

### 新しい集計指標を追加する

1. `data_processor.py` の `compute()` で計算して dict に追加
2. `types.ts` に型を追加
3. 新しいチャートコンポーネントを `src/components/` に作成し、`App.tsx` で使う

### API エンドポイントを追加する

`app.py` にルートを追加し、`@auth.login_required` を付ける。フロントから `fetch('/api/new-endpoint')` で呼べる（開発中は Vite が自動でプロキシ）。

### `vite.config.ts` のプロキシ設定

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:5000', changeOrigin: true },
    '/upload': { target: 'http://localhost:5000', changeOrigin: true },
  },
},
```

新しい Flask ルート（例: `/export`）を追加する場合はここにも追記する。
