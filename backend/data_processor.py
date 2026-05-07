import os
import io
import csv
import numpy as np
import pandas as pd
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

TABLE_NAME = os.environ.get('TABLE_NAME', 'health-entries')
DYNAMODB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT')  # set to http://localhost:8000 for local

_NUTRITION_MAP = {
    'calories':  'calories',
    'protein_g': 'protein_g',
    'fat_g':     'fat_g',
    'carb_g':    'carb_g',
    'sugar_g':   'sugar_g',
    'fiber_g':   'fiber_g',
    'salt_g':    'salt_g',
}

_TARGET_FIELDS = ['cal_target', 'protein_target', 'fat_target', 'carb_target',
                  'sugar_target', 'fiber_target', 'salt_target']

# CSV column name -> DynamoDB attribute name
_CSV_TO_DB = {
    '日付': 'date', '体重': 'weight', '体脂肪率': 'body_fat_percent',
    'カロリー': 'calories', 'たんぱく質': 'protein_g', '脂質': 'fat_g',
    '炭水化物': 'carb_g', '糖質': 'sugar_g', '食物繊維': 'fiber_g', '塩分': 'salt_g',
    'カロリー(目安)': 'cal_target', 'たんぱく質(目安)': 'protein_target',
    '脂質(目安)': 'fat_target', '炭水化物(目安)': 'carb_target',
    '糖質(目安)': 'sugar_target', '食物繊維(目安)': 'fiber_target',
    '塩分(目安)': 'salt_target',
}


