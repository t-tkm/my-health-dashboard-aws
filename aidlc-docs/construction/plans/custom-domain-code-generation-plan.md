# Code Generation Plan — Custom Domain オプション機能

**Unit**: custom-domain
**Workspace Root**: /Users/takumitomita/repos/my-health-dashboard-aws
**Project Type**: Brownfield (CDK TypeScript)

---

## Unit Context

- **目的**: `CUSTOM_DOMAIN` 環境変数が設定されている場合のみ Amplify カスタムドメインを有効化
- **デフォルト動作**: 変更なし（既存の Amplify 自動ドメイン使用）
- **依存**: 既存の `amplifyApp` (`CfnApp`)、`MainBranch` (`CfnBranch`)

---

## Steps

### Step 1: `infrastructure/lib/stack.ts` — callbackUrls ロジックの分岐
- [x] `CUSTOM_DOMAIN` 環境変数の読み込みを追加
- [x] カスタムドメインあり: `callbackUrls = ['http://localhost:5173', 'https://${customDomain}']`
- [x] カスタムドメインなし: 既存の `AMPLIFY_DOMAIN` ベースロジックをそのまま維持

### Step 2: `infrastructure/lib/stack.ts` — CfnDomain リソースの条件付き追加
- [x] `customDomain` が存在する場合のみ `CfnDomain` を生成
- [x] `domainName` = ルートドメイン部分（例: `your-subdomain.your-domain.com` → `your-domain.com`）
- [x] `subDomainSettings` = `[{ branchName: 'main', prefix: 'health' }]`
- [x] `enableAutoSubDomain: false`

### Step 3: `infrastructure/lib/stack.ts` — CfnOutput の更新
- [x] カスタムドメイン有効時は `AmplifyAppUrl` の value を `https://${customDomain}` に変更
- [x] カスタムドメイン有効時に DNS 設定手順の案内 Output を追加

### Step 4: `README.md` — カスタムドメイン使用方法の追記
- [x] カスタムドメインのオプション機能セクションを追加
- [x] 環境変数の設定方法（`CUSTOM_DOMAIN=your-subdomain.your-domain.com cdk deploy`）
- [x] 別アカウント Route53 への CNAME レコード追加手順
- [x] デプロイ後の確認方法

---

## Security Compliance Checklist

- [x] SECURITY-06: `CfnDomain` のスコープが `amplifyApp.attrAppId` に限定されていること
- [x] SECURITY-08: `callbackUrls` にカスタムドメイン設定時にワイルドカード (`*`) を使用していないこと

---

## 変更ファイル一覧

| ファイル | 種別 | 変更内容 |
|---|---|---|
| `infrastructure/lib/stack.ts` | 修正 | CUSTOM_DOMAIN 対応、CfnDomain 追加 |
| `README.md` | 修正 | カスタムドメイン設定手順の追記 |
