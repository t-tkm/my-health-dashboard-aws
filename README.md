# 健康管理ダッシュボード（AWS 版）

体重・食事データを可視化する個人用 Web アプリ。
AWS Amplify Hosting + Lambda + DynamoDB + Cognito のサーバーレス構成で、AWS CDK でまとめてデプロイできる。

## 機能

- 体重推移（7日移動平均）と、直近 30 日の回帰から出す週あたりの増減ペース
- 栄養素グラフ（カロリー・PFC・糖質・食物繊維・塩分、目安ライン付き）
- 期間フィルター（30日 / 90日 / 半年 / 1年 / 全期間）、PC・スマホ対応
- Web UI からの日次データ入力・編集・削除、CSV での置き換え / エクスポート（CSV をマスターデータとして扱える）
- Cognito 認証（メール + パスワード。SNS IdP はオプション）

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite + Recharts + Amplify UI |
| 認証 | Amazon Cognito |
| バックエンド | AWS Lambda（Python 3.12 / ARM64） + Amazon API Gateway |
| データベース | Amazon DynamoDB（オンデマンド） |
| ホスティング | AWS Amplify Hosting |
| IaC | AWS CDK（TypeScript） |

構成図・ディレクトリ構成・API の詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照。

## AWS へのデプロイ

### 前提

- AWS CLI の認証が通っていること（SSO の場合は [docs/deployment.md](docs/deployment.md#aws-sso-を使う場合)）
- Node.js と Docker（Lambda の依存ライブラリのビルドに使う）
- GitHub Personal Access Token（scope: `repo`, `admin:repo_hook`。作り方は [docs/deployment.md](docs/deployment.md#github-personal-access-token-の作成)）

### 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | Amplify が GitHub に接続するための PAT |
| `GITHUB_REPO_URL` | | ビルドするリポジトリ。未設定なら `git remote get-url origin` |
| `CUSTOM_DOMAIN` | | 独自ドメイン。未設定なら `https://main.<appId>.amplifyapp.com` で公開（設定方法は [docs/deployment.md](docs/deployment.md#独自ドメインcustom_domainの設定)） |

`env.sh.example` をコピーした `env.sh`（`.gitignore` 済み）に書いておくと、ターミナルごとに `source env.sh` するだけで設定できる。`export` で直接設定してもよい。

> ⚠️ 一度 `CUSTOM_DOMAIN` を設定してデプロイしたら、以降のデプロイでも必ず設定する。未設定のままデプロイすると Amplify から独自ドメインの設定が外れる。

フォークして使う場合は、フォークしたリポジトリを clone してデプロイすれば Amplify はそのリポジトリをビルドする。

### 手順

```bash
cp env.sh.example env.sh   # 初回のみ。GITHUB_TOKEN などを記入する
source env.sh
cd infrastructure
npm install
npx cdk bootstrap   # 初回のみ
npx cdk deploy
```

1. デプロイ後、Amplify コンソール → `health-dashboard` → `main` ブランチで **「デプロイを実行」** を押して初回ビルドを走らせる（以降は `main` への push で自動デプロイ）
2. セルフサインアップは無効なので、Cognito コンソールでユーザーを作成する（[手順](docs/deployment.md#管理者によるユーザー作成)）
3. 出力された `AmplifyAppUrl` を開いてサインインする

> ⚠️ Amplify が自動デプロイするのはフロントエンド（`src/`）だけ。`backend/` や `infrastructure/` を変更したときは、マージ後に `cdk deploy` を実行する。

## ローカル開発

```bash
npm install
docker-compose up -d               # DynamoDB Local（:8000）と管理 GUI（:8001）
cp .env.local.example .env.local   # CDK デプロイ後の Cognito / API の値を記入
npm run dev                        # http://localhost:5173
```

認証は実際の Cognito を使うため、ローカル開発にも一度 `cdk deploy` しておく必要がある。
ダミーデータの作り方や CSV の形式は [docs/data.md](docs/data.md) を参照。

## テスト

```bash
pip install -r backend/requirements.txt pytest
pytest backend/tests
```

## リソースの削除

```bash
cd infrastructure && npx cdk destroy
```

健康データを守るため、DynamoDB テーブル（`health-entries`）とログ保存用 S3 バケットは削除されずに残る。不要なら手動で削除する（テーブルを残したまま再デプロイすると、同名テーブルがあるためエラーになる）。

## 月額コスト目安

個人利用なら Lambda・API Gateway・DynamoDB・Cognito はほぼ無料枠に収まり、合計 **~$0〜数ドル/月**（主に Amplify Hosting）。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 構成図、ディレクトリ構成、DynamoDB 設計、API |
| [docs/deployment.md](docs/deployment.md) | PAT 作成、AWS SSO、独自ドメイン、SNS IdP、ユーザー管理 |
| [docs/data.md](docs/data.md) | CSV 形式、ダミー CSV 生成、既存データの移行 |
| [docs/logging.md](docs/logging.md) | ログ構造と CloudWatch Logs Insights の保存済みクエリ |

## ライセンス

[MIT License](LICENSE)
