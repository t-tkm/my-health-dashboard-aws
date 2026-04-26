# Services

## S-01: 認証サービス（AuthService）

- **Purpose**: ユーザーの認証状態管理と JWT トークン供給
- **Provider**: Amazon Cognito + AWS Amplify SDK
- **Responsibilities**:
  - Cognito Hosted UI（OAuth 2.0 Authorization Code Flow）の制御
  - ID Token（JWT）の発行・更新・失効管理
  - サインイン / サインアウト フローの提供
- **Interactions**:
  - フロントエンドの `Authenticator` が AuthService を通じてユーザー状態を取得
  - `DataAPIClient` が AuthService から JWT を取得して API リクエストに付与

---

## S-02: ヘルスデータ API サービス（HealthDataAPIService）

- **Purpose**: クライアントからの健康データ CRUD リクエストを受け付け、Lambda → DynamoDB への橋渡しを行う
- **Provider**: Amazon API Gateway（REST API）+ Cognito JWT Authorizer
- **Responsibilities**:
  - JWT 検証（Cognito Authorizer）
  - リクエストのルーティング（GET /api/data / POST /api/entry / DELETE /api/entry / GET /api/export / POST /api/import）
  - CORS プリフライトの処理
  - Lambda 関数の非同期呼び出し
- **Interactions**:
  - フロントエンドの `DataAPIClient` がこのサービスにリクエストを送信
  - `LambdaHandlers` がこのサービスからイベントを受け取る

---

## S-03: データ集計サービス（HealthDataComputeService）

- **Purpose**: DynamoDB のローデータから React 向け HealthData を生成する集計ロジック
- **Provider**: `backend/data_processor.py`（compute 関数）
- **Responsibilities**:
  - 体重欠損値の線形補間
  - 7日単純移動平均（SMA7）計算
  - 30日線形回帰による週次傾き（slope）計算
  - 各栄養素・目安値の集計
  - グラフ表示用サマリー統計の生成
- **Interactions**:
  - `LambdaHandlers` の data / entry ハンドラーが compute() を呼び出す
  - 出力 dict が API レスポンスとしてフロントエンドに返される

---

## S-04: CSV 変換サービス（CSVConversionService）

- **Purpose**: DynamoDB データと CSV ファイルの相互変換
- **Provider**: `backend/data_processor.py`（items_to_csv / import_csv_to_dynamo）
- **Responsibilities**:
  - エクスポート: DynamoDB items → UTF-8 BOM 付き CSV 文字列 → Base64 エンコード
  - インポート: CSV バイナリ → pandas DataFrame → Decimal 変換 → DynamoDB batch_writer
  - 日本語カラム名マッピング（_CSV_TO_DB 辞書）
  - 文字エンコーディング自動判定（UTF-8 / Shift-JIS）
- **Interactions**:
  - `export.handler` が items_to_csv を呼び出す
  - `import_csv.handler` が import_csv_to_dynamo を呼び出す

---

## S-05: インフラプロビジョニングサービス（InfraProvisioningService）

- **Purpose**: AWS リソースのライフサイクル管理
- **Provider**: AWS CDK（TypeScript）
- **Responsibilities**:
  - DynamoDB / Lambda / API Gateway / Cognito / Amplify のプロビジョニング
  - Amplify への VITE_* 環境変数の自動注入
  - GitHub PAT による Amplify-GitHub CI/CD 連携
  - Lambda の Docker バンドル（pandas/numpy C 拡張対応）
- **Interactions**:
  - 開発者が `cdk deploy` を実行してサービスをトリガー
  - デプロイ結果の Outputs（AmplifyAppUrl / ApiEndpoint 等）を後続設定に使用

---

## サービス相互作用図

```
[ユーザー]
    |
    v
[AuthService (Cognito)]
    |  JWT
    v
[HealthDataAPIService (API Gateway)]
    |
    +---> [HealthDataComputeService (compute)]
    |           |
    |           v
    +---> [DynamoDB: health-entries]
    |
    +---> [CSVConversionService (import/export)]
              |
              v
         [DynamoDB: health-entries]

[InfraProvisioningService (CDK)]
    |
    +---> [DynamoDB] [Lambda] [API GW] [Cognito] [Amplify]
```
