# AI-DLC Audit Log

## Code Generation — CSV エクスポートのファイル名に日付・連番付与（#36）
**Timestamp**: 2026-07-07T00:10:00Z
**User Input**: "localStorage (Recommended)"
**AI Response**: 連番の永続化方式について localStorage 案でユーザー承認。`src/utils/exportFilename.ts` を新規追加し、`nextCsvExportFilename()` が `YYYYMMDD_health_data.csv` 形式のファイル名を生成。同日内の再エクスポート時は localStorage（キー: `csvExportHistory`）に保存した日付・回数を参照し `_1`, `_2`... を付与。`src/App.tsx` の `handleCsvExport` から利用するよう変更。`npm run build` で型チェック・ビルド成功を確認し、連番ロジックは Node スクリプトでのモック検証（`20260618_health_data.csv` → `_1` → `_2`）で仕様通りの出力を確認。
**Context**: Code Generation — フロントエンドのみの変更、インフラ変更なし。ブランチ `feat/csv-export-date-filename`

---

## Requirements Analysis — CSV エクスポートのファイル名に日付・連番付与（#36）
**Timestamp**: 2026-07-07T00:00:00Z
**User Input**: "#36を対応。pr作成まで。"
**AI Response**: GitHub Issue #36 の内容（`health_data.csv` → `20260618_health_data.csv` 形式、同日再エクスポート時は `_1`, `_2`... を連番付与、ブラウザの自動リネームに依存せずエクスポート処理側で制御）を確認。要件は明確なため minimal depth で対応。実装計画（`src/utils/exportFilename.ts` 新規追加、`App.tsx` 修正、ブランチ作成、ビルド確認、PR作成）をチャットで提示し承認を得た上で、連番の永続化方式（localStorage）について確認質問を実施。
**Context**: Requirements Analysis — 小規模・単一コンポーネント内の変更のため User Stories / Application Design / Units Generation は SKIP（#13 と同様の軽量パス）

---

## Rename: health-dashboard 全クエリ名見直し（#fix/auth-failures-query）
**Timestamp**: 2026-05-05T03:00:00Z
**User Input**: "health-dashboard全体見直し。重複などないか？命名はユーザに誤解を与えないか？" → "yes"
**AI Response**: 6 クエリを以下の通りリネーム。重複 CDK construct ID `QueryAuthAttempts` を修正（`QueryAuthEvents` / `QueryAuthAttemptStats` に分離）。README 保存済みクエリ表も更新。cdk synth 正常完了。
- `api-access-summary` → `api-access`
- `lambda-access-log` → `lambda-access`
- `lambda-errors` → 変更なし
- `auth-all-attempts` → `auth-events`（construct ID: `QueryAuthAttempts` → `QueryAuthEvents`）
- `auth-attempts` → `auth-attempt-stats`（construct ID: 重複 `QueryAuthAttempts` → `QueryAuthAttemptStats`）
- `auth-successes` → 変更なし
**Context**: リネーム — infrastructure/lib/stack.ts, README.md

---

## Rename: auth-failures → auth-attempts（#13）
**Timestamp**: 2026-05-05T02:00:00Z
**User Input**: "auth-attemptsで"
**AI Response**: クエリ名 `health-dashboard/auth-failures` → `health-dashboard/auth-attempts` に変更。CDK 構築 ID も `QueryAuthFailures` → `QueryAuthAttempts` に更新。README 更新。
**Context**: リネーム — infrastructure/lib/stack.ts, README.md

---

## Fix: auth-failures クエリを動作する実装に修正（#13）
**Timestamp**: 2026-05-05T01:30:00Z
**User Input**: "A"
**AI Response**: CloudWatch Logs Insights の制約（`count_if`/`sum(if(...))`/`min(string)` 未サポート）を調査・確認後、`stats count(*) by username, @log, bin(5m)` + `filter @log like "preauth"` アプローチで動作確認。README も実態に合わせて更新。
**Context**: バグ修正 — infrastructure/lib/stack.ts, README.md

---

## Fix: auth-failures クエリを認証失敗のみ返すよう修正（#13）
**Timestamp**: 2026-05-05T00:00:00Z
**User Input**: "#13対応"
**AI Response**: `QueryAuthFailures` を `logs.QueryDefinition` から `logs.CfnQueryDefinition` に変更。対象ロググループを PreAuth のみ → PreAuth + PostAuth 両方に拡張し、`count_if` による 5 分窓集計で認証失敗（試行あり・成功なし）のみを抽出するクエリに修正。README の保存済みクエリ一覧も更新。
**Context**: バグ修正 — infrastructure/lib/stack.ts, README.md

---

