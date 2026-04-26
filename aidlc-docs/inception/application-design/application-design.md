# Application Design（統合）

詳細は各ファイルを参照:
- [components.md](components.md) — C-01〜C-08 コンポーネント定義・責務
- [component-methods.md](component-methods.md) — メソッドシグネチャ
- [services.md](services.md) — S-01〜S-05 サービス設計
- [component-dependency.md](component-dependency.md) — 依存関係・データフロー

---

## システム構成サマリー

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
|                          import.py (LambdaHandlers)       |
|                               |                           |
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

## 主要設計決定

| 決定 | 内容 | 理由 |
|---|---|---|
| 単一 CDK スタック | 全リソースを HealthDashboardStack 1 つで管理 | 個人利用規模では分割の複雑さより一元管理を優先 |
| Lambda ARM_64 | Python 3.12 ARM_64 を採用 | Apple Silicon 開発環境との ABI 整合性。Docker ビルドの複雑さを回避 |
| DynamoDB 単一テーブル | userId(PK) + date(SK) | シンプルなアクセスパターンに最適。GSI 不要 |
| 2ステップデプロイ | Amplify URL → Cognito callbackUrls を2回に分けて設定 | Amplify URL が CDK デプロイ前不明なため循環依存を回避 |
| セルフサインアップ無効 | selfSignUpEnabled: false | 個人利用のためアクセス制御を管理者に限定 |
| pandas 依存 | compute() が pandas / numpy に依存 | 線形回帰・移動平均の計算に便利。Docker ビルド必須のトレードオフあり |
