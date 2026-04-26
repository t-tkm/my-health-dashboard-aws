# API Documentation

## REST APIs

全エンドポイントは Amazon API Gateway 経由で提供。認証は Cognito User Pools JWT Authorizer を使用。
全エンドポイントで CORS プリフライト（OPTIONS）に対応。

### GET /api/data — 健康データ取得

- **Method**: GET
- **Path**: `/api/data`
- **Purpose**: ログインユーザーの全期間健康データを取得し、React 向けに集計した HealthData を返す
- **Request**:
  ```
  Headers:
    Authorization: <Cognito ID Token (JWT)>
  ```
- **Response** (200 OK):
  ```json
  {
    "dates": ["2025-01-01", "..."],
    "weights": [80.0, "..."],
    "sma7": [80.0, "..."],
    "body_fat_percents": [20.0, "..."],
    "sma7_body_fat": [20.1, "..."],
    "slope_dates": ["2025-01-07", "..."],
    "slope_values": [-0.05, "..."],
    "calories": [2000, "..."],
    "protein_gram": [80.0, "..."],
    "fat_gram": [60.0, "..."],
    "carb_gram": [250.0, "..."],
    "sugar_gram": [100.0, "..."],
    "fiber_gram": [20.0, "..."],
    "salt_gram": [6.0, "..."],
    "cal_target": 2000.0,
    "protein_target": 80.0,
    "fat_target": 60.0,
    "carb_target": 250.0,
    "sugar_target": 100.0,
    "fiber_target": 20.0,
    "salt_target": 6.0,
    "current_weight": 79.8,
    "sma7_start": 80.0,
    "sma7_end": 79.9,
    "sma7_start_date": "2025-01-01",
    "sma7_end_date": "2025-12-31",
    "weight_diff": 0.1,
    "avg_cal": 1900,
    "record_days": 365,
    "weight_min": 78.8,
    "weight_max": 81.0
  }
  ```
- **Response** (404): `{"error": "no_data"}` — データが存在しない場合
- **Response** (401): `{"error": "Unauthorized"}` — JWT 未認証
- **Lambda**: `backend/lambda/data.py` → `load_items()` + `compute()`

---

### POST /api/entry — データ追加・更新

- **Method**: POST
- **Path**: `/api/entry`
- **Purpose**: 指定日の体重・栄養素・目安値を追加または更新。更新後の全期間 HealthData を返す
- **Request**:
  ```
  Headers:
    Authorization: <JWT>
    Content-Type: application/json
  Body:
  {
    "date": "2025-01-15",      // 必須 (YYYY-MM-DD)
    "weight": 79.5,            // 任意
    "calories": 2100,          // 任意
    "protein_g": 85.0,         // 任意
    "fat_g": 65.0,             // 任意
    "carb_g": 260.0,           // 任意
    "sugar_g": 110.0,          // 任意
    "fiber_g": 22.0,           // 任意
    "salt_g": 5.5,             // 任意
    "cal_target": 2000.0,      // 任意
    "protein_target": 80.0,    // 任意
    "fat_target": 60.0,        // 任意
    "carb_target": 250.0,      // 任意
    "sugar_target": 100.0,     // 任意
    "fiber_target": 20.0,      // 任意
    "salt_target": 6.0         // 任意
  }
  ```
- **Validation**: `date` は必須。`weight` か栄養素フィールドのどちらか一方以上が必要
- **Response** (200): 更新後の HealthData JSON（GET /api/data と同形式）
- **Response** (400): `{"error": "date は必須です"}` / `{"error": "体重か栄養素のどちらかを入力してください"}`
- **Lambda**: `backend/lambda/entry.py` → `put_entry()` + `load_items()` + `compute()`

---

### DELETE /api/entry — データ削除

- **Method**: DELETE
- **Path**: `/api/entry`
- **Purpose**: 指定日のレコードを削除。削除後の全期間 HealthData を返す
- **Request**:
  ```
  Headers:
    Authorization: <JWT>
    Content-Type: application/json
  Body:
  {
    "date": "2025-01-15"   // 必須
  }
  ```
