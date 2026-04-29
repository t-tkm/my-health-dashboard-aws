# Unit Test Execution — Custom Domain オプション機能

## CDK インフラのテスト

CDK スタックに自動ユニットテストは未設定。以下の手動検証で代替する。

### 1. デフォルト動作のテスト（CUSTOM_DOMAIN 未設定）

```bash
cd infrastructure
GITHUB_TOKEN=dummy cdk synth 2>&1 | grep -E "AmplifyCustomDomain|CustomDomainDnsSetup"
```

**期待結果**: 出力なし（リソース・Output が含まれない）

```bash
# callbackUrls の確認（localhost のみ）
GITHUB_TOKEN=dummy cdk synth 2>&1
grep -A 5 "CallbackURLs" cdk.out/HealthDashboardStack.template.json
```

**期待結果**: `http://localhost:5173` のみ含まれる

### 2. カスタムドメイン有効時のテスト

```bash
cd infrastructure
GITHUB_TOKEN=dummy CUSTOM_DOMAIN=your-subdomain.your-domain.com cdk synth
```

**期待結果 — CloudFormation テンプレート内の確認項目:**

```bash
# CfnDomain リソースが存在すること
cat cdk.out/HealthDashboardStack.template.json | python3 -c "
import json, sys
t = json.load(sys.stdin)
r = t['Resources']
domain = [k for k in r if 'CustomDomain' in k]
print('CfnDomain found:', domain)
print('Props:', json.dumps(r[domain[0]]['Properties'], indent=2) if domain else 'NOT FOUND')
"
```

確認ポイント:
- `DomainName: your-domain.com`
- `SubDomainSettings: [{BranchName: main, Prefix: health}]`
- `EnableAutoSubDomain: false`

```bash
# callbackUrls にカスタムドメインのみ含まれること
cat cdk.out/HealthDashboardStack.template.json | python3 -c "
import json, sys
t = json.load(sys.stdin)
for k, v in t['Resources'].items():
    if v.get('Type') == 'AWS::Cognito::UserPoolClient':
        print('CallbackURLs:', v['Properties'].get('CallbackURLs'))
"
```

**期待結果**: `['http://localhost:5173', 'https://your-subdomain.your-domain.com']`

### 3. AMPLIFY_DOMAIN との排他確認

```bash
# CUSTOM_DOMAIN が AMPLIFY_DOMAIN より優先されること
GITHUB_TOKEN=dummy CUSTOM_DOMAIN=your-subdomain.your-domain.com AMPLIFY_DOMAIN=main.xxxx.amplifyapp.com cdk synth 2>&1 | \
  cat cdk.out/HealthDashboardStack.template.json | python3 -c "
import json, sys
t = json.load(sys.stdin)
for k, v in t['Resources'].items():
    if v.get('Type') == 'AWS::Cognito::UserPoolClient':
        urls = v['Properties'].get('CallbackURLs', [])
        assert 'https://your-subdomain.your-domain.com' in urls, 'Custom domain missing'
        assert not any('amplifyapp.com' in u for u in urls), 'Amplify domain should be excluded'
        print('PASS: CUSTOM_DOMAIN takes priority')
"
```
