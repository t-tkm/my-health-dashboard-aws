# Component Methods

詳細なビジネスロジックは CONSTRUCTION フェーズの Functional Design に委ねる。
ここではメソッドシグネチャと概要を定義する。

---

## C-05: DataAPIClient

| メソッド | シグネチャ | 目的 |
|---|---|---|
| getIdToken | `() => Promise<string>` | Cognito ID Token（JWT）を取得する |
| apiFetch | `(path: string, init?: RequestInit) => Promise<Response>` | Authorization ヘッダー付きで API を呼び出す |
| useHealthData | `() => { data, loading, error, isEmpty, refresh }` | /api/data のデータ取得状態を管理するカスタムフック |
| filterData | `(data: HealthData, range: RangeDays) => HealthData` | 表示期間でデータを絞り込む |
| xInterval | `(n: number) => number` | データ件数に応じた X 軸ラベル間隔を算出する |

---

## C-06: LambdaHandlers

| ハンドラー | シグネチャ | 目的 |
|---|---|---|
| data.handler | `(event, context) => dict` | GET /api/data: 全レコード取得 + 集計 |
| entry.handler | `(event, context) => dict` | POST/DELETE /api/entry: レコード追加/更新/削除 |
| export.handler | `(event, context) => dict` | GET /api/export: CSV ダウンロード |
| import_csv.handler | `(event, context) => dict` | POST /api/import: CSV 一括インポート |

---

## C-07: HealthDataProcessor

| メソッド | シグネチャ | 目的 |
|---|---|---|
| load_items | `(user_id: str) -> list[dict]` | DynamoDB から全レコードを日付昇順で取得（ページネーション対応）|
| put_entry | `(user_id, date, weight, nutrition, targets) -> None` | 1日分レコードを追加/更新（upsert）|
| delete_entry | `(user_id: str, date: str) -> None` | 指定日のレコードを削除 |
| compute | `(items: list[dict]) -> dict` | HealthData dict を生成（SMA / 線形回帰 / 欠損値補間）|
| items_to_csv | `(items: list[dict]) -> str` | DynamoDB items を CSV 文字列（UTF-8 BOM付き）に変換 |
| import_csv_to_dynamo | `(user_id: str, file_storage) -> int` | CSV ファイルを DynamoDB に一括インポート。件数を返す |

### compute() の出力キー

| キー | 型 | 説明 |
|---|---|---|
| dates | str[] | YYYY-MM-DD の日付配列 |
| weights | float[] | 体重（欠損値を線形補間済み）|
| sma7 | float[] | 7日単純移動平均 |
| slope_dates | str[] | 週次サンプリング日 |
| slope_values | float[] | 30日線形回帰の傾き（kg/日）|
| calories〜salt_gram | float[] | 各栄養素配列 |
| cal_target〜salt_target | float | 各目安値（最後の非欠損値）|
| current_weight | float | 最新体重 |
| sma7_start / sma7_end | float | 期間両端のSMA値 |
| weight_diff | float | sma7_start − sma7_end（正=減量）|
| avg_cal | int | 平均摂取カロリー |
| record_days | int | データ日数 |
| weight_min / weight_max | float | グラフY軸範囲（±1kgマージン）|
