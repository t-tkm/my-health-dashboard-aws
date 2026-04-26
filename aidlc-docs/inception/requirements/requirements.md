# Requirements

## Intent Analysis

- **User Request**: 既存プロジェクトを AI-DLC に準拠した形でリバースエンジニアリングし、今後の保守を見据えたドキュメント一式を整備する
- **Request Type**: Brownfield ドキュメント整備（既存システムの可視化 + 保守基盤構築）
- **Scope Estimate**: System-wide（フロントエンド / バックエンド / インフラ / 認証 全層）
- **Complexity Estimate**: Moderate（既存コード明確 / アーキテクチャ確立済み / テスト不足が課題）

---

## Functional Requirements

### FR-01: ユーザー認証
- Amazon Cognito User Pool によるメール/パスワード認証を提供する
- セルフサインアップは無効。管理者がユーザーを作成する
- SNS IdP（Google / Apple / Facebook / Amazon）はオプション設定で有効化可能
- 未認証ユーザーはダッシュボードにアクセスできない（Authenticator ラップ）
- ログアウト機能を提供する

### FR-02: 健康データ表示
- ログイン後、全期間の体重・食事データをダッシュボードに表示する
- 体重推移グラフ（日次体重 + 7日SMA）を表示する
- 体重増減ペース（直近30日線形回帰による週次変化量）を表示する
- 栄養素グラフ（カロリー / タンパク質 / 脂質 / 炭水化物 / 糖質 / 食物繊維 / 塩分）を目安ライン付きで表示する
- サマリーカード（最新体重 / 平均カロリー / 表示期間日数）を表示する

### FR-03: 期間フィルター
- 30日 / 90日 / 半年（180日）/ 1年（365日）/ 全期間 の5種類から表示期間を選択できる
- 選択した期間に応じてグラフ・サマリーが連動して更新される

### FR-04: データ入力・編集・削除
- Web UI のモーダルフォームから日付単位で体重・栄養素・目安値を入力できる
- 既存データの編集（同一日付への上書き）ができる
- 指定日のデータを削除できる
- 目安値（cal_target 等）は前日の値を自動引き継ぎする

### FR-05: CSV エクスポート
- 全データを UTF-8 BOM 付き CSV としてダウンロードできる
- ファイル名は `health_data.csv`
- カラム: date, weight, calories, protein_g, fat_g, carb_g, sugar_g, fiber_g, salt_g, および各目安値

### FR-06: CSV インポート
- 日本語カラム名の CSV ファイルを一括インポートできる
- エンコーディングは UTF-8（BOM あり/なし）または Shift-JIS に対応する
- 日付フォーマット `YYYY/M/D` を `YYYY-MM-DD` に自動変換する
- インポート後にダッシュボードを自動リフレッシュする

### FR-07: レスポンシブ対応
- PC・スマートフォン（600px ブレークポイント）でレイアウトが切り替わる
- モバイルではグラフの高さを縮小して表示する

---

## Non-Functional Requirements

### NFR-01: 認証・セキュリティ
- 全 API エンドポイントを Cognito JWT Authorizer で保護する
- userId は Cognito sub（UUID）とし、ユーザー間のデータを完全に分離する
- シークレット・認証情報はリポジトリにコミットしない（.env.local は .gitignore）

### NFR-02: パフォーマンス
- Lambda タイムアウト 30 秒以内でレスポンスを返す
- 個人利用規模（数千レコード）では pandas の計算時間は問題ない

### NFR-03: コスト
- 個人利用（小規模）において月額コストをほぼ $0 に抑える
  - DynamoDB: PAY_PER_REQUEST（25GB / 25WCU / 25RCU 永続無料枠内）
  - Lambda / API Gateway: 無料枠内
  - Cognito: MAU 50,000 まで無料
  - Amplify Hosting: ~$0–1

### NFR-04: 可用性・スケーラビリティ
- AWS マネージドサービスの SLA に依存（Lambda / DynamoDB / Amplify）
- 個人利用のため高可用性設計は不要

### NFR-05: 保守性
- 全インフラを AWS CDK（TypeScript）で IaC 管理し再現性を確保する
- GitHub push で Amplify Hosting が自動ビルド・デプロイする
- AI-DLC ドキュメントをリポジトリで管理し、変更追跡を可能にする

### NFR-06: データ保護（課題）
- DynamoDB の `removalPolicy: DESTROY` は誤削除リスクあり（技術的負債として記録）
- 本番環境移行時は `RETAIN` への変更を検討する

---

## Technical Constraints

- **ランタイム**: Lambda は Python 3.12 ARM_64 固定（Apple Silicon との ABI 整合性確保）
- **デプロイ**: フロントエンドは Amplify Hosting（GitHub 連携必須・PAT が必要）
- **ローカル開発**: フロントエンドは実 API Gateway に接続（CDK デプロイ後に .env.local 設定が必要）
- **ビルド**: pandas/numpy の C 拡張により CDK デプロイ時 Docker ビルドが必要
- **2ステップデプロイ**: Amplify URL が Cognito callbackUrls に必要なため循環依存を回避する手順が必要

---

## Success Criteria

- 認証されたユーザーが日々の体重・食事データを記録・閲覧できる
- 体重トレンド（SMA / 傾き）が正確にグラフ表示される
- CSV インポート/エクスポートが正常に動作する
- AWS コストが個人利用規模でほぼ $0 に収まる
- AI-DLC ドキュメントが整備され、将来の保守・機能追加の基盤となる
