# AI-DLC Workflow State

**Project**: my-health-dashboard-aws
**Project Type**: Brownfield
**Last Updated**: 2026-04-26T10:30:00Z

## Stage Progress

### 🔵 INCEPTION PHASE
- [x] Workspace Detection — Completed 2026-04-26
- [x] Existing System Analysis — Completed 2026-04-26 (inception/ + construction/ に分割配置)
- [x] Requirements Analysis — Completed 2026-04-26
- [x] User Stories — Completed 2026-04-26
- [x] Workflow Planning — Completed 2026-04-26
- [x] Application Design — Completed 2026-04-26
- [ ] Units Generation — SKIP (ドキュメント整備のみ)

### 🟢 CONSTRUCTION PHASE — 体脂肪率グラフ機能追加
- [ ] Functional Design — SKIP
- [ ] NFR Requirements — SKIP
- [ ] NFR Design — SKIP
- [ ] Infrastructure Design — SKIP (既存 DynamoDB・Lambda を利用、スキーマ変更なし)
- [x] Code Generation — Completed 2026-04-26 (体脂肪率グラフ機能)
- [ ] Build and Test — 実装後手動確認

### 🟡 OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER

## Artifacts

### inception/
- [x] business-overview.md — ビジネスコンテキスト・業務取引
- [x] architecture.md — システムアーキテクチャ図
- [x] requirements/requirements.md — 機能・非機能要件
- [x] user-stories/personas.md — ユーザーペルソナ（2種）
- [x] user-stories/stories.md — ユーザーストーリー（US-01〜09）
- [x] application-design/components.md — コンポーネント定義（C-01〜C-08）
- [x] application-design/component-methods.md — メソッドシグネチャ
- [x] application-design/services.md — サービス定義（S-01〜S-05）
- [x] application-design/component-dependency.md — 依存関係・データフロー
- [x] application-design/application-design.md — 統合設計ドキュメント
- [x] plans/execution-plan.md — ワークフロー実行計画

### construction/
- [x] code-structure.md — コード構造・ファイルインベントリ・設計パターン
- [x] api-documentation.md — REST API 全エンドポイント・内部API
- [x] technology-stack.md — 技術スタック一覧
- [x] dependencies.md — 内部・外部依存関係図
- [x] code-quality-assessment.md — テストカバレッジ・技術的負債

## Extension Configuration

| Extension | Status | Note |
|---|---|---|
| security-baseline | Not enabled | 将来の機能追加時に検討 |
| property-based-testing | Not enabled | テスト導入時に検討 |

## Current Status

- **Lifecycle Phase**: OPERATIONS PHASE（本番稼働中）
- **Current Stage**: 全フェーズ完了
- **Last Updated**: 2026-05-04

## 本番環境（2026-05-04 時点）

| リソース | 値 |
|---|---|
| Amplify App ID | d26nlqzhwk67p |
| Amplify デフォルト URL | https://main.d26nlqzhwk67p.amplifyapp.com |
| カスタムドメイン | https://health.t-tkm.link |
| API Gateway | https://imq0y07nz4.execute-api.ap-northeast-1.amazonaws.com/prod/ |
| Cognito User Pool ID | ap-northeast-1_gIPXApTdX |
| Cognito Client ID | 378hu4amsoo4h6aif1a0drj3j6 |
| Cognito ドメイン | https://health-dashboard-808429991942.auth.ap-northeast-1.amazoncognito.com |
| CloudFront (カスタムドメイン向け) | d3sd7gq2rgkqfb.cloudfront.net |

## 既知の挙動・注意事項

- **cdk destroy → cdk deploy 時**: CloudFront エンドポイントが変わるため、Route53 の CNAME を削除してから Amplify コンソールで「再試行」する必要がある（README 参照）
- **CfnDomain race condition**: `cfnDomain.addDependency(mainBranch)` で解消済み（2026-05-04 修正）
- **Amplify 新コンソール**: CDK 経由のカスタムドメインが Domain management に表示されない場合は CloudFormation → AmplifyCustomDomain リンクから確認
- **t-tkm.link Route53**: 別 AWS アカウントで管理（CNAME 変更時は別アカウントにログインが必要）
