# 健康管理ダッシュボード（AWS 版）

体重・食事データを可視化する個人用 Web アプリ。  
AWS Amplify Hosting + Lambda + DynamoDB + Cognito をベースとしたサーバーレス構成。

## 機能

- **体重推移**：日次体重 + 7日単純移動平均（SMA）
- **体重増減ペース**：直近 30 日の線形回帰から週あたり変化量を算出
- **栄養素グラフ**：カロリー・タンパク質・脂質・炭水化物・糖質・食物繊維・塩分（各目安ライン付き）
- **期間フィルター**：30日 / 90日 / 半年 / 1年 / 全期間
- **レスポンシブ**：PC・スマホ対応
- **Cognito 認証**：Google / Apple / Facebook / Amazon アカウントでサインイン
- **データ直接入力**：Web UI から体重・食事データを日付単位で追加・編集・削除
- **CSV インポート / エクスポート**：一括データ移行対応

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite + Recharts + Amplify UI |
| 認証 | Amazon Cognito（SNS IdP: Google / Apple / Facebook / Amazon） |
| バックエンド | AWS Lambda（Python 3.12） + Amazon API Gateway |
| データベース | Amazon DynamoDB（オンデマンドキャパシティ） |
| ホスティング | AWS Amplify Hosting |
| IaC | AWS CDK（TypeScript） |

## ディレクトリ構成

```
my-health-dashboard-aws/
├── src/                        # React フロントエンド
│   ├── App.tsx
│   ├── aws-config.ts           # Amplify / Cognito / API 設定
│   ├── hooks/useHealthData.ts  # API フェッチ（JWT 付き）
│   ├── components/
│   └── ...
├── backend/                    # Lambda バックエンド
│   ├── data_processor.py       # DynamoDB 読み書き・集計ロジック
│   ├── lambda/
│   │   ├── data.py             # GET /api/data
│   │   ├── entry.py            # POST/DELETE /api/entry
│   │   ├── export.py           # GET /api/export
│   │   └── import_csv.py       # POST /api/import
│   └── requirements.txt
├── infrastructure/             # AWS CDK スタック
│   ├── bin/app.ts
│   ├── lib/stack.ts            # DynamoDB / Lambda / API GW / Cognito
│   └── package.json
├── scripts/
│   ├── generate_dummy.py       # DynamoDB Local へダミーデータ投入
│   └── migrate_csv_to_dynamodb.py  # 既存 CSV → DynamoDB 移行
├── docker-compose.yml          # DynamoDB Local（ローカル開発用）
├── amplify.yml                 # Amplify Hosting ビルド設定
├── .env.local.example          # ローカル開発用 環境変数テンプレート
├── index.html                  # Vite エントリ HTML
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## ローカル開発

### 1. 依存インストール

```bash
npm install
cd infrastructure && npm install && cd ..
```

### 2. DynamoDB Local を起動

```bash
docker-compose up -d
```

- DynamoDB Local: `http://localhost:8000`
- GUI（dynamodb-admin）: `http://localhost:8001`

### 3. ダミーデータを投入

```bash
pip install boto3 pandas numpy   # 初回のみ
DYNAMODB_ENDPOINT=http://localhost:8000 \
python scripts/generate_dummy.py --user-id dummy-user-001 --create-table
```

### 4. 環境変数を設定

```bash
cp .env.local.example .env.local
# .env.local を編集して CDK デプロイ後の値を記入
```

### 5. フロントエンド開発サーバー起動

```bash
npm run dev
```

`http://localhost:5173` を開く。  
ローカルでは Cognito 認証がかかるため、`.env.local` に実際の Cognito 設定が必要。

---

## AWS へのデプロイ

### 前提条件

- AWS CLI が設定済み（`aws configure`）
- CDK がインストール済み（`npm install -g aws-cdk`）
- CDK Bootstrap 済み（初回のみ: `cdk bootstrap`）

### 1. CDK でインフラをデプロイ

```bash
cd infrastructure
npm install
cdk deploy
```

デプロイ後、出力に以下が表示される：

```
Outputs:
  HealthDashboardStack.ApiEndpoint      = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/
  HealthDashboardStack.UserPoolId       = ap-northeast-1_xxxxxxxxx
  HealthDashboardStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
  HealthDashboardStack.CognitoDomain    = https://health-dashboard-xxxxxxxxxxxx.auth.ap-northeast-1.amazoncognito.com
```

### 2. Amplify Hosting をセットアップ

1. AWS コンソール → Amplify → 「新しいアプリを作成」
2. GitHub リポジトリを連携
3. **環境変数**を設定（CDK 出力の値を使用）：

| 変数名 | 値 |
|---|---|
| `VITE_USER_POOL_ID` | CDK 出力の `UserPoolId` |
| `VITE_USER_POOL_CLIENT_ID` | CDK 出力の `UserPoolClientId` |
| `VITE_COGNITO_DOMAIN` | CDK 出力の `CognitoDomain` |
| `VITE_API_ENDPOINT` | CDK 出力の `ApiEndpoint` |

4. デプロイを実行 → Amplify が `amplify.yml` に従ってビルド・配信

### 3. SNS IdP の追加（オプション）

各プロバイダーのデベロッパーコンソールで OAuth 認証情報を取得し、
`infrastructure/lib/stack.ts` のコメントアウトを解除して再デプロイ：

| IdP | 取得先 |
|---|---|
| Google | [Google Cloud Console](https://console.cloud.google.com/) |
| Apple | [Apple Developer](https://developer.apple.com/) |
| Facebook | [Meta for Developers](https://developers.facebook.com/) |
| Amazon | [Amazon Developer](https://developer.amazon.com/) |

---

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

---

## CSV ファイルの形式

インポートする `.csv` に必要なカラム（余分なカラムは無視）：

| カラム名 | 説明 |
|---|---|
| `日付` | `YYYY/M/D` 形式（例: `2026/3/8`） |
| `体重` | kg |
| `カロリー` / `たんぱく質` / `脂質` / `炭水化物` / `糖質` / `食物繊維` / `塩分` | 各栄養素 |
| `カロリー(目安)` / `たんぱく質(目安)` … | 各目安値 |

文字コードは UTF-8（BOM あり/なし両対応）または Shift-JIS。

---

## 月額コスト目安

個人利用（小規模）の場合：

| サービス | 月額目安 |
|---|---|
| Amplify Hosting | ~$0–1 |
| Lambda + API Gateway | ~$0（無料枠内） |
| DynamoDB | ~$0（25GB / 25WCU / 25RCU 永続無料枠） |
| Cognito | ~$0（MAU 50,000 まで無料） |
| **合計** | **~$0–数ドル/月** |
