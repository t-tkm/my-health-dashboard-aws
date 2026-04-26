# Application Design（統合）

> 各詳細は個別ファイルを参照:
> - コンポーネント定義: [components.md](components.md)
> - メソッドシグネチャ: [component-methods.md](component-methods.md)
> - サービス設計: [services.md](services.md)
> - 依存関係: [component-dependency.md](component-dependency.md)

---

## システム構成サマリー

本システムは **React SPA + AWS Serverless** のフルスタック構成。
フロントエンド・バックエンド・インフラの 3 層で構成される。

```
+-----------------------------------------------------------+
|  フロントエンド（src/）                                    |
|                                                           |
|  Authenticator                                            |
|    └─ Dashboard                                           |
|         ├─ DataAPIClient (useHealthData / apiFetch)       |
|         ├─ ChartComponents (WeightChart / SlopeChart /    |
|         │   NutrientChart / StatCard / RangeFilter)       |
|         └─ EntryForm                                      |
+-------------------|-Auth JWT-|---HTTP-+-------------------+
                    v          v        v
+-----------------------------------------------------------+
|  AWS クラウド                                             |
|                                                           |
|  Cognito User Pool              API Gateway               |
|  (認証・JWT 発行)  <--検証--   (REST API / JWT Authorizer)|
|                                          |                |
|                               +----------+----------+     |
|                               v          v          v     |
|                          data.py   entry.py    export.py  |
|                          import.py                        |
|                               |    (LambdaHandlers)       |
|                               v                           |
|                      HealthDataProcessor                  |
|                      (data_processor.py)                  |
|                               |                           |
|                               v                           |
|                      DynamoDB: health-entries             |
|                      (PK: userId / SK: date)              |
|                                                           |
|  Amplify Hosting (CDN / SPA 配信)                        |
|  CDK InfraStack (全リソース管理)                          |
+-----------------------------------------------------------+
```

---

## コンポーネント一覧

| ID | 名前 | 層 | 種別 |
|---|---|---|---|
| C-01 | Authenticator | フロントエンド | 認証 |
| C-02 | Dashboard | フロントエンド | UI / オーケストレーター |
| C-03 | EntryForm | フロントエンド | UI / データ入力 |
| C-04 | ChartComponents | フロントエンド | UI / 表示 |
| C-05 | DataAPIClient | フロントエンド | API クライアント |
| C-06 | LambdaHandlers | バックエンド | API ハンドラー |
| C-07 | HealthDataProcessor | バックエンド | ビジネスロジック |
| C-08 | InfrastructureStack | インフラ | IaC |

---

## サービス一覧

| ID | 名前 | プロバイダー |
|---|---|---|
| S-01 | 認証サービス | Amazon Cognito + Amplify |
| S-02 | ヘルスデータ API サービス | API Gateway |
| S-03 | データ集計サービス | data_processor.compute() |
| S-04 | CSV 変換サービス | data_processor（items_to_csv / import_csv_to_dynamo）|
| S-05 | インフラプロビジョニングサービス | AWS CDK |

---

## 主要設計決定

| 決定 | 内容 | 理由 |
|---|---|---|
| 単一 CDK スタック | 全リソースを HealthDashboardStack 1 つで管理 | 個人利用規模では分割の複雑さより一元管理を優先 |
| Lambda ARM_64 | Python 3.12 ARM_64 を採用 | Apple Silicon 開発環境との ABI 整合性。Docker ビルドの複雑さを回避 |
| DynamoDB 単一テーブル | userId(PK) + date(SK) | シンプルなアクセスパターンに最適。GSI 不要 |
| 2ステップデプロイ | Amplify URL → Cognito callbackUrls を2回に分けて設定 | Amplify URL が CDK デプロイ前不明なため循環依存を回避 |
| セルフサインアップ無効 | selfSignUpEnabled: false | 個人利用のためアクセス制御を管理者に限定 |
| pandas 依存 | compute() が pandas / numpy に依存 | 線形回帰・移動平均の計算に便利。Docker ビルド必須のトレードオフあり |
