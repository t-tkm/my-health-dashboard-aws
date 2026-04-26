# Reverse Engineering Metadata

**Analysis Date**: 2026-04-26T00:00:00Z
**Analyzer**: AI-DLC (Claude Sonnet 4.6 via Claude Code)
**Workspace**: /Users/takumi/repos/my-health-dashboard-aws
**Total Files Analyzed**: 30

## Artifacts Generated

- [x] business-overview.md
- [x] architecture.md
- [x] code-structure.md
- [x] api-documentation.md
- [x] component-inventory.md
- [x] technology-stack.md
- [x] dependencies.md
- [x] code-quality-assessment.md

## Key Findings Summary

- **Project Type**: Brownfield — 個人用健康管理ダッシュボード（AWS Serverless SPA）
- **Architecture**: React SPA + Amplify Hosting + Cognito + API Gateway + Lambda (Python 3.12 ARM_64) + DynamoDB
- **IaC**: AWS CDK (TypeScript) — HealthDashboardStack で全リソースを単一スタック管理
- **Auth**: Cognito User Pool（email/password, selfSignUpEnabled: false）+ SNS IdP コメントアウト
- **Critical Risk**: テストゼロ / DynamoDB removalPolicy: DESTROY / CORS allowOrigins: *
- **Business Transactions**: 認証 / データ表示 / データ入力(CRUD) / CSVエクスポート / CSVインポート
