# 健康管理ダッシュボード（AWS 版）

体重・食事データを可視化する個人用 Web アプリ。  
AWS Amplify Hosting + Lambda + DynamoDB + Cognito をベースとしたサーバーレス構成。

## 機能

- **体重推移**：日次体重 + 7日単純移動平均（SMA）
- **体重増減ペース**：直近 30 日の線形回帰から週あたり変化量を算出
- **栄養素グラフ**：カロリー・タンパク質・脂質・炭水化物・糖質・食物繊維・塩分（各目安ライン付き）
- **期間フィルター**：30日 / 90日 / 半年 / 1年 / 全期間
- **レスポンシブ**：PC・スマホ対応
- **Cognito 認証**：メールアドレス + パスワードでサインイン（Google / Apple / Facebook / Amazon は[オプション](#6-sns-idp-の追加オプション)）
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
│   ├── tests/                  # compute() の単体テスト（pytest）
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

## デプロイの仕組みと注意点

フロントエンドとバックエンドでデプロイ方法が異なる。

| レイヤー | 対象 | デプロイ方法 | タイミング |
|---|---|---|---|
| フロントエンド | `src/` 以下の React コード | Amplify が `main` ブランチへの push を検知して**自動ビルド・デプロイ** | PR マージ後、数分で反映 |
| バックエンド | `backend/` 以下の Lambda コード | **`cdk deploy` を手動実行**して Lambda 関数を更新 | 実行するまで古いコードのまま |
| インフラ | `infrastructure/` 以下の CDK コード | **`cdk deploy` を手動実行** | 実行するまで変更されない |

> ⚠️ **PR をマージしただけではバックエンドは更新されない。** `backend/` や `infrastructure/` に変更を加えた場合は、マージ後に必ず `cdk deploy` を実行すること。

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

`~/.zshrc` などグローバル設定を汚さずこのプロジェクトだけに閉じたい場合は、プロジェクト直下に `env.sh`（`.gitignore` 済み）を作り、ターミナルごとに `source env.sh` して読み込む。

```bash
# env.sh
export AWS_PROFILE=your-profile
export AWS_PAGER=
```

複数のターミナルアプリ（cmux / VS Code / Kiro のターミナルなど）から同じプロジェクトを触る場合も、それぞれで `source env.sh` すれば同じ設定になる。なお `aws sso login` 自体のトークンは `~/.aws/sso/cache/` にファイルとしてキャッシュされるため、シェルが違ってもログイン状態そのものは共有される。

必要な権限の目安（管理者ロール推奨）：`dynamodb:*` / `lambda:*` / `apigateway:*` / `cognito-idp:*` / `iam:CreateRole` / `cloudformation:*` / `s3:*`

#### 環境変数

`cdk deploy` / `cdk destroy` の実行前に設定する。

| 変数 | 必須 | 説明 | 例 |
|---|---|---|---|
| `GITHUB_TOKEN` | ✅ | Amplify が GitHub リポジトリに接続するための Personal Access Token | `ghp_xxxx` |
| `GITHUB_REPO_URL` | | Amplify がビルドするリポジトリ。未設定なら `git remote get-url origin` から自動で決まる | `https://github.com/<owner>/my-health-dashboard-aws` |
| `CUSTOM_DOMAIN` | | 独自ドメイン（`サブドメイン.ルートドメイン` 形式）。未設定なら Amplify のデフォルトドメイン（`https://main.<appId>.amplifyapp.com`）で公開される | `your-subdomain.your-domain.com` |

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
# 独自ドメインを使う場合のみ
export CUSTOM_DOMAIN=your-subdomain.your-domain.com
```

> **フォークして使う場合**: 自分の GitHub アカウントにフォークし、フォークしたリポジトリを clone して `cdk deploy` する。Amplify は origin リモートのリポジトリをビルドする。
>
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
export CUSTOM_DOMAIN=your-subdomain.your-domain.com   # 独自ドメインを使う場合のみ
cd infrastructure
npm install        # 初回のみ
cdk bootstrap      # 初回のみ
cdk deploy
```

デプロイ後の出力例：

```
Outputs:
  HealthDashboardStack.AmplifyAppUrl    = https://your-subdomain.your-domain.com   # CUSTOM_DOMAIN 未設定なら https://main.<appId>.amplifyapp.com
  HealthDashboardStack.ApiEndpoint      = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/
  HealthDashboardStack.UserPoolId       = ap-northeast-1_xxxxxxxxx
  HealthDashboardStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
  HealthDashboardStack.CognitoDomain    = https://health-dashboard-xxxxxxxxxxxx.auth.ap-northeast-1.amazoncognito.com
```

### 3. Amplify の初回ビルドをトリガー

`cdk deploy` 直後は Amplify アプリが作成されるが、ビルドは自動実行されない。
Amplify コンソール → `health-dashboard` → 「概要」→ `main` ブランチ → **「デプロイを実行」** をクリックする。

完了まで数分かかる。完了後は GitHub の `main` ブランチへの push で自動デプロイが有効になる。

### 4. サインインするユーザーを作成する（初回のみ）

セルフサインアップは無効にしているため、最初のユーザーは管理者が作成する（手順は[管理者によるユーザー作成](#管理者によるユーザー作成)）。作成したメールアドレスと仮パスワードで `AmplifyAppUrl` にサインインする。

### 5. CNAME レコードを Route53 に追加（`CUSTOM_DOMAIN` を設定した場合のみ・初回のみ）

独自ドメインを使う場合は、デプロイ後に 2 種類の CNAME レコードを Route53 に追加する必要がある。

#### 追加する CNAME レコード

| # | 用途 | レコード名 | 値 |
|---|---|---|---|
| 1 | SSL 証明書の検証（ACM） | `_<hash>.your-domain.com` | `_<hash>.acm-validations.aws` |
| 2 | ドメインの向き先（CloudFront） | `your-subdomain.your-domain.com` | `<appId>.cloudfront.net` |

具体的な値は Amplify コンソールで確認する：

1. [Amplify コンソール](https://console.aws.amazon.com/amplify/) を開く
2. アプリ `health-dashboard` → **Domain management** を選択
3. 画面に表示される 2 件の CNAME レコードの **名前** と **値** をそれぞれメモする

> **Amplify コンソールの表示に関する注意**: 新しい Amplify コンソール（2025年以降）では、CDK（CloudFormation）経由で設定したカスタムドメインが Domain management に表示されないことがある。
> その場合は CloudFormation コンソール → `HealthDashboardStack` → 「リソース」タブ → `AmplifyCustomDomain` のリンクから直接ドメイン設定画面にアクセスできる。

#### Route53 への追加手順

`your-domain.com` のホストゾーンがあるアカウントのプロファイル（以下 `<hosted-zone-profile>`）で操作する。

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
  --profile <hosted-zone-profile>
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
  --profile <hosted-zone-profile>
```

> **再デプロイ時の注意（特に cdk destroy → cdk deploy の場合）**:
> `cdk destroy` 後に再デプロイすると CloudFront のエンドポイントが変わる。
> このとき古い CNAME が残っていると Amplify の SSL 設定が "points to another CloudFront distribution" エラーで失敗する。
>
> **対処手順**:
> 1. Route53 で `your-subdomain.your-domain.com` の CNAME レコードを**削除**する
> 2. Amplify コンソール → Domain management → 「再試行」をクリック
> 3. 新しい CNAME 値（新しい `xxxx.cloudfront.net`）が表示されるのでメモ
> 4. Route53 に新しい値で CNAME を**作成**する
>
> `"Action": "UPSERT"` では解決しない（Amplify が新旧 CF の競合を DNS レベルで検出するため）。
> レコード 1（ACM 検証: `_hash.your-domain.com`）は再デプロイ後も変わらないため再追加不要。

DNS 伝播には数分〜最大 48 時間かかる場合がある。  
Amplify コンソールの Domain management で **「Available」** と表示されれば設定完了。

---

### 6. SNS IdP の追加（オプション）

各プロバイダーのデベロッパーコンソールで OAuth 認証情報を取得し、
`infrastructure/lib/stack.ts` のコメントアウトを解除して再デプロイ：

| IdP | 取得先 |
|---|---|
| Google | [Google Cloud Console](https://console.cloud.google.com/) |
| Apple | [Apple Developer](https://developer.apple.com/) |
| Facebook | [Meta for Developers](https://developers.facebook.com/) |
| Amazon | [Amazon Developer](https://developer.amazon.com/) |

---

## テスト

集計ロジック（`backend/data_processor.py` の `compute()`）の単体テストがある。DynamoDB には接続しない。

```bash
pip install -r backend/requirements.txt pytest
pytest backend/tests
```

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
export CUSTOM_DOMAIN=your-subdomain.your-domain.com   # 独自ドメインを使う場合のみ
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
| Lambda × 8 | ✅ | API 用 5 本・認証トリガー 2 本・ログ転送 1 本 |
| Cognito User Pool | ✅ | ユーザーアカウントも削除される |
| DynamoDB | ❌ 残る | 健康データを守るため `RETAIN`。不要なら `aws dynamodb delete-table --table-name health-entries` で手動削除する。**残したまま再デプロイすると同名テーブルが存在するためエラーになる** |
| ログ保存用 S3 バケット | ❌ 残る | `RETAIN`。不要なら中身を空にしてから手動削除する |
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
| DynamoDB | ~$0（オンデマンド。個人利用の読み書き量ならごくわずか） |
| DynamoDB ポイントインタイムリカバリ | ~$0（テーブルサイズに比例。数 MB なら誤差） |
| Cognito | ~$0（個人利用の MAU なら無料枠内） |
| CloudWatch Logs / S3（ログ保存） | ~$0（個人利用のログ量なら数セント） |
| **合計** | **~$0–数ドル/月** |

---

## 付録: ログ構造リファレンス

### 概要

アプリケーションログはすべて **CloudWatch Logs** に JSON 形式で記録されます。外部ログライブラリは使用せず、Python 標準の `logging` モジュールと手動の `json.dumps()` で構造化ログを生成しています。保存期間はすべてのロググループで **3 ヶ月（90 日）** です。

### ロググループ一覧

| ロググループ | 内容 |
|---|---|
| `/aws/apigateway/health-dashboard-access` | API Gateway HTTP アクセスログ |
| `/aws/lambda/health-dashboard-data` | データ取得 Lambda |
| `/aws/lambda/health-dashboard-entry` | データ登録 Lambda |
| `/aws/lambda/health-dashboard-export` | CSV エクスポート Lambda |
| `/aws/lambda/health-dashboard-importcsv` | CSV インポート Lambda |
| `/aws/lambda/health-dashboard-preauth` | Cognito Pre-Authentication トリガー |
| `/aws/lambda/health-dashboard-postauth` | Cognito Post-Authentication トリガー |

### ログイベントの種類とフィールド

#### 1. Lambda アクセスログ（`type: "access"`）

`@log_handler` デコレータが全 Lambda ハンドラ呼び出し時に出力します（`backend/common.py`）。

```json
{
  "type": "access",
  "method": "GET",
  "path": "/api/data",
  "userId": "cognito-sub-uuid",
  "status": 200,
  "durationMs": 45.2
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"access"` |
| `method` | string | HTTP メソッド（`GET` / `POST` / `DELETE`） |
| `path` | string | リクエストパス |
| `userId` | string | Cognito の `sub` クレーム。未認証時は `"anonymous"` |
| `status` | number | HTTP ステータスコード |
| `durationMs` | number | Lambda 実行時間（ミリ秒） |

#### 2. Lambda エラーログ（`type: "error"`）

ハンドラ内で未捕捉の例外が発生した場合に出力されます。

```json
{
  "type": "error",
  "method": "POST",
  "path": "/api/entry",
  "userId": "cognito-sub-uuid",
  "error": "ValidationError: missing field 'date'",
  "durationMs": 12.8
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"error"` |
| `method` | string | HTTP メソッド |
| `path` | string | リクエストパス |
| `userId` | string | Cognito の `sub` クレーム（または `"anonymous"`） |
| `error` | string | 例外メッセージ（`str(e)`） |
| `durationMs` | number | 例外発生までの実行時間（ミリ秒） |

#### 3. 認証試行ログ（`type: "login_attempt"`）

Cognito Pre-Authentication トリガーが全ログイン試行時に出力します（`backend/lambda/auth_pre.py`）。

```json
{
  "type": "login_attempt",
  "username": "user@example.com",
  "triggerSource": "PreAuthentication_Authentication",
  "clientId": "cognito-app-client-id"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"login_attempt"` |
| `username` | string | ログイン試行のユーザー名（メールアドレス） |
| `triggerSource` | string | Cognito トリガーソース識別子 |
| `clientId` | string | Cognito アプリクライアント ID |

#### 4. 認証成功ログ（`type: "login_success"`）

Cognito Post-Authentication トリガーが認証成功時に出力します（`backend/lambda/auth_post.py`）。

```json
{
  "type": "login_success",
  "username": "user@example.com",
  "userId": "cognito-sub-uuid",
  "email": "user@example.com",
  "newDeviceUsed": false,
  "triggerSource": "PostAuthentication_Authentication",
  "clientId": "cognito-app-client-id"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"login_success"` |
| `username` | string | 認証されたユーザー名 |
| `userId` | string | Cognito の `sub` UUID |
| `email` | string | ユーザーのメールアドレス |
| `newDeviceUsed` | boolean | 初回デバイスからのログインかどうか |
| `triggerSource` | string | Cognito トリガーソース識別子 |
| `clientId` | string | Cognito アプリクライアント ID |

#### 5. API Gateway アクセスログ

API Gateway が自動出力する標準フィールド形式のログです。

| フィールド | 説明 |
|---|---|
| `@timestamp` | リクエスト日時 |
| `httpMethod` | HTTP メソッド |
| `resourcePath` | API リソースパス（例: `/api/data`） |
| `status` | HTTP ステータスコード |
| `responseLength` | レスポンスボディのバイト数 |
| `ip` | クライアント IP アドレス |
| `requestTime` | リクエスト受信タイムスタンプ |
| `protocol` | プロトコル（例: `HTTP/1.1`） |

### CloudWatch Logs Insights 保存済みクエリ

CDK デプロイ時に以下のクエリが自動登録されます。マネジメントコンソールの **CloudWatch → Logs Insights → Saved queries** から `health-dashboard/` プレフィックスで検索してください。

| クエリ名 | 対象ロググループ | 内容 |
|---|---|---|
| `health-dashboard/api-access` | API Gateway | HTTP リクエスト一覧（メソッド・パス・ステータス・レスポンスサイズ・IP） |
| `health-dashboard/auth-events` | PreAuth + PostAuth | 全認証イベント（試行・成功の両方） |
| `health-dashboard/auth-attempt-stats` | PreAuth + PostAuth | ログイン試行の集計（5 分窓、username × 試行回数）。成功直前の試行も含む |
| `health-dashboard/auth-successes` | PostAuth | ログイン成功のみ |

> **5 分窓（`bin(5m)`）について**  
> ログイベントを 5 分単位の時間枠でグループ化します。例えば 00:00〜00:05 の間に発生した 6 回の試行は、`bin = 00:00:00` の 1 行に `events = 6` としてまとめて表示されます。短時間に大量の試行が集中する brute force 攻撃の検知に適しています。

## ライセンス

[MIT License](LICENSE)