## Documentation Update — カスタムドメイン実デプロイ検証・ドキュメント整合
**Timestamp**: 2026-05-04T11:30:00Z
**User Input**: "using ai-dlc, ドキュメント一式、README含め整合させて更新しておく。"
**AI Response**: カスタムドメイン実デプロイで判明した知見（CfnDomain race condition 修正、CNAME 削除→再試行フロー、Amplify 新コンソールの表示挙動）を README・aidlc-state.md に反映。
**Context**: ドキュメント整備 — 実デプロイ検証結果の反映

---

## CDK Redeploy — カスタムドメイン動作検証（cdk destroy + cdk deploy）
**Timestamp**: 2026-05-04T11:00:00Z
**User Input**: "cdk destory後、cdk deployするとエラー: AmplifyCustomDomain は CREATE_FAILED"
**AI Response**: CfnDomain が CfnBranch より先に作成される race condition を発見。`cfnDomain.addDependency(mainBranch)` を追加して修正。修正後の再デプロイで CREATE_COMPLETE を確認。
**Context**: バグ修正 — CfnDomain 依存関係エラー（infrastructure/lib/stack.ts）

## CDK Redeploy — SSL設定失敗・CloudFront 競合
**Timestamp**: 2026-05-04T11:15:00Z
**User Input**: "同じエラーです: DNS record that points to another CloudFront distribution"
**AI Response**: cdk destroy で旧アプリの CloudFront (<OLD_CF_DISTRIBUTION_ID>) が削除され、再デプロイで新 CloudFront (<CF_DISTRIBUTION_ID>) が割り当てられたが、Route53 CNAME は旧値のまま。別アカウントの Route53 で旧 CNAME 削除 → Amplify 再試行 → SSL 成功。新 CloudFront エンドポイントを Route53 に再設定。
**Context**: 運用手順 — 再デプロイ時の CNAME 競合解消手順

---

## Build and Test Stage — Custom Domain
**Timestamp**: 2026-04-29T00:10:00Z
**Build Status**: cdk synth 正常完了（TypeScript エラーなし）
**Test Status**: 手動検証ステップあり（統合テストは実デプロイ後）
**Files Generated**:
- build-instructions.md
- unit-test-instructions.md
- integration-test-instructions.md
- build-and-test-summary.md

---

## Requirements Analysis — Custom Domain Feature
**Timestamp**: 2026-04-29T00:00:00Z
**User Input**: "using ai-dlc, health-your-domain.comは、ドメイン持っている場合としてオプション機能追加。通常(default)は、amplifyが自動設定のドメインを使う。"
**AI Response**: AIDLC ワークフロー開始。カスタムドメイン機能の要件質問ファイルを作成し、ユーザーの回答を収集。
**Context**: Requirements Analysis — カスタムドメインオプション機能

## Requirements Analysis — Question Answers
**Timestamp**: 2026-04-29T00:01:00Z
**User Input**: Q1=A(環境変数), Q2=A(カスタムドメインURLのみ), Q3=B(READMEに記載), Q4=A(セキュリティ拡張有効)
**AI Response**: 回答を基に要件確定。セキュリティ拡張ルール読み込み。ワークフロー計画へ進行。
**Context**: Requirements Analysis — 回答収集完了

---

## Workspace Detection
**Timestamp**: 2026-04-26T00:00:00Z
**User Input**: "usign ai-dlc, このプロジェクトを正確に分析した上で、AI-DLCに従い、今後の保守を踏まえ、ドキュメントを生成したい。プロジェクトをリバースエンジニアリングし、AI-DLCに準拠するドキュメントを揃えてください。"
**AI Response**: AI-DLC CLAUDE.md を読み込み、ワークスペースを検出。既存コードあり → Brownfield プロジェクトと判断。Reverse Engineering フェーズへ進行。
**Context**: Workspace Detection — Brownfield 検出

---

## Reverse Engineering
**Timestamp**: 2026-04-26T00:00:00Z
**User Input**: (上記と同一)
**AI Response**: 全ソースファイル（約30ファイル）を解析。README.md / ARCHITECTURE.md / infrastructure/lib/stack.ts / backend/*.py / src/**/*.tsx を読み込み。AI-DLC 規定の9種類のリバースエンジニアリングドキュメントを aidlc-docs/inception/reverse-engineering/ に生成。aidlc-state.md / audit.md を作成。
**Context**: Reverse Engineering — 全アーティファクト生成完了

---

## Requirements Analysis — 体脂肪率グラフ追加
**Timestamp**: 2026-04-26T10:00:00Z
**User Input**: "using ai-dlc, 体重推移と体重の増減ペースの間に、体脂肪率（7日SAM付き）のグラフも追加したい。"
**AI Response**: Workspace Detection スキップ（既存アーティファクトあり）。Requirements Analysis 開始。
**Context**: 新規機能追加 — 体脂肪率グラフ

---
