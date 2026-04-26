# Components

## コンポーネント一覧

### C-01: Authenticator
- **Purpose**: Cognito 認証フローの管理。未認証ユーザーを Cognito Hosted UI にリダイレクトし、認証済みユーザーにのみ Dashboard を表示する
- **Responsibilities**:
  - Cognito Hosted UI（OAuth 2.0 Authorization Code Flow）の制御
  - Amplify UI の `<Authenticator>` ラップによる認証状態管理
  - JWT（ID Token）の取得と保持（fetchAuthSession）
  - サインアウト（signOut）の提供
- **Interfaces**: `user`, `signOut` を Dashboard コンポーネントに提供
- **Location**: `src/App.tsx`, `src/main.tsx`, `src/aws-config.ts`

---

### C-02: Dashboard
- **Purpose**: ダッシュボードのルートコンポーネント。データ取得・フィルタリング・表示コンポーネントへのデータ配布を担う
- **Responsibilities**:
  - useHealthData フックによる API データ取得とローディング/エラー状態管理
  - 期間フィルター（RangeDays）の状態管理
  - filterData による表示データの絞り込み
  - EntryForm モーダルの表示制御
  - CSV インポート処理の実行
- **Interfaces**: ChartComponents / StatCard / EntryForm / RangeFilter に filtered HealthData を渡す
- **Location**: `src/App.tsx`（Dashboard function）

---

### C-03: EntryForm
- **Purpose**: 体重・食事データの入力・編集・削除を行うモーダルフォーム
- **Responsibilities**:
  - 日付・体重・栄養素・目安値の入力フォーム管理
  - POST /api/entry による新規登録・更新
  - DELETE /api/entry による削除
  - 操作後の Dashboard リフレッシュトリガー
- **Location**: `src/components/EntryForm.tsx`

---

### C-04: ChartComponents（グラフコンポーネント群）
- **Purpose**: 健康データを Recharts で可視化する表示専用コンポーネント群
- **Responsibilities**:
  - WeightChart: 体重推移折れ線グラフ（日次体重 + 7日SMA + Brush）
  - SlopeChart: 週次増減ペース棒グラフ（線形回帰傾き）
  - NutrientChart: 栄養素棒グラフ（目安ライン付き）
  - StatCard: サマリーカード（最新体重 / 平均カロリー / 記録日数）
  - RangeFilter: 期間切り替えボタン群
  - EmptyState: データなし・エラー状態の表示
- **Location**: `src/components/`

---

### C-05: DataAPIClient
- **Purpose**: バックエンド API との通信を担うクライアントレイヤー
- **Responsibilities**:
  - Cognito ID Token の取得（fetchAuthSession）
  - Authorization ヘッダー付き fetch の実行（apiFetch）
  - useHealthData フックによるデータ取得状態管理（loading / error / data / isEmpty）
  - refresh() による再フェッチトリガー
- **Location**: `src/hooks/useHealthData.ts`, `src/utils/filterData.ts`, `src/utils/dateFormat.ts`

---

### C-06: LambdaHandlers（バックエンド API ハンドラー）
- **Purpose**: API Gateway からのリクエストを受け、DynamoDB との CRUD を実行するサーバーレス関数群
- **Responsibilities**:
  - data.py: GET /api/data — 全レコード取得 + compute()
  - entry.py: POST/DELETE /api/entry — レコード追加/更新/削除 + compute()
  - export.py: GET /api/export — CSV 生成 + Base64 エンコード
  - import_csv.py: POST /api/import — CSV パース + 一括インポート
  - common.py: CORS ヘッダー / 認証ユーティリティ（get_user_id / get_origin）
- **Location**: `backend/lambda/`, `backend/common.py`

---

### C-07: HealthDataProcessor
- **Purpose**: DynamoDB のデータ CRUD と React 向け集計ロジックを提供するバックエンドコアライブラリ
- **Responsibilities**:
  - load_items: DynamoDB Query（ページネーション対応）
  - put_entry: PutItem（目安値の自動引き継ぎロジック含む）
  - delete_entry: DeleteItem
  - compute: HealthData dict 生成（SMA / 線形回帰 / 欠損値補間）
  - items_to_csv: CSV 文字列生成（UTF-8 BOM付き）
  - import_csv_to_dynamo: CSV 一括インポート（Shift-JIS / UTF-8 両対応）
- **Location**: `backend/data_processor.py`

---

### C-08: InfrastructureStack
- **Purpose**: AWS CDK による全インフラリソースの定義・管理
- **Responsibilities**:
  - DynamoDB テーブル（health-entries）定義
  - Lambda 関数 × 4 定義（Docker バンドル含む）
  - API Gateway 定義（Cognito Authorizer / CORS）
  - Cognito User Pool / Domain / Client 定義
  - Amplify Hosting 定義（GitHub 連携 / 環境変数注入）
- **Location**: `infrastructure/lib/stack.ts`, `infrastructure/bin/app.ts`
