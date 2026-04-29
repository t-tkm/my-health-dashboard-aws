# Integration Test Instructions — Custom Domain オプション機能

## 本番環境での統合テスト手順

### 前提条件
- `t-tkm.link` の Route53 ホストゾーン（別アカウント）への書き込み権限
- 現 AWS アカウントへの CDK デプロイ権限

---

## Scenario 1: カスタムドメイン有効でのデプロイ

### Step 1: CDK デプロイ（CUSTOM_DOMAIN 指定）

```bash
cd infrastructure
export GITHUB_TOKEN=ghp_xxxx
export CUSTOM_DOMAIN=health.t-tkm.link
cdk deploy
```

**期待される Outputs:**
```
HealthDashboardStack.AmplifyAppUrl       = https://health.t-tkm.link
HealthDashboardStack.CustomDomainDnsSetup = Amplify コンソール → Domain management で...
```

### Step 2: Amplify コンソールで CNAME レコードを確認

1. [Amplify コンソール](https://console.aws.amazon.com/amplify/) を開く
2. `health-dashboard` → **Domain management** を選択
3. 表示されている CNAME レコードを記録する（2〜3 件）

### Step 3: 別アカウントの Route53 に CNAME を追加

`t-tkm.link` を管理する AWS アカウントにログインし、以下を追加:
- ACM 証明書検証用 CNAME（Amplify コンソールの表示に従う）
- ドメイン向き先 CNAME: `health.t-tkm.link` → `<appId>.cloudfront.net`

### Step 4: DNS 伝播と Amplify ドメイン検証を待つ

```bash
# DNS 伝播の確認
dig CNAME health.t-tkm.link

# Amplify Domain status の確認（Available になるまで待つ）
aws amplify get-domain-association \
  --app-id <appId> \
  --domain-name t-tkm.link \
  --query 'domainAssociation.domainStatus'
```

**期待結果**: `"AVAILABLE"`

### Step 5: ブラウザでのアクセス確認

1. `https://health.t-tkm.link` にアクセス
2. HTTPS 接続（鍵マーク）が表示されること
3. Cognito ログイン画面が表示されること
4. ログイン後、ダッシュボードが正常表示されること

---

## Scenario 2: カスタムドメイン無効への切り戻し

```bash
unset CUSTOM_DOMAIN
export AMPLIFY_DOMAIN=main.<appId>.amplifyapp.com
cdk deploy
```

**確認項目:**
- `AmplifyAppUrl` Output が Amplify 自動ドメインに戻ること
- `CustomDomainDnsSetup` Output が消えること
- Cognito callbackUrls が `https://main.<appId>.amplifyapp.com` に戻ること
