# デプロイ詳細

README の「AWS へのデプロイ」を補足する手順集。

## GitHub Personal Access Token の作成

CDK が Amplify と GitHub を連携するために PAT が必要。

1. GitHub にログイン
2. 右上アイコン → **Settings**
3. 左メニュー最下部 → **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. **Generate new token** → **Generate new token (classic)**
6. 以下を設定して **Generate token**：
   - Note: `amplify-cdk`（任意）
   - Expiration: 任意
   - Scope: **`repo`** と **`admin:repo_hook`** にチェック（Amplify が webhook を作成するために必要）
7. 表示されたトークン（`ghp_xxx...`）をコピー（この画面を閉じると二度と表示されない）

## AWS SSO を使う場合

事前に環境変数をセットしておくと、以降の `aws` / `cdk` コマンドで `--profile` を省略できる。

```bash
export AWS_PROFILE=your-profile   # 使用するプロファイル名
export AWS_PAGER=                # ページャーを無効化（出力が止まらなくなる）
```

```bash
# ログイン
aws sso login

# 認証確認（アカウント ID とロールが表示されれば OK）
aws sts get-caller-identity
```

`~/.zshrc` などグローバル設定を汚さずこのプロジェクトだけに閉じたい場合は、テンプレートから `env.sh`（`.gitignore` 済み）を作り、ターミナルごとに `source env.sh` して読み込む。`AWS_PROFILE` / `AWS_PAGER` のほか、`GITHUB_TOKEN` や `CUSTOM_DOMAIN` もまとめて設定できる。

```bash
cp env.sh.example env.sh   # 値を記入する
source env.sh
```

複数のターミナルアプリ（cmux / VS Code / Kiro のターミナルなど）から同じプロジェクトを触る場合も、それぞれで `source env.sh` すれば同じ設定になる。なお `aws sso login` 自体のトークンは `~/.aws/sso/cache/` にファイルとしてキャッシュされるため、シェルが違ってもログイン状態そのものは共有される。

必要な権限の目安（管理者ロール推奨）：`dynamodb:*` / `lambda:*` / `apigateway:*` / `cognito-idp:*` / `iam:CreateRole` / `cloudformation:*` / `s3:*`

## 独自ドメイン（`CUSTOM_DOMAIN`）の設定

前提: 指定するドメインのルートゾーン（例: `your-domain.com`）を Route53 で管理していること（別 AWS アカウントのホストゾーンでも可）。

`export CUSTOM_DOMAIN=your-subdomain.your-domain.com` を設定して `cdk deploy` したあと、2 種類の CNAME レコードを Route53 に追加する必要がある。

### 追加する CNAME レコード

| # | 用途 | レコード名 | 値 |
|---|---|---|---|
| 1 | SSL 証明書の検証（ACM） | `_<hash>.your-domain.com` | `_<hash>.acm-validations.aws` |
| 2 | ドメインの向き先（CloudFront） | `your-subdomain.your-domain.com` | `<appId>.cloudfront.net` |

具体的な値は Amplify コンソールで確認する：

1. [Amplify コンソール](https://console.aws.amazon.com/amplify/) を開く
2. アプリ `health-dashboard` → **Domain management** を選択
3. 画面に表示される 2 件の CNAME レコードの **名前** と **値** をそれぞれメモする

> **Amplify コンソールの表示に関する注意**: 新しい Amplify コンソール（2025年以降）では、CDK（CloudFormation）経由で設定したカスタムドメインが Domain management に表示されないことがある。
> その場合は CloudFormation コンソール → `HealthDashboardStack` → 「リソース」タブ → `AmplifyCustomDomain` のリンクから直接ドメイン設定画面にアクセスできる。

### Route53 への追加手順

`your-domain.com` のホストゾーンがあるアカウントのプロファイル（以下 `<hosted-zone-profile>`）で操作する。

**レコード 1：ACM 証明書検証用**（ルートドメインに対して1回のみ）

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_<hash>.your-domain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{ "Value": "_<hash>.acm-validations.aws" }]
      }
    }]
  }' \
  --profile <hosted-zone-profile>
```

**レコード 2：ドメイン向き先**（再デプロイで CloudFront が変わった場合は `UPSERT` で更新）

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "your-subdomain.your-domain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{ "Value": "<appId>.cloudfront.net" }]
      }
    }]
  }' \
  --profile <hosted-zone-profile>
```

> **再デプロイ時の注意（特に cdk destroy → cdk deploy の場合）**:
> `cdk destroy` 後に再デプロイすると CloudFront のエンドポイントが変わる。
> このとき古い CNAME が残っていると Amplify の SSL 設定が "points to another CloudFront distribution" エラーで失敗する。
>
> **対処手順**:
> 1. Route53 で `your-subdomain.your-domain.com` の CNAME レコードを**削除**する
> 2. Amplify コンソール → Domain management → 「再試行」をクリック
> 3. 新しい CNAME 値（新しい `xxxx.cloudfront.net`）が表示されるのでメモ
> 4. Route53 に新しい値で CNAME を**作成**する
>
> `"Action": "UPSERT"` では解決しない（Amplify が新旧 CF の競合を DNS レベルで検出するため）。
> レコード 1（ACM 検証: `_hash.your-domain.com`）は再デプロイ後も変わらないため再追加不要。

DNS 伝播には数分〜最大 48 時間かかる場合がある。  
Amplify コンソールの Domain management で **「Available」** と表示されれば設定完了。

## SNS IdP の追加（オプション）

各プロバイダーのデベロッパーコンソールで OAuth 認証情報を取得し、
`infrastructure/lib/stack.ts` のコメントアウトを解除して再デプロイ：

| IdP | 取得先 |
|---|---|
| Google | [Google Cloud Console](https://console.cloud.google.com/) |
| Apple | [Apple Developer](https://developer.apple.com/) |
| Facebook | [Meta for Developers](https://developers.facebook.com/) |
| Amazon | [Amazon Developer](https://developer.amazon.com/) |

## ユーザー管理（Cognito）

### セルフサインアップ

デフォルトは **無効**（`selfSignUpEnabled: false`）。管理者が作成したユーザーのみサインインできる。

#### 方法 A：コンソールで一時的に有効化（次回 `cdk deploy` で元に戻る）

1. [Cognito コンソール](https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools) を開く
2. ユーザープール `health-dashboard-users` を選択
3. **サインアップエクスペリエンス** タブ → **セルフサービスのサインアップ** → **編集**
4. 「セルフサービスのサインアップを有効にする」をオンにして保存

> ⚠️ 次回 `cdk deploy` を実行すると `false`（無効）に戻る。

#### 方法 B：CDK で恒久的に有効化

`infrastructure/lib/stack.ts` を編集：

```typescript
// 変更前
selfSignUpEnabled: false,

// 変更後
selfSignUpEnabled: true,
```

変更後に再デプロイ：

```bash
source env.sh   # GITHUB_TOKEN・CUSTOM_DOMAIN など
cd infrastructure && npx cdk deploy
```

### 管理者によるユーザー作成

セルフサインアップが無効の状態でも、コンソールからユーザーを手動作成できる：

1. Cognito コンソール → ユーザープール `health-dashboard-users`
2. **ユーザー** タブ → **ユーザーを作成**
3. メールアドレスを入力し、仮パスワードを設定（初回ログイン時に変更を求められる）
