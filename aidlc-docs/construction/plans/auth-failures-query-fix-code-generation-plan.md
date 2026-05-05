# Code Generation Plan: auth-failures クエリ修正

**Unit**: auth-failures-query-fix  
**Issue**: #13  
**Type**: Brownfield バグ修正

---

## Unit Context

- **問題**: `health-dashboard/auth-failures` CloudWatch Logs Insights クエリが認証失敗のみでなく全試行を返している
- **原因**: Cognito PreAuth トリガーは成功・失敗問わず発火するため、`type = "login_attempt"` だけでは絞り込めない
- **対象ファイル**: `infrastructure/lib/stack.ts`

---

## Step 1: 既存コードの確認
- [x] `infrastructure/lib/stack.ts` の `QueryAuthFailures` 定義を確認（lines 313-322）
- [x] `backend/lambda/auth_pre.py` / `auth_post.py` のログ出力フィールドを確認

## Step 2: コード修正
- [x] `logs.QueryDefinition` → `logs.CfnQueryDefinition` に変更
- [x] 対象ロググループを PreAuth のみ → PreAuth + PostAuth 両方に変更
- [x] クエリを `sum(if(...))` 集計ベース（5分窓）に変更し、試行あり・成功なしのみ抽出（`count_if` は未サポートのため `sum(if(...,1,0))` で代替）

## Step 3: ドキュメント更新
- [x] `README.md` — 付録の保存済みクエリ一覧の auth-failures 行を更新
- [x] `aidlc-docs/audit.md` — 作業ログ追記
- [x] `aidlc-docs/aidlc-state.md` — ステージ進捗更新
- [x] `aidlc-docs/construction/plans/auth-failures-query-fix-code-generation-plan.md` — 本ファイル作成

## Step 4: ビルド確認
- [x] `cd infrastructure && npx cdk synth` でコンパイルエラーがないことを確認
