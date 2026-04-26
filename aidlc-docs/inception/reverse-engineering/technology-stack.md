# Technology Stack

## Programming Languages

| 言語 | バージョン | 用途 |
|---|---|---|
| TypeScript | ^5.6.3 | フロントエンド SPA + CDK インフラ定義 |
| Python | 3.12 | Lambda バックエンド（全ハンドラー + data_processor）|

## Frameworks

| フレームワーク | バージョン | 目的 |
|---|---|---|
| React | ^18.3.1 | フロントエンド UI フレームワーク |
| Vite | ^6.0.1 | フロントエンドビルドツール + 開発サーバー |
| AWS CDK | aws-cdk-lib (latest) | IaC フレームワーク |
| Recharts | ^2.13.3 | React グラフライブラリ（体重・栄養素チャート）|
| aws-amplify | ^6.14 | Cognito 認証クライアント + API フェッチ |
| @aws-amplify/ui-react | ^6.6 | Amplify UI コンポーネント（Authenticator）|
| pandas | >=2.2 | CSV パース・データフレーム処理（Lambda）|
| numpy | >=2.0 | 数値計算・線形回帰（Lambda）|
| boto3 | >=1.35 | AWS SDK for Python（DynamoDB アクセス）|

## Infrastructure (AWS)

| サービス | 目的 |
|---|---|
| AWS Amplify Hosting | React SPA の CDN 配信 + CI/CD（GitHub 連携）|
| Amazon API Gateway | REST API エンドポイント管理・JWT 認証・CORS |
| AWS Lambda (ARM_64) | サーバーレスバックエンド（Python 3.12）|
| Amazon DynamoDB | NoSQL データストア（PAY_PER_REQUEST）|
| Amazon Cognito | ユーザー認証・JWT 発行・SNS IdP 連携 |

## Build Tools

| ツール | バージョン | 目的 |
|---|---|---|
| Vite | ^6.0.1 | フロントエンドバンドル・開発サーバー |
| TypeScript Compiler (tsc) | ^5.6.3 | TypeScript コンパイル |
| AWS CDK CLI | (latest) | CDK デプロイ・スタック管理 |
| Docker | — | Lambda 依存ライブラリのビルド（SAM イメージ: `public.ecr.aws/sam/build-python3.12`）|
| pip | — | Python 依存ライブラリインストール |

## Testing Tools

| ツール | バージョン | 目的 |
|---|---|---|
| DynamoDB Local | — | ローカル開発用 DynamoDB エミュレーター（Docker）|
| dynamodb-admin | — | DynamoDB Local の GUI ブラウザ（Docker）|

テスト自動化ツール（Jest, pytest 等）は現時点で未導入。

## Local Development Environment

| ツール | バージョン | 目的 |
|---|---|---|
| Docker / Docker Compose | — | DynamoDB Local 起動 |
| Node.js | (latest LTS) | フロントエンド + CDK 開発 |
| Python | 3.12 | バックエンドスクリプト実行 |
| pyenv / .python-version | 3.12 | Python バージョン管理 |
| AWS CLI | (latest) | AWS 認証・CDK bootstrap |

## CI/CD

| ツール | 目的 |
|---|---|
| AWS Amplify Hosting | フロントエンドの自動ビルド＆デプロイ（GitHub push トリガー）|
| AWS CDK | インフラ変更の手動デプロイ（`cdk deploy`）|
