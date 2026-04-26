# System Architecture

## System Overview

個人用健康管理ダッシュボード（AWS 版）。React SPA + AWS Serverless のフルスタック構成。AWS Amplify Hosting で SPA を配信し、Amazon API Gateway + AWS Lambda でバックエンド API を提供。データは Amazon DynamoDB に永続化。認証は Amazon Cognito User Pool で管理し、API Gateway に Cognito JWT Authorizer を配置してエンドポイントを保護する。全インフラは AWS CDK（TypeScript）で IaC 管理。

## Architecture Diagram

```mermaid
graph TB
    subgraph Client["クライアント層"]
        Browser["ブラウザ\nReact SPA"]
    end

    subgraph Hosting["ホスティング"]
        AmplifyHosting["AWS Amplify Hosting\n(CDN / SPA配信)"]
    end

    subgraph Auth["認証"]
        Cognito["Amazon Cognito\nUser Pool\n(health-dashboard-users)"]
        CognDomain["Cognito Hosted UI\nhealth-dashboard-{accountId}.auth.{region}.amazoncognito.com"]
    end

    subgraph API["API層"]
        APIGW["Amazon API Gateway\nREST API\n(health-dashboard-api)"]
        CognitoAuth["Cognito\nJWT Authorizer"]
    end

    subgraph Compute["コンピュート層 (Lambda Python 3.12 ARM64)"]
        LambdaData["health-dashboard-data\nGET /api/data"]
        LambdaEntry["health-dashboard-entry\nPOST/DELETE /api/entry"]
        LambdaExport["health-dashboard-export\nGET /api/export"]
        LambdaImport["health-dashboard-importcsv\nPOST /api/import"]
    end

    subgraph Data["データ層"]
        DynamoDB["Amazon DynamoDB\nhealth-entries\nPK: userId / SK: date"]
    end

    subgraph IaC["IaC"]
        CDK["AWS CDK (TypeScript)\nHealthDashboardStack"]
    end

    Browser -->|"HTTPS (SPA取得)"| AmplifyHosting
    Browser -->|"OAuth フロー"| CognDomain
    CognDomain --> Cognito
    Browser -->|"HTTPS + Authorization: JWT"| APIGW
    APIGW --> CognitoAuth
    CognitoAuth --> Cognito
    APIGW --> LambdaData
    APIGW --> LambdaEntry
    APIGW --> LambdaExport
    APIGW --> LambdaImport
    LambdaData --> DynamoDB
    LambdaEntry --> DynamoDB
    LambdaExport --> DynamoDB
    LambdaImport --> DynamoDB
    CDK -.->|"プロビジョニング"| AmplifyHosting
    CDK -.->|"プロビジョニング"| Cognito
    CDK -.->|"プロビジョニング"| APIGW
    CDK -.->|"プロビジョニング"| DynamoDB
```

Text Alternative:
```
[ブラウザ] --HTTPS SPA取得--> [Amplify Hosting]
[ブラウザ] --OAuth フロー--> [Cognito Hosted UI] --> [Cognito User Pool]
[ブラウザ] --HTTPS + JWT--> [API Gateway]
[API Gateway] --JWT検証--> [Cognito Authorizer] --> [Cognito]
[API Gateway] --> [Lambda: data / entry / export / import]
[Lambda x4] --> [DynamoDB: health-entries]
[CDK] --プロビジョニング--> [全AWSリソース]
```

## Component Descriptions

### src/ — React SPA フロントエンド
- **Purpose**: ユーザーインターフェース。Cognito 認証・データ入力・グラフ可視化・CSV 操作を提供。
- **Responsibilities**: Amplify UI Authenticator による認証フロー、JWT 付き API リクエスト、HealthData フィルタリング、Recharts グラフレンダリング。
- **Dependencies**: AWS Amplify (aws-amplify, @aws-amplify/ui-react), React 18, Recharts。
- **Type**: Application

### backend/ — Lambda バックエンド
- **Purpose**: API ビジネスロジック。DynamoDB CRUD・データ集計・CSV 変換を提供。
- **Responsibilities**: ユーザー認証（JWT sub 抽出）、DynamoDB の読み書き、compute() による HealthData 生成、CSV エクスポート/インポート。
- **Dependencies**: boto3, pandas, numpy。Lambda ランタイム: Python 3.12 ARM_64。
- **Type**: Application

### infrastructure/ — AWS CDK スタック
- **Purpose**: 全 AWS リソースの IaC 定義。
- **Responsibilities**: DynamoDB / Lambda / API Gateway / Cognito / Amplify Hosting のプロビジョニング。Amplify への環境変数注入。GitHub PAT による Amplify-GitHub 連携。
- **Dependencies**: aws-cdk-lib, constructs。
- **Type**: Infrastructure

### scripts/ — 運用補助スクリプト
- **Purpose**: 開発・データ移行用スクリプト群。
- **Responsibilities**: DynamoDB Local へのダミーデータ投入、CSV ダミーデータ生成、旧 CSV からの DynamoDB 移行。
- **Dependencies**: boto3, pandas, numpy。
- **Type**: Utility

## Data Flow

### 認証フロー

```mermaid
sequenceDiagram
    participant Browser as ブラウザ (React)
    participant Cognito as Cognito Hosted UI
    participant App as Amplify Authenticator
    participant API as API Gateway

    Browser->>App: アクセス
    App->>Cognito: 未認証 → OAuth リダイレクト
    Cognito-->>Browser: 認証完了 + JWT発行
    Browser->>App: fetchAuthSession() → ID Token取得
    App->>API: Authorization: <JWT>
    API->>Cognito: JWT検証
    Cognito-->>API: claims.sub (userId)
    API-->>Browser: HealthData JSON
```

### データ取得フロー

```mermaid
sequenceDiagram
    participant Hook as useHealthData()
    participant API as API Gateway
    participant Lambda as data.py
    participant DB as DynamoDB

    Hook->>API: GET /api/data (Authorization: JWT)
    API->>Lambda: invoke (event.requestContext.authorizer.claims.sub)
    Lambda->>DB: Query(userId, ScanIndexForward=True)
    DB-->>Lambda: items[]
    Lambda->>Lambda: compute(items) → HealthData dict
    Lambda-->>API: 200 OK + HealthData JSON
    API-->>Hook: HealthData
    Hook->>Hook: filterData(data, range) → filtered
```

## Integration Points

- **External APIs**: なし（外部 API との直接統合なし）
- **Databases**: Amazon DynamoDB (`health-entries` テーブル、オンデマンドキャパシティ)
- **Third-party Services**:
  - GitHub（Amplify Hosting の CI/CD ソース。PAT で連携）
  - Google / Apple / Facebook / Amazon（SNS IdP。現在コメントアウト、設定時に有効化）

## Infrastructure Components

- **CDK Stacks**: `HealthDashboardStack` — 全リソースを単一スタックで管理
- **Deployment Model**: AWS Amplify Hosting（SPA）+ Serverless（Lambda + API Gateway）。GitHub push で自動ビルド＆デプロイ。
- **Networking**: VPC なし（全リソースがマネージドサービス）。CORS は API Gateway で allowOrigins: * に設定。
