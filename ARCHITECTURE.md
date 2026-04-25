# Architecture

個人用健康管理ダッシュボードの設計ドキュメント（AWS 版）。

---

## システム全体像

```
┌────────────────────────────────────────────────────┐
│  ブラウザ                                           │
│  React SPA（Amplify Hosting 配信）                  │
│   ├── Authenticator（Cognito Hosted UI）            │
│   ├── 期間フィルター (30日〜全期間)                  │
│   ├── 体重チャート群                                │
│   ├── 栄養素チャート群                              │
│   └── EntryForm（体重・食事の直接入力・削除）        │
└──────────────┬─────────────────────────────────────┘
               │ HTTPS + Authorization: <Cognito JWT>
               ▼
┌────────────────────────────────────────────────────┐
│  Amazon API Gateway（REST API）                     │
│   ├── GET    /api/data    → Lambda: data.py         │
│   ├── POST   /api/entry   → Lambda: entry.py        │
│   ├── DELETE /api/entry   → Lambda: entry.py        │
│   ├── GET    /api/export  → Lambda: export.py       │
│   └── POST   /api/import  → Lambda: import_csv.py  │
│  ※ Cognito User Pools Authorizer で JWT 検証        │
└──────────────┬─────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────┐
│  AWS Lambda（Python 3.12）                          │
│  backend/data_processor.py                         │
│   ├── load_items(userId)  → DynamoDB Query          │
│   ├── put_entry(...)      → DynamoDB PutItem        │
│   ├── delete_entry(...)   → DynamoDB DeleteItem     │
│   ├── compute(items)      → HealthData dict         │
│   └── items_to_csv(items) → CSV 文字列              │
└──────────────┬─────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────┐
│  Amazon DynamoDB                                    │
│  Table: health-entries                              │
│   PK: userId (String)  ← Cognito sub (UUID)        │
│   SK: date   (String)  ← YYYY-MM-DD                │
│  課金: オンデマンド（無料枠内でほぼ $0）             │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  Amazon Cognito User Pool                           │
│   ├── Email/Password サインアップ                   │
│   └── SNS IdP: Google / Apple / Facebook / Amazon  │
└────────────────────────────────────────────────────┘
```

---

## ディレクトリ構成

```
my-health-dashboard-aws/
│
├── src/                          # React フロントエンド
│   ├── main.tsx                  # Amplify.configure + Authenticator.Provider
│   ├── App.tsx                   # ルートコンポーネント（Authenticatorラップ）
│   ├── aws-config.ts             # Amplify / Cognito / API エンドポイント設定
│   ├── index.css
│   ├── types.ts                  # HealthData 型定義
│   │
│   ├── components/
│   │   ├── StatCard.tsx          # サマリーカード
│   │   ├── RangeFilter.tsx       # 期間切り替えボタン
│   │   ├── EntryForm.tsx         # 体重・食事入力モーダル
│   │   ├── WeightChart.tsx       # 体重推移折れ線（SMA・Brush）
│   │   ├── SlopeChart.tsx        # 週次増減ペース棒グラフ
│   │   ├── NutrientChart.tsx     # 栄養素棒グラフ（目安ライン付き）
│   │   └── EmptyState.tsx        # データなし・エラー画面
│   │
│   ├── hooks/
│   │   └── useHealthData.ts      # Cognito JWT 付き API フェッチ
│   │
│   └── utils/
│       ├── filterData.ts         # 期間フィルター・X軸間隔計算
│       └── dateFormat.ts         # 軸ラベルフォーマット
│
├── backend/                      # Lambda バックエンド
│   ├── data_processor.py         # DynamoDB 読み書き + compute()
│   ├── lambda/
│   │   ├── common.py             # CORS ヘッダー・認証ユーザー取得ユーティリティ
│   │   ├── data.py               # GET /api/data ハンドラー
│   │   ├── entry.py              # POST/DELETE /api/entry ハンドラー
│   │   ├── export.py             # GET /api/export ハンドラー
│   │   └── import_csv.py         # POST /api/import ハンドラー
│   └── requirements.txt          # boto3 / pandas / numpy
│
├── infrastructure/               # AWS CDK
│   ├── bin/app.ts                # CDK エントリポイント
│   ├── lib/stack.ts              # HealthDashboardStack 定義
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
│
├── scripts/
│   ├── generate_dummy.py         # DynamoDB Local へダミーデータ投入
│   └── migrate_csv_to_dynamodb.py # 旧 CSV → DynamoDB 移行
│
├── docker-compose.yml            # DynamoDB Local + dynamodb-admin
├── amplify.yml                   # Amplify Hosting ビルド設定
├── .env.local.example            # ローカル VITE_* 変数テンプレート
├── index.html                    # Vite エントリ HTML
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## DynamoDB テーブル設計

**テーブル名**: `health-entries`

| 属性 | 型 | キー種別 | 説明 |
|---|---|---|---|
| `userId` | String | Partition Key | Cognito の `sub`（UUID） |
| `date` | String | Sort Key | `YYYY-MM-DD` |
| `weight` | Number | — | 体重（kg） |
| `calories` | Number | — | 摂取カロリー（kcal） |
| `protein_g` / `fat_g` / `carb_g` / `sugar_g` / `fiber_g` / `salt_g` | Number | — | 各栄養素（g） |
| `cal_target` / `protein_target` / … | Number | — | 各目安値（最後の非欠損値を新規行に引き継ぎ） |

- **マルチユーザー分離**: `userId` がパーティションキーのため、ユーザー間のデータは完全に独立
- **Decimal 型**: DynamoDB の数値精度保証のため `Decimal` 型で保存

---

## バックエンド (`backend/`)

### Lambda ハンドラー一覧

| ファイル | メソッド | パス | 処理 |
|---|---|---|---|
| `data.py` | GET | `/api/data` | 全レコードを Query → `compute()` → JSON |
| `entry.py` | POST | `/api/entry` | 1日分を追加・更新 → `compute()` → JSON |
| `entry.py` | DELETE | `/api/entry` | 指定日を削除 → `compute()` → JSON |
| `export.py` | GET | `/api/export` | 全レコード → CSV（Base64）ダウンロード |
| `import_csv.py` | POST | `/api/import` | CSV バイナリ → DynamoDB 一括書き込み |

### 認証フロー

1. フロントエンドが `fetchAuthSession()` で Cognito ID トークン（JWT）を取得
2. API リクエストの `Authorization` ヘッダーに JWT を付与
3. API Gateway の **Cognito User Pools Authorizer** が JWT を検証
4. 検証済みの `claims.sub` を Lambda の `event.requestContext.authorizer.claims.sub` で受け取り、DynamoDB の `userId` として使用

### `data_processor.py` の公開 API

```python
load_items(user_id)                   -> list[dict]  # DynamoDB Query
put_entry(user_id, date, weight, ...) -> None        # PutItem（追加・更新）
delete_entry(user_id, date)           -> None        # DeleteItem
compute(items)                        -> dict        # HealthData dict 生成
items_to_csv(items)                   -> str         # CSV 文字列（UTF-8 BOM付き）
import_csv_to_dynamo(user_id, file)   -> int         # CSV 一括インポート
```

---

## フロントエンド

### 認証フロー

```
App.tsx
└── <Authenticator>          ← @aws-amplify/ui-react
      └── <Dashboard />      ← 認証済みのみ表示
            ├── signOut()    ← ログアウトボタン
            └── useHealthData() ← JWT 付き API フェッチ