def _get_table():
    kwargs = dict(region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    if DYNAMODB_ENDPOINT:
        kwargs['endpoint_url'] = DYNAMODB_ENDPOINT
        # ローカル接続時は環境変数でダミー認証情報を強制セットし、
        # SSO 設定済みプロファイルの読み込みをバイパスする
        os.environ['AWS_ACCESS_KEY_ID'] = 'dummy'
        os.environ['AWS_SECRET_ACCESS_KEY'] = 'dummy'
        os.environ.pop('AWS_PROFILE', None)
        os.environ.pop('AWS_DEFAULT_PROFILE', None)
    return boto3.resource('dynamodb', **kwargs).Table(TABLE_NAME)


def _to_decimal(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return Decimal(str(round(float(v), 4)))


def _from_decimal(v):
    if v is None:
        return None
    return float(v)


def load_items(user_id: str) -> list[dict]:
    """DynamoDB からユーザの全レコードを日付昇順で返す。"""
    table = _get_table()
    resp = table.query(
        KeyConditionExpression=Key('userId').eq(user_id),
        ScanIndexForward=True,
    )
    items = resp['Items']
    while 'LastEvaluatedKey' in resp:
        resp = table.query(
            KeyConditionExpression=Key('userId').eq(user_id),
            ExclusiveStartKey=resp['LastEvaluatedKey'],
            ScanIndexForward=True,
        )
        items.extend(resp['Items'])
    return [{k: _from_decimal(v) if isinstance(v, Decimal) else v for k, v in item.items()}
            for item in items]


def _items_to_df(items: list[dict]) -> pd.DataFrame:
    """DynamoDB items -> DataFrame（compute() 用）"""
    if not items:
        return pd.DataFrame()
    df = pd.DataFrame(items)
    df = df.sort_values('date').reset_index(drop=True)
    numeric_cols = ['weight', 'body_fat_percent', 'calories', 'protein_g', 'fat_g', 'carb_g',
                    'sugar_g', 'fiber_g', 'salt_g'] + _TARGET_FIELDS
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        else:
            df[col] = np.nan
    return df


def _rolling_slope(series: pd.Series, window: int = 30) -> list:
    slopes = []
    arr = series.values
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        y = arr[start: i + 1]
        if len(y) < 2:
            slopes.append(None)
        else:
            x = np.arange(len(y))
            slopes.append(round(float(np.polyfit(x, y, 1)[0]), 4))
    return slopes


def compute(items: list[dict]) -> dict:
    """DynamoDB items から React 用 API dict を生成する。"""
    df = _items_to_df(items)
    if df.empty:
        return {'error': 'no_data'}

    # 体脂肪率SMAはfillna(0)の前に計算（欠損日を0として扱わないため）
    bf_series = df['body_fat_percent'] if 'body_fat_percent' in df.columns else pd.Series(
        [np.nan] * len(df), index=df.index)
    bf_series = pd.to_numeric(bf_series, errors='coerce')
    sma7_bf = bf_series.rolling(window=7, min_periods=1).mean().round(2)

    df['weight'] = pd.to_numeric(df['weight'], errors='coerce')
    raw_weight_series = df['weight'].copy()  # NaN where no data recorded
    df['weight'] = df['weight'].interpolate(method='linear')
    for t in _TARGET_FIELDS:
        df[t] = df[t].ffill()
    df = df.fillna(0)

    calories = df['calories'].tolist()
    sma7     = df['weight'].rolling(window=7, min_periods=1).mean().round(2).tolist()

    # nullable weights for display (null where no data, not interpolated)
    raw_weights = [None if (isinstance(v, float) and np.isnan(v)) else round(float(v), 1)
                   for v in raw_weight_series.tolist()]
    actual_weights = [w for w in raw_weights if w is not None]

    all_slopes = _rolling_slope(df['weight'], window=30)
    weekly_idx = list(range(6, len(df), 7))
    if len(df) - 1 not in weekly_idx:
        weekly_idx.append(len(df) - 1)

    def _nullable_list(series: pd.Series) -> list:
        return [round(float(v), 2) if not (isinstance(v, float) and np.isnan(v)) else None
                for v in series.tolist()]

    # 体脂肪サマリー（有効値のみ）
    bf_valid_idx   = bf_series.dropna().index
    sma7_bf_valid  = sma7_bf.dropna()
    current_body_fat       = round(float(bf_series.loc[bf_valid_idx[-1]]), 1) if len(bf_valid_idx) > 0 else None
    sma7_bf_start          = round(float(sma7_bf_valid.iloc[0]),  1) if len(sma7_bf_valid) > 0 else None
    sma7_bf_end            = round(float(sma7_bf_valid.iloc[-1]), 1) if len(sma7_bf_valid) > 0 else None
    sma7_bf_start_date     = df['date'].iloc[sma7_bf_valid.index[0]]  if len(sma7_bf_valid) > 0 else None
    sma7_bf_end_date       = df['date'].iloc[sma7_bf_valid.index[-1]] if len(sma7_bf_valid) > 0 else None
    body_fat_diff          = (round(sma7_bf_start - sma7_bf_end, 1)
                              if sma7_bf_start is not None and sma7_bf_end is not None else None)

    return {
        'dates':                  df['date'].tolist(),
        'weights':                raw_weights,
        'calories':               calories,
        'sma7':                   sma7,
        'body_fat_percents':      _nullable_list(bf_series.round(1)),
        'sma7_body_fat':          _nullable_list(sma7_bf),
        'current_body_fat':       current_body_fat,
        'sma7_body_fat_start':    sma7_bf_start,
        'sma7_body_fat_end':      sma7_bf_end,
        'sma7_body_fat_start_date': sma7_bf_start_date,
        'sma7_body_fat_end_date':   sma7_bf_end_date,
        'body_fat_diff':          body_fat_diff,
        'slope_dates':    [df['date'].iloc[i] for i in weekly_idx],
        'slope_values':   [all_slopes[i] for i in weekly_idx],
        'protein_gram':   df['protein_g'].round(1).tolist(),
        'fat_gram':       df['fat_g'].round(1).tolist(),
        'carb_gram':      df['carb_g'].round(1).tolist(),
        'sugar_gram':     df['sugar_g'].round(1).tolist(),
        'fiber_gram':     df['fiber_g'].round(1).tolist(),
        'salt_gram':      df['salt_g'].round(1).tolist(),
        'cal_target':     df['cal_target'].round(1).tolist(),
        'protein_target': df['protein_target'].round(1).tolist(),
        'fat_target':     df['fat_target'].round(1).tolist(),
        'carb_target':    df['carb_target'].round(1).tolist(),
        'sugar_target':   df['sugar_target'].round(1).tolist(),
        'fiber_target':   df['fiber_target'].round(1).tolist(),
        'salt_target':    df['salt_target'].round(1).tolist(),
        'current_weight':  actual_weights[-1] if actual_weights else float(round(sma7[-1], 1)),
        'sma7_start':      float(round(sma7[0], 1)),
        'sma7_end':        float(round(sma7[-1], 1)),
        'sma7_start_date': df['date'].iloc[0],
        'sma7_end_date':   df['date'].iloc[-1],
        'weight_diff':     float(round(sma7[0] - sma7[-1], 1)),
        'avg_cal':         int(sum(calories) / len(calories)) if calories else 0,
        'record_days':     int(len(df)),
        'weight_min':      float(round(min(actual_weights) - 1, 1)) if actual_weights else 0.0,
        'weight_max':      float(round(max(actual_weights) + 1, 1)) if actual_weights else 100.0,
    }


def put_entry(user_id: str, date: str, weight=None, body_fat_percent=None,
              nutrition: dict | None = None, targets: dict | None = None,
              clear_fields: set | None = None) -> None:
    """1日分を追加/更新する。存在しない日は前日のターゲット値を引き継ぐ。"""
    clear_fields = clear_fields or set()
    table = _get_table()

    existing = table.get_item(Key={'userId': user_id, 'date': date}).get('Item', {})

    items = load_items(user_id)
    last_item = items[-1] if items else {}

    item: dict = {'userId': user_id, 'date': date}

    for field in ['weight', 'body_fat_percent'] + list(_NUTRITION_MAP.keys()):
        db_key = field
        if field == 'weight':
            val = weight
        elif field == 'body_fat_percent':
            val = body_fat_percent
        elif nutrition:
            val = nutrition.get(field)
        else:
            val = None
        if val is not None:
            item[db_key] = _to_decimal(val)
        elif field not in clear_fields and db_key in existing:
            item[db_key] = existing[db_key]

    for t in _TARGET_FIELDS:
        if targets and t in targets:
            item[t] = _to_decimal(targets[t])
        elif t in existing:
            item[t] = existing[t]
        elif t in last_item and last_item[t] is not None:
            item[t] = _to_decimal(last_item[t])

    table.put_item(Item=item)


def delete_entry(user_id: str, date: str) -> None:
    _get_table().delete_item(Key={'userId': user_id, 'date': date})


def items_to_csv(items: list[dict]) -> str:
    """DynamoDB items → CSV 文字列（UTF-8 BOM付き）"""
    fieldnames = ['date', 'weight', 'body_fat_percent', 'calories', 'protein_g', 'fat_g', 'carb_g',
                  'sugar_g', 'fiber_g', 'salt_g'] + _TARGET_FIELDS
    buf = io.StringIO()
    buf.write('﻿')  # UTF-8 BOM (Excel 用)
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    for item in sorted(items, key=lambda x: x['date']):
        writer.writerow({k: item.get(k, '') for k in fieldnames})
    return buf.getvalue()


def import_csv_to_dynamo(user_id: str, file_storage) -> int:
    """CSV ファイルを DynamoDB に一括インポートする。件数を返す。"""
    try:
        df = pd.read_csv(file_storage, encoding='utf-8-sig')
    except UnicodeDecodeError:
        if hasattr(file_storage, 'seek'):
            file_storage.seek(0)
        df = pd.read_csv(file_storage, encoding='shift-jis')

    df.rename(columns=_CSV_TO_DB, inplace=True)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')

    numeric_cols = [v for v in _CSV_TO_DB.values() if v != 'date']

    table = _get_table()
    with table.batch_writer() as batch:
        for _, row in df.iterrows():
            item = {'userId': user_id, 'date': row['date']}
            for col in numeric_cols:
                if col not in df.columns:
                    continue
                val = row.get(col)
                if pd.notna(val):
                    item[col] = _to_decimal(val)
            batch.put_item(Item=item)
    return len(df)
