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
| バックエンド | AWS Lambda（Python 3.12 / ARM_64） + Amazon API Gateway |
| データベース | Amazon DynamoDB（オンデマンドキャパシティ） |
| ホスティング | AWS Amplify Hosting |
| IaC | AWS CDK（TypeScript） |

## ディレクトリ構成

```
my-health-dashboard-aws/
├── src/                        # React フロントエンド
│   ├── App.tsx
│   ├── aws-config.ts           # Amplify / Cognito / API 設定
│   ├── vite-env.d.ts           # import.meta.env 型定義
│   ├── hooks/useHealthData.ts  # API フェッチ（JWT 付き）
│   ├── components/
│   └── ...
├── backend/                    # Lambda バックエンド
│   ├── common.py               # CORS ヘッダー・認証ユーティリティ
│   ├── data_processor.py       # DynamoDB 読み書き・集計ロジック
│   ├── lambda/
│   │   ├── data.py             # GET /api/data
│   │   ├── entry.py            # POST/DELETE /api/entry
│   │   ├── export.py           # GET /api/export
│   │   └── import_csv.py       # POST /api/import
│   └── requirements.txt
├── infrastructure/             # AWS CDK スタック
│   ├── bin/app.ts
│   ├── lib/stack.ts            # DynamoDB / Lambda / API GW / Cognito / Amplify
│   └── package.json
├── scripts/
│   ├── generate_dummy.py       # DynamoDB Local へダミーデータ投入
│   ├── generate_dummy_csv.py   # Web UI インポート用ダミー CSV 生成
│   └── migrate_csv_to_dynamodb.py  # 既存 CSV → DynamoDB 移行
├── docker-compose.yml          # DynamoDB Local（ローカル開発用）
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
- **デプロイ先 AWS アカウントへの認証・認可が通っていること**

#### AWS SSO を使っている場合

事前に環境変数をセットしておくと、以降の `aws` / `cdk` コマンドで `--profile` を省略できる。

```bash
export AWS_PROFILE=your-profile   # 使用するプロファイル名
export AWS_PAGER=                # ページャーを無効化（出力が止まらなくなる）
```

```bash
# ログイン
aws sso login

# 認証確認（アカウント ID とロールが表示されれば OK）
aws sts get-caller-identity
```

必要な権限の目安（管理者ロール推奨）：`dynamodb:*` / `lambda:*` / `apigateway:*` / `cognito-idp:*` / `iam:CreateRole` / `cloudformation:*` / `s3:*`

#### 必須環境変数

`cdk deploy` / `cdk destroy` の実行前に必ず設定すること。未設定の場合は CDK がエラーで停止する。

| 変数 | 必須 | 説明 | 例 |
|---|---|---|---|
| `GITHUB_TOKEN` | ✅ | Amplify が GitHub リポジトリに接続するための Personal Access Token | `ghp_xxxx` |
| `CUSTOM_DOMAIN` | ✅ | アプリに使用するカスタムドメイン（`サブドメイン.ルートドメイン` 形式） | `your-subdomain.your-domain.com` |
| `AMPLIFY_DEFAULT_URL` | 任意 | Amplify 自動ドメインも Cognito に登録したい場合に設定（初回デプロイ後に確認） | `main.YOUR_OLD_AMPLIFY_APP_ID.amplifyapp.com` |

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
export CUSTOM_DOMAIN=your-subdomain.your-domain.com
export AMPLIFY_DEFAULT_URL=main.<appId>.amplifyapp.com   # 2回目以降のデプロイで設定
```

> **CUSTOM_DOMAIN の前提**: 指定するドメインのルートゾーン（例: `your-domain.com`）を Route53 で管理していること。別 AWS アカウントの Route53 ホストゾーンでも利用可能。

### 1. GitHub Personal Access Token を用意する（初回のみ）

CDK が Amplify と GitHub を連携するために PAT が必要。

1. GitHub にログイン
2. 右上アイコン → **Settings**
3. 左メニュー最下部 → **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. **Generate new token** → **Generate new token (classic)**
6. 以下を設定して **Generate token**：
   - Note: `amplify-cdk`（任意）
   - Expiration: 任意
   - Scope: **`repo`** と **`admin:repo_hook`** にチェック（Amplify が webhook を作成するために必要）
7. 表示されたトークン（`ghp_xxx...`）をコピー（この画面を閉じると二度と表示されない）

### 2. CDK でインフラをデプロイ

Amplify アプリ・Cognito・Lambda・DynamoDB・API Gateway がすべて一括デプロイされる。  
`VITE_*` 環境変数は CDK が Amplify に自動設定するため、コンソールでの手動設定は不要。

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
export CUSTOM_DOMAIN=your-subdomain.your-domain.com
cd infrastructure
npm install        # 初回のみ
cdk bootstrap      # 初回のみ
cdk deploy
```

デプロイ後の出力例：

```
Outputs:
  HealthDashboardStack.AmplifyAppUrl    = https://your-subdomain.your-domain.com
  HealthDashboardStack.ApiEndpoint      = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/
  HealthDashboardStack.UserPoolId       = ap-northeast-1_xxxxxxxxx
  HealthDashboardStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
  HealthDashboardStack.CognitoDomain    = https://health-dashboard-xxxxxxxxxxxx.auth.ap-northeast-1.amazoncognito.com