```

### データフロー

```
useHealthData()
  └── apiFetch('/api/data')  ← Authorization: <JWT>
        │
        ▼
  HealthData（全期間）
        │
        ▼
  filterData(data, range)    ← RangeFilter の選択に応じて
        │
        ▼
  filtered HealthData（表示期間のみ）
        │
  ┌─────┼──────────────────────────┐
  ▼     ▼                          ▼
StatCard  WeightChart/SlopeChart  NutrientChart × 7
```

### 環境変数（`VITE_*`）

| 変数名 | 説明 |
|---|---|
| `VITE_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_USER_POOL_CLIENT_ID` | Cognito App Client ID |
| `VITE_COGNITO_DOMAIN` | Cognito Hosted UI ドメイン（HTTPS URL） |
| `VITE_API_ENDPOINT` | API Gateway エンドポイント URL |

ローカルでは `.env.local`、本番では Amplify コンソールの「環境変数」で設定。

---

## ローカル開発環境

```
ブラウザ (localhost:5173)
    │
    │ HTTPS  ← VITE_API_ENDPOINT で指定（実 API Gateway を使用）
    ▼
Amazon API Gateway + Lambda（AWS 本番 or ステージング環境）

docker-compose
    ├── dynamodb-local:8000     ← ローカル DynamoDB
    └── dynamodb-admin:8001     ← GUI ブラウザ
```

> ローカルフロントエンドは実 API Gateway に接続するため、CDK デプロイ後に `.env.local` を設定する必要がある。

---

## CDK スタック概要 (`infrastructure/lib/stack.ts`)

| リソース | 設定 |
|---|---|
| DynamoDB | `health-entries`、PAY_PER_REQUEST、削除保護あり |
| Lambda × 4 | Python 3.12、`backend/` をバンドル、タイムアウト 30s |
| API Gateway | REST API、Cognito Authorizer、CORS 設定済み |
| Cognito User Pool | email サインアップ、SNS IdP 対応（要 OAuth 認証情報） |
| Cognito Domain | `health-dashboard-{accountId}.auth.{region}.amazoncognito.com` |

---

## HealthData dict のキー一覧

| キー | 型 | 説明 |
|---|---|---|
| `dates` | `str[]` | `YYYY-MM-DD` の日付配列 |
| `weights` | `float[]` | 体重（kg）、欠損は線形補間済み |
| `sma7` | `float[]` | 体重の 7日単純移動平均 |
| `calories` | `float[]` | 摂取カロリー |
| `protein_gram` / `fat_gram` / `carb_gram` / `sugar_gram` / `fiber_gram` / `salt_gram` | `float[]` | 各栄養素（g） |
| `slope_dates` / `slope_values` | `str[]` / `float[]` | 週次サンプリング日と 30日線形回帰の傾き（kg/日） |
| `*_target` | `float` | 各栄養素の目安値 |
| `current_weight` | `float` | 最新の体重 |
| `sma7_start` / `sma7_end` | `float` | 期間両端の SMA 値 |
| `weight_diff` | `float` | `sma7_start − sma7_end`（正 = 減量） |
| `avg_cal` | `int` | 平均摂取カロリー |
| `record_days` | `int` | データ日数 |
| `weight_min` / `weight_max` | `float` | グラフ Y 軸範囲（±1kg マージン付き） |
