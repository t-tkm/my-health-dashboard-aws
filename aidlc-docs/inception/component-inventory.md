# Component Inventory

## Application Packages

| パッケージ | 言語/フレームワーク | 目的 |
|---|---|---|
| `src/` | React 18 + TypeScript | フロントエンド SPA（ダッシュボード UI）|
| `backend/` | Python 3.12 | Lambda バックエンド（ビジネスロジック + DynamoDB アクセス）|

## Infrastructure Packages

| パッケージ | IaC ツール | 目的 |
|---|---|---|
| `infrastructure/` | AWS CDK (TypeScript) | 全 AWS リソース定義（DynamoDB / Lambda / API GW / Cognito / Amplify）|

## Shared Packages

| パッケージ | 種別 | 目的 |
|---|---|---|
| `backend/common.py` | ユーティリティ | CORS ヘッダー・認証ユーティリティ（Lambda 共通）|
| `backend/data_processor.py` | ロジック | DynamoDB CRUD + データ集計（全 Lambda ハンドラーから参照）|
| `src/types.ts` | 型定義 | HealthData TypeScript インターフェース |
| `src/aws-config.ts` | 設定 | Amplify / Cognito / API エンドポイント設定 |

## Test Packages

現在テストパッケージは存在しない（未整備）。

## Utility Packages

| パッケージ | 目的 |
|---|---|
| `scripts/generate_dummy.py` | DynamoDB Local にダミーデータ投入（開発用）|
| `scripts/generate_dummy_csv.py` | Web UI インポート用ダミー CSV 生成 |
| `scripts/migrate_csv_to_dynamodb.py` | 旧 CSV データから DynamoDB への移行ツール |

## AWS サービスインベントリ

| サービス | リソース名 | 設定 |
|---|---|---|
| Amazon DynamoDB | `health-entries` | PAY_PER_REQUEST / PK: userId / SK: date / removalPolicy: DESTROY |
| AWS Lambda | `health-dashboard-data` | Python 3.12 / ARM_64 / 30s timeout |
| AWS Lambda | `health-dashboard-entry` | Python 3.12 / ARM_64 / 30s timeout |
| AWS Lambda | `health-dashboard-export` | Python 3.12 / ARM_64 / 30s timeout |
| AWS Lambda | `health-dashboard-importcsv` | Python 3.12 / ARM_64 / 30s timeout |
| Amazon API Gateway | `health-dashboard-api` | REST API / Cognito JWT Authorizer / CORS: * |
| Amazon Cognito | `health-dashboard-users` | email サインイン / selfSignUpEnabled: false / removalPolicy: DESTROY |
| Cognito Domain | `health-dashboard-{accountId}` | Hosted UI ドメイン |
| AWS Amplify Hosting | `health-dashboard` | GitHub 連携 / 自動ビルド / SPA リライトルール |

## Total Count

- **Total Packages**: 3（Application: 2 + Infrastructure: 1）
- **Application**: 2（フロントエンド src/ + バックエンド backend/）
- **Infrastructure**: 1（infrastructure/）
- **Shared**: 2 ファイル（common.py + data_processor.py）
- **Test**: 0
- **AWS Lambda Functions**: 4
- **Source Files**: 約 30