- **Response** (200): 削除後の HealthData JSON（データが0件の場合は `{}`）
- **Lambda**: `backend/lambda/entry.py` → `delete_entry()` + `load_items()` + `compute()`

---

### GET /api/export — CSV エクスポート

- **Method**: GET
- **Path**: `/api/export`
- **Purpose**: ログインユーザーの全データを CSV ファイルとしてダウンロード
- **Request**:
  ```
  Headers:
    Authorization: <JWT>
  ```
- **Response** (200):
  ```
  Headers:
    Content-Type: text/csv; charset=utf-8
    Content-Disposition: attachment; filename="health_data.csv"
  Body: Base64エンコードされた CSV データ（isBase64Encoded: true）
  ```
- **CSV カラム**: `date`, `weight`, `calories`, `protein_g`, `fat_g`, `carb_g`, `sugar_g`, `fiber_g`, `salt_g`, `cal_target`, `protein_target`, `fat_target`, `carb_target`, `sugar_target`, `fiber_target`, `salt_target`
- **エンコーディング**: UTF-8 BOM 付き
- **Lambda**: `backend/lambda/export.py` → `load_items()` + `items_to_csv()`

---

### POST /api/import — CSV インポート

- **Method**: POST
- **Path**: `/api/import`
- **Purpose**: CSV ファイルを受け取り、DynamoDB に一括インポート。インポート件数を返す
- **Request**:
  ```
  Headers:
    Authorization: <JWT>
    Content-Type: text/csv
  Body: CSV バイナリデータ
  ```
- **CSV カラムマッピング（日本語 → DB）**:

  | CSV カラム | DB 属性 |
  |---|---|
  | 日付 | date |
  | 体重 | weight |
  | カロリー | calories |
  | たんぱく質 | protein_g |
  | 脂質 | fat_g |
  | 炭水化物 | carb_g |
  | 糖質 | sugar_g |
  | 食物繊維 | fiber_g |
  | 塩分 | salt_g |
  | カロリー(目安) | cal_target |
  | たんぱく質(目安) | protein_target |
  | 脂質(目安) | fat_target |
  | 炭水化物(目安) | carb_target |
  | 糖質(目安) | sugar_target |
  | 食物繊維(目安) | fiber_target |
  | 塩分(目安) | salt_target |

- **エンコーディング**: UTF-8（BOM あり/なし両対応）または Shift-JIS
- **Response** (200): `{"imported": N}` — インポートした件数
- **Lambda**: `backend/lambda/import_csv.py` → `import_csv_to_dynamo()`

---

> **Internal APIs（data_processor / common）のメソッド詳細**:  
> → [`inception/application-design/component-methods.md`](../inception/application-design/component-methods.md)

## Data Models

### DynamoDB: health-entries

| 属性 | 型 | キー | 説明 |
|---|---|---|---|
| userId | String | PK | Cognito sub（UUID）|
| date | String | SK | YYYY-MM-DD 形式 |
| weight | Decimal | — | 体重（kg）|
| body_fat_percent | Decimal | — | 体脂肪率（%）|
| calories | Decimal | — | 摂取カロリー（kcal）|
| protein_g | Decimal | — | タンパク質（g）|
| fat_g | Decimal | — | 脂質（g）|
| carb_g | Decimal | — | 炭水化物（g）|
| sugar_g | Decimal | — | 糖質（g）|
| fiber_g | Decimal | — | 食物繊維（g）|
| salt_g | Decimal | — | 塩分（g）|
| cal_target | Decimal | — | カロリー目標（kcal）|
| protein_target | Decimal | — | タンパク質目標（g）|
| fat_target | Decimal | — | 脂質目標（g）|
| carb_target | Decimal | — | 炭水化物目標（g）|
| sugar_target | Decimal | — | 糖質目標（g）|
| fiber_target | Decimal | — | 食物繊維目標（g）|
| salt_target | Decimal | — | 塩分目標（g）|

- **設計**: 単一テーブル。userId がパーティションキーのためユーザー間のデータは完全に独立
- **数値精度**: DynamoDB Decimal 型で保存（Python boto3 が float ↔ Decimal を相互変換）
- **Billing**: PAY_PER_REQUEST（オンデマンド）
