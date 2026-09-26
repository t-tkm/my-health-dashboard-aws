# ログ構造リファレンス

アプリケーションログはすべて **CloudWatch Logs** に JSON 形式で記録されます。外部ログライブラリは使用せず、Python 標準の `logging` モジュールと手動の `json.dumps()` で構造化ログを生成しています。保存期間はすべてのロググループで **3 ヶ月（90 日）** です。

## ロググループ一覧

| ロググループ | 内容 |
|---|---|
| `/aws/apigateway/health-dashboard-access` | API Gateway HTTP アクセスログ |
| `/aws/lambda/health-dashboard-data` | データ取得 Lambda |
| `/aws/lambda/health-dashboard-entry` | データ登録 Lambda |
| `/aws/lambda/health-dashboard-export` | CSV エクスポート Lambda |
| `/aws/lambda/health-dashboard-importcsv` | CSV インポート Lambda |
| `/aws/lambda/health-dashboard-preauth` | Cognito Pre-Authentication トリガー |
| `/aws/lambda/health-dashboard-postauth` | Cognito Post-Authentication トリガー |

## ログイベントの種類とフィールド

### 1. Lambda アクセスログ（`type: "access"`）

`@log_handler` デコレータが全 Lambda ハンドラ呼び出し時に出力します（`backend/common.py`）。

```json
{
  "type": "access",
  "method": "GET",
  "path": "/api/data",
  "userId": "cognito-sub-uuid",
  "status": 200,
  "durationMs": 45.2
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"access"` |
| `method` | string | HTTP メソッド（`GET` / `POST` / `DELETE`） |
| `path` | string | リクエストパス |
| `userId` | string | Cognito の `sub` クレーム。未認証時は `"anonymous"` |
| `status` | number | HTTP ステータスコード |
| `durationMs` | number | Lambda 実行時間（ミリ秒） |

### 2. Lambda エラーログ（`type: "error"`）

ハンドラ内で未捕捉の例外が発生した場合に出力されます。

```json
{
  "type": "error",
  "method": "POST",
  "path": "/api/entry",
  "userId": "cognito-sub-uuid",
  "error": "ValidationError: missing field 'date'",
  "durationMs": 12.8
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"error"` |
| `method` | string | HTTP メソッド |
| `path` | string | リクエストパス |
| `userId` | string | Cognito の `sub` クレーム（または `"anonymous"`） |
| `error` | string | 例外メッセージ（`str(e)`） |
| `durationMs` | number | 例外発生までの実行時間（ミリ秒） |

### 3. 認証試行ログ（`type: "login_attempt"`）

Cognito Pre-Authentication トリガーが全ログイン試行時に出力します（`backend/lambda/auth_pre.py`）。

```json
{
  "type": "login_attempt",
  "username": "user@example.com",
  "triggerSource": "PreAuthentication_Authentication",
  "clientId": "cognito-app-client-id"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"login_attempt"` |
| `username` | string | ログイン試行のユーザー名（メールアドレス） |
| `triggerSource` | string | Cognito トリガーソース識別子 |
| `clientId` | string | Cognito アプリクライアント ID |

### 4. 認証成功ログ（`type: "login_success"`）

Cognito Post-Authentication トリガーが認証成功時に出力します（`backend/lambda/auth_post.py`）。

```json
{
  "type": "login_success",
  "username": "user@example.com",
  "userId": "cognito-sub-uuid",
  "email": "user@example.com",
  "newDeviceUsed": false,
  "triggerSource": "PostAuthentication_Authentication",
  "clientId": "cognito-app-client-id"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | string | 常に `"login_success"` |
| `username` | string | 認証されたユーザー名 |
| `userId` | string | Cognito の `sub` UUID |
| `email` | string | ユーザーのメールアドレス |
| `newDeviceUsed` | boolean | 初回デバイスからのログインかどうか |
| `triggerSource` | string | Cognito トリガーソース識別子 |
| `clientId` | string | Cognito アプリクライアント ID |

### 5. API Gateway アクセスログ

API Gateway が自動出力する標準フィールド形式のログです。

| フィールド | 説明 |
|---|---|
| `@timestamp` | リクエスト日時 |
| `httpMethod` | HTTP メソッド |
| `resourcePath` | API リソースパス（例: `/api/data`） |
| `status` | HTTP ステータスコード |
| `responseLength` | レスポンスボディのバイト数 |
| `ip` | クライアント IP アドレス |
| `requestTime` | リクエスト受信タイムスタンプ |
| `protocol` | プロトコル（例: `HTTP/1.1`） |

## CloudWatch Logs Insights 保存済みクエリ

CDK デプロイ時に以下のクエリが自動登録されます。マネジメントコンソールの **CloudWatch → Logs Insights → Saved queries** から `health-dashboard/` プレフィックスで検索してください。

| クエリ名 | 対象ロググループ | 内容 |
|---|---|---|
| `health-dashboard/api-access` | API Gateway | HTTP リクエスト一覧（メソッド・パス・ステータス・レスポンスサイズ・IP） |
| `health-dashboard/auth-events` | PreAuth + PostAuth | 全認証イベント（試行・成功の両方） |
| `health-dashboard/auth-attempt-stats` | PreAuth + PostAuth | ログイン試行の集計（5 分窓、username × 試行回数）。成功直前の試行も含む |
| `health-dashboard/auth-successes` | PostAuth | ログイン成功のみ |

> **5 分窓（`bin(5m)`）について**  
> ログイベントを 5 分単位の時間枠でグループ化します。例えば 00:00〜00:05 の間に発生した 6 回の試行は、`bin = 00:00:00` の 1 行に `events = 6` としてまとめて表示されます。短時間に大量の試行が集中する brute force 攻撃の検知に適しています。
