# Component Dependency

## 依存関係マトリクス

| 依存元 \ 依存先 | Authenticator | Dashboard | EntryForm | ChartComponents | DataAPIClient | LambdaHandlers | HealthDataProcessor | InfraStack |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Authenticator | — | 提供 | — | — | — | — | — | — |
| Dashboard | 利用 | — | 利用 | 利用 | 利用 | — | — | — |
| EntryForm | — | — | — | — | 利用 | — | — | — |
| ChartComponents | — | — | — | — | — | — | — | — |
| DataAPIClient | 利用(JWT) | — | — | — | — | HTTP | — | — |
| LambdaHandlers | — | — | — | — | — | — | 利用 | — |
| HealthDataProcessor | — | — | — | — | — | — | — | — |
| InfraStack | — | — | — | — | — | デプロイ | デプロイ | — |

## コンポーネント依存グラフ

```
フロントエンド（ブラウザ）:

  Authenticator
      |
      | signOut / user
      v
  Dashboard
      |
      +---> DataAPIClient (useHealthData, apiFetch)
      |         |
      |         | JWT (Cognito)
      |         | HTTP
      |         +----> API Gateway --> LambdaHandlers
      |                                    |
      |                                    v
      |                             HealthDataProcessor
      |                                    |
      |                                    v
      |                                DynamoDB
      |
      +---> EntryForm --> DataAPIClient
      |
      +---> ChartComponents (StatCard / WeightChart / SlopeChart / NutrientChart)
      |
      +---> RangeFilter

インフラ（CDK）:
  InfraStack
      |
      +---> DynamoDB / Lambda / API Gateway / Cognito / Amplify Hosting
```

## 通信パターン

| 通信 | プロトコル | 認証 | 方向 |
|---|---|---|---|
| ブラウザ ↔ Amplify Hosting | HTTPS | なし（CDN）| 双方向 |
| ブラウザ ↔ Cognito Hosted UI | HTTPS / OAuth 2.0 | OAuth | 双方向 |
| DataAPIClient → API Gateway | HTTPS + JWT | Cognito JWT Authorizer | 単方向 |
| API Gateway → Lambda | AWS 内部呼び出し | IAM | 単方向 |
| Lambda → DynamoDB | AWS SDK (boto3) | IAM Role | 双方向 |
| CDK → AWS | AWS API | IAM | 単方向 |

## データフロー（読み取り）

```
useHealthData()
  --[GET /api/data + JWT]--> API Gateway
  --> Cognito Authorizer (JWT検証 → claims.sub)
  --> data.handler (event.requestContext.authorizer.claims.sub)
  --> load_items(user_id) --> DynamoDB.query(userId=sub)
  --> compute(items) --> HealthData dict
  --> JSON Response
  --> filterData(data, range)
  --> ChartComponents / StatCard
```

## データフロー（書き込み）

```
EntryForm.onSave()
  --[POST /api/entry + JWT + body]--> API Gateway
  --> Cognito Authorizer
  --> entry.handler
  --> put_entry(user_id, date, weight, nutrition, targets)
    --> DynamoDB.get_item (既存値取得)
    --> DynamoDB.put_item (upsert)
  --> load_items() + compute()
  --> HealthData dict (更新後)
  --> Dashboard.refresh()
```

## 結合度の評価

| コンポーネント間 | 結合度 | 備考 |
|---|---|---|
| Dashboard ↔ DataAPIClient | 密 | HealthData 型で直結 |
| DataAPIClient ↔ API Gateway | 疎 | HTTP/JSON インターフェース |
| LambdaHandlers ↔ HealthDataProcessor | 密 | Python import で直結 |
| LambdaHandlers ↔ common.py | 密 | Python import で直結 |
| InfraStack ↔ アプリケーションコード | 疎 | デプロイ時のみ結合 |
