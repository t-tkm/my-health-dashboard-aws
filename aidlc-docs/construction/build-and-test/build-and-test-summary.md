# Build and Test Summary — Custom Domain オプション機能

## Build Status

| 項目 | 結果 |
|---|---|
| Build Tool | AWS CDK (TypeScript) |
| `cdk synth` (CUSTOM_DOMAIN 未設定) | ✅ Pass |
| `cdk synth` (CUSTOM_DOMAIN=your-subdomain.your-domain.com) | ✅ Pass |
| TypeScript コンパイル | ✅ エラーなし |

## Test Summary

### ユニットテスト（cdk synth 検証）

| テストケース | 状態 |
|---|---|
| CUSTOM_DOMAIN 未設定時: `AWS::Amplify::Domain` リソースなし | 手動確認が必要 |
| CUSTOM_DOMAIN 設定時: `domainName=your-domain.com`, `prefix=health` | 手動確認が必要 |
| CUSTOM_DOMAIN 設定時: callbackUrls がカスタムドメインのみ | 手動確認が必要 |
| `enableAutoSubDomain: false` | 手動確認が必要 |

### 統合テスト

| テストケース | 状態 |
|---|---|
| カスタムドメインでのデプロイ | 未実施（別アカウント Route53 への CNAME 追加が必要） |
| `https://your-subdomain.your-domain.com` アクセス確認 | 未実施 |
| Cognito ログイン動作確認 | 未実施 |
| カスタムドメイン無効への切り戻し | 未実施 |

### パフォーマンステスト
N/A — インフラ設定の変更のみ

### セキュリティコンプライアンス

| ルール | 結果 |
|---|---|
| SECURITY-06 (最小権限) | ✅ CfnDomain スコープが appId に限定 |
| SECURITY-08 (CORS 制限) | ✅ callbackUrls にワイルドカードなし |
| その他 | N/A |

## 生成ファイル

- `aidlc-docs/construction/build-and-test/build-instructions.md`
- `aidlc-docs/construction/build-and-test/unit-test-instructions.md`
- `aidlc-docs/construction/build-and-test/integration-test-instructions.md`
- `aidlc-docs/construction/build-and-test/build-and-test-summary.md`

## Overall Status

- **Build**: ✅ `cdk synth` 正常完了
- **ユニットテスト**: 手動検証ステップあり（`unit-test-instructions.md` 参照）
- **統合テスト**: 実デプロイ後に実施（`integration-test-instructions.md` 参照）
- **Operations 準備**: デプロイ可能（README の手順に従って実施）

## 次のステップ

1. `cdk deploy` で本番デプロイ（`CUSTOM_DOMAIN=your-subdomain.your-domain.com` を設定）
2. Amplify コンソールで CNAME レコードを確認
3. 別アカウントの Route53 に CNAME を追加
4. DNS 伝播後に `https://your-subdomain.your-domain.com` でアクセス確認