```

### 3. CNAME レコードを Route53 に追加（初回のみ）

デプロイ後、2 種類の CNAME レコードを Route53 に追加する必要がある。

#### 追加する CNAME レコード

| # | 用途 | レコード名 | 値 |
|---|---|---|---|
| 1 | SSL 証明書の検証（ACM） | `_<hash>.your-domain.com` | `_<hash>.acm-validations.aws` |
| 2 | ドメインの向き先（CloudFront） | `your-subdomain.your-domain.com` | `<appId>.cloudfront.net` |

具体的な値は Amplify コンソールで確認する：

1. [Amplify コンソール](https://console.aws.amazon.com/amplify/) を開く
2. アプリ `health-dashboard` → **Domain management** を選択
3. 画面に表示される 2 件の CNAME レコードの **名前** と **値** をそれぞれメモする

#### Route53 への追加手順

`your-domain.com` のホストゾーンがあるアカウント（`root-admin`）で操作する。

**レコード 1：ACM 証明書検証用**（ルートドメインに対して1回のみ）

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_<hash>.your-domain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{ "Value": "_<hash>.acm-validations.aws" }]
      }
    }]
  }' \
  --profile root-admin
```

**レコード 2：ドメイン向き先**（再デプロイで CloudFront が変わった場合は `UPSERT` で更新）

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "your-subdomain.your-domain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{ "Value": "<appId>.cloudfront.net" }]
      }
    }]
  }' \
  --profile root-admin
```

> **再デプロイ時の注意**: `cdk deploy` のたびに CloudFront のエンドポイント（`<appId>.cloudfront.net`）が変わる場合がある。その場合はレコード 2 を `"Action": "UPSERT"` で更新する。レコード 1（ACM 検証）は変わらないため再追加不要。

DNS 伝播には数分〜最大 48 時間かかる場合がある。  
Amplify コンソールの Domain management で **「Available」** と表示されれば設定完了。

---

### 4. SNS IdP の追加（オプション）

各プロバイダーのデベロッパーコンソールで OAuth 認証情報を取得し、
`infrastructure/lib/stack.ts` のコメントアウトを解除して再デプロイ：

| IdP | 取得先 |
|---|---|
| Google | [Google Cloud Console](https://console.cloud.google.com/) |
| Apple | [Apple Developer](https://developer.apple.com/) |
| Facebook | [Meta for Developers](https://developers.facebook.com/) |
| Amazon | [Amazon Developer](https://developer.amazon.com/) |

---

## ダミー CSV の生成（動作確認用）

Web UI の「CSVをインポートする」で使えるダミーデータを生成できる。

```bash
# 依存インストール（初回のみ）
pip install pandas   # または: uv run python scripts/generate_dummy_csv.py

# 1年分（デフォルト）生成
python scripts/generate_dummy_csv.py

# 期間・ファイル名を指定
python scripts/generate_dummy_csv.py --days 90 --out test_data.csv
```

生成した `dummy_health_data.csv` をブラウザの「CSVをインポートする」ボタンでアップロードするとダッシュボードが表示される。

| オプション | デフォルト | 説明 |
|---|---|---|
| `--days` | `365` | 生成する日数 |
| `--out` | `dummy_health_data.csv` | 出力ファイル名 |
| `--weight-start` | `80.0` | 開始体重（kg） |
| `--weight-end` | `73.5` | 終了体重（kg） |

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

## ユーザー管理（Cognito）

### セルフサインアップ

デフォルトは **無効**（`selfSignUpEnabled: false`）。管理者が作成したユーザーのみサインインできる。

#### 方法 A：コンソールで一時的に有効化（次回 `cdk deploy` で元に戻る）

1. [Cognito コンソール](https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools) を開く
2. ユーザープール `health-dashboard-users` を選択
3. **サインアップエクスペリエンス** タブ → **セルフサービスのサインアップ** → **編集**
4. 「セルフサービスのサインアップを有効にする」をオンにして保存

> ⚠️ 次回 `cdk deploy` を実行すると `false`（無効）に戻る。

#### 方法 B：CDK で恒久的に有効化

`infrastructure/lib/stack.ts` を編集：

```typescript
// 変更前
selfSignUpEnabled: false,

// 変更後
selfSignUpEnabled: true,
```

変更後に再デプロイ：

```bash
export GITHUB_TOKEN=ghp_xxxx
export CUSTOM_DOMAIN=your-subdomain.your-domain.com
cd infrastructure && cdk deploy --require-approval never
```

### 管理者によるユーザー作成

セルフサインアップが無効の状態でも、コンソールからユーザーを手動作成できる：

1. Cognito コンソール → ユーザープール `health-dashboard-users`
2. **ユーザー** タブ → **ユーザーを作成**
3. メールアドレスを入力し、仮パスワードを設定（初回ログイン時に変更を求められる）

---

## リソースの削除（クリーンアップ）

すべての AWS リソースを一括削除できる：

```bash
cd infrastructure
cdk destroy
```

| リソース | 削除 | 備考 |
|---|---|---|
| Amplify アプリ | ✅ | |
| API Gateway | ✅ | |
| Lambda × 4 | ✅ | |
| Cognito User Pool | ✅ | ユーザーアカウントも削除される |
| DynamoDB | ✅ | データも削除される |
| CDK Bootstrap 用 S3 / ECR | 手動 | `CDKToolkit` スタックを別途削除 |

> CDK Bootstrap リソースを削除したい場合：
> ```bash
> aws cloudformation delete-stack --stack-name CDKToolkit
> ```

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
