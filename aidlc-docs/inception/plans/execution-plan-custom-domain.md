# Execution Plan — Custom Domain オプション機能

## Detailed Analysis Summary

### Transformation Scope
- **Transformation Type**: 既存インフラへの小規模追加（Single component change）
- **Primary Changes**: `infrastructure/lib/stack.ts` に条件分岐と `CfnDomain` リソースを追加
- **Related Components**: CDK インフラ（stack.ts）、README

### Change Impact Assessment
- **User-facing changes**: Yes — カスタムドメイン有効時に `your-subdomain.your-domain.com` でアクセス可能
- **Structural changes**: No — 既存アーキテクチャ変更なし
- **Data model changes**: No
- **API changes**: No — callbackUrls の URL 変更のみ
- **NFR impact**: Yes (Low) — HTTPS 強制（Amplify ACM 管理）

### Risk Assessment
- **Risk Level**: Low
- **Rollback Complexity**: Easy（環境変数を外すだけで元に戻る）
- **Testing Complexity**: Simple

---

## Workflow Visualization (Text)

```
INCEPTION PHASE
  [x] Workspace Detection    — COMPLETED
  [x] Reverse Engineering    — COMPLETED (既存成果物あり)
  [x] Requirements Analysis  — COMPLETED
  [ ] User Stories           — SKIP (インフラのみ、ユーザー操作変更なし)
  [x] Workflow Planning      — IN PROGRESS
  [ ] Application Design     — SKIP (新コンポーネントなし)
  [ ] Units Generation       — SKIP (単一ユニット)

CONSTRUCTION PHASE
  [ ] Functional Design      — SKIP (ビジネスロジックなし)
  [ ] NFR Requirements       — SKIP (既存 HTTPS/ACM で充足)
  [ ] NFR Design             — SKIP
  [ ] Infrastructure Design  — SKIP (変更内容が明確)
  [x] Code Generation        — EXECUTE (1 ユニット)
  [x] Build and Test         — EXECUTE

OPERATIONS PHASE
  [ ] Operations             — PLACEHOLDER
```

---

## Phases to Execute

### 🔵 INCEPTION PHASE
- [x] Workspace Detection — COMPLETED
- [x] Reverse Engineering — COMPLETED
- [x] Requirements Analysis — COMPLETED
- [ ] User Stories — **SKIP**: インフラ変更のみでユーザー操作フローへの影響なし
- [x] Workflow Planning — IN PROGRESS
- [ ] Application Design — **SKIP**: 新コンポーネントなし、既存 `CfnApp` に追加するだけ
- [ ] Units Generation — **SKIP**: 単一ユニット（stack.ts + README）

### 🟢 CONSTRUCTION PHASE
- [ ] Functional Design — **SKIP**: ビジネスロジックなし
- [ ] NFR Requirements — **SKIP**: Amplify の ACM 自動管理で HTTPS は既に充足
- [ ] NFR Design — **SKIP**
- [ ] Infrastructure Design — **SKIP**: 変更内容が明確（CfnDomain + callbackUrls）
- [ ] Code Generation — **EXECUTE** (1 ユニット)
  - `infrastructure/lib/stack.ts` に `CUSTOM_DOMAIN` 環境変数対応を追加
  - `CfnDomain` リソースを条件付きで追加
  - callbackUrls ロジックを分岐
  - README に DNS 設定手順を追記
- [ ] Build and Test — **EXECUTE**

### 🟡 OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER

---

## Code Generation Plan (Unit 1)

### 変更ファイル

#### 1. `infrastructure/lib/stack.ts`

**変更箇所 1: callbackUrls ロジックの分岐**
```
CUSTOM_DOMAIN あり → callbackUrls = ['http://localhost:5173', 'https://<CUSTOM_DOMAIN>']
CUSTOM_DOMAIN なし → 既存の AMPLIFY_DOMAIN ロジックを維持
```

**変更箇所 2: CfnDomain の条件付き追加**
```typescript
// CUSTOM_DOMAIN=your-subdomain.your-domain.com → prefix='health', rootDomain='your-domain.com'
if (customDomain) {
  new amplify.CfnDomain(this, 'AmplifyCustomDomain', {
    appId: amplifyApp.attrAppId,
    domainName: rootDomain,
    subDomainSettings: [{ branchName: 'main', prefix }],
    enableAutoSubDomain: false,
  });
}
```

**変更箇所 3: CfnOutput のカスタムドメイン対応**
- カスタムドメイン有効時に `AmplifyAppUrl` を `your-subdomain.your-domain.com` に変更
- カスタムドメイン有効時に DNS 設定手順の Output を追加

#### 2. `README.md`（または既存ドキュメント）
- カスタムドメインの使用方法（環境変数の設定）
- 別アカウント Route53 への CNAME レコード追加手順

---

## Security Compliance (SECURITY extension enabled)

| Rule | Status | Notes |
|---|---|---|
| SECURITY-01 (Encryption at Rest/Transit) | Compliant | Amplify ACM が HTTPS を自動管理 |
| SECURITY-02 (Access Logging) | Compliant | 既存の Amplify アクセスログ設定を維持 |
| SECURITY-04 (HTTP Security Headers) | N/A | Amplify コンソール設定、今回の変更対象外 |
| SECURITY-06 (Least Privilege) | Compliant | CfnDomain は Amplify App スコープのみ |
| SECURITY-08 (Access Control / CORS) | Compliant | Q2=A によりカスタムドメイン有効時は callbackUrls を限定（* 不使用） |
| SECURITY-12 (Authentication) | N/A | 既存 Cognito 設定変更なし |
| その他 | N/A | 今回の変更対象外 |

---

## Success Criteria
- `CUSTOM_DOMAIN` 未設定時: 既存の Amplify 自動ドメイン動作を維持
- `CUSTOM_DOMAIN=your-subdomain.your-domain.com` 設定時: `CfnDomain` が生成され、callbackUrls がカスタムドメインのみになる
- `cdk synth` がエラーなく完了する
- README に DNS 設定手順が記載されている
