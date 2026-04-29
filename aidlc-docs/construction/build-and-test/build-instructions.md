# Build Instructions — Custom Domain オプション機能

## Prerequisites
- **Build Tool**: AWS CDK (TypeScript)
- **Node.js**: 18+
- **Environment Variables**: `GITHUB_TOKEN` (必須)、`CUSTOM_DOMAIN`（オプション）、`AMPLIFY_DOMAIN`（オプション）

## Build Steps

### 1. 依存インストール
```bash
cd infrastructure
npm install
```

### 2. TypeScript コンパイル確認（cdk synth）

#### デフォルト動作の確認（CUSTOM_DOMAIN 未設定）
```bash
cd infrastructure
GITHUB_TOKEN=dummy cdk synth
```
期待される結果: CloudFormation テンプレート生成、`AmplifyCustomDomain` リソースが含まれ**ない**こと

#### カスタムドメイン有効時の確認（CUSTOM_DOMAIN 設定）
```bash
cd infrastructure
GITHUB_TOKEN=dummy CUSTOM_DOMAIN=your-subdomain.your-domain.com cdk synth
```
期待される結果:
- `AWS::Amplify::Domain` リソースが生成されること
- `domainName: your-domain.com`、`prefix: health` が設定されていること
- `CustomDomainDnsSetup` Output が含まれること

### 3. ビルド成果物の確認
```bash
# CloudFormation テンプレートを確認
cat cdk.out/HealthDashboardStack.template.json | python3 -m json.tool | grep -A 20 "AmplifyCustomDomain"
```

## トラブルシューティング

### TypeScript コンパイルエラー
- `npm install` で依存関係を再インストール
- `node_modules` を削除して再インストール: `rm -rf node_modules && npm install`

### cdk synth でリソースが生成されない
- 環境変数 `CUSTOM_DOMAIN` が正しく設定されているか確認
- `echo $CUSTOM_DOMAIN` で値を確認
