#!/usr/bin/env python3
"""1年分のダミーデータを DynamoDB Local に投入する。

Usage:
    # docker-compose up 後に実行
    DYNAMODB_ENDPOINT=http://localhost:8000 \
    python scripts/generate_dummy.py --user-id dummy-user-001 --create-table
"""
import argparse
import math
import os
import random
import sys
from datetime import date, timedelta

import boto3
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from data_processor import _to_decimal, _TARGET_FIELDS, TABLE_NAME

random.seed(42)
np.random.seed(42)

N_DAYS = 365
TODAY = date.today()
START = TODAY - timedelta(days=N_DAYS - 1)
DATES = [(START + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(N_DAYS)]

WEIGHT_START = 80.0
WEIGHT_END   = 73.5

TARGETS = {
    'cal_target':     1750,
    'protein_target': 95,
    'fat_target':     85,
    'carb_target':    172,
    'sugar_target':   138,
    'fiber_target':   21,
    'salt_target':    7.5,
}


def build_items(user_id: str) -> list[dict]:
    raw_weights = []
    for i in range(N_DAYS):
        progress = i / (N_DAYS - 1)
        trend   = WEIGHT_START + (WEIGHT_END - WEIGHT_START) * (1 - math.exp(-3 * progress))
        weekday = (START + timedelta(days=i)).weekday()
        weekly  = 0.25 * math.sin(2 * math.pi * weekday / 7)
        noise   = random.gauss(0, 0.25)
        raw_weights.append(trend + weekly + noise)

    weights = []
    for i in range(N_DAYS):
        s = max(0, i - 1)
        e = min(N_DAYS, i + 2)
        weights.append(round(sum(raw_weights[s:e]) / (e - s), 1))

    items = []
    for i, d in enumerate(DATES):
        weekday = (START + timedelta(days=i)).weekday()
        cal_base = 1750 + (200 if weekday >= 5 else 0)
        cal = max(800, round(random.gauss(cal_base, 200)))
        scale = cal / 1750
        item = {
            'userId':  user_id,
            'date':    d,
            'weight':  _to_decimal(weights[i]),
            'calories':  _to_decimal(float(cal)),
            'protein_g': _to_decimal(round(max(40,  random.gauss(95 * scale, 15)), 1)),
            'fat_g':     _to_decimal(round(max(20,  random.gauss(85 * scale, 12)), 1)),
            'carb_g':    _to_decimal(round(max(50,  random.gauss(172 * scale, 30)), 1)),
            'sugar_g':   _to_decimal(round(max(30,  random.gauss(138 * scale, 25)), 1)),
            'fiber_g':   _to_decimal(round(max(5,   random.gauss(21, 4)), 1)),
            'salt_g':    _to_decimal(round(max(1,   random.gauss(7.5 * scale, 2)), 1)),
            **{k: _to_decimal(v) for k, v in TARGETS.items()},
        }
        items.append(item)
    return items


def create_table(dynamodb, table_name: str) -> None:
    existing = [t.name for t in dynamodb.tables.all()]
    if table_name in existing:
        print(f"テーブル '{table_name}' は既に存在します。")
        return
    t = dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'userId', 'KeyType': 'HASH'},
            {'AttributeName': 'date',   'KeyType': 'RANGE'},
        ],
        AttributeDefinitions=[
            {'AttributeName': 'userId', 'AttributeType': 'S'},
            {'AttributeName': 'date',   'AttributeType': 'S'},
        ],
        BillingMode='PAY_PER_REQUEST',
    )
    t.wait_until_exists()
    print(f"テーブル '{table_name}' を作成しました。")


def main() -> None:
    parser = argparse.ArgumentParser(description='DynamoDB Local にダミーデータを投入する')
    parser.add_argument('--user-id',     default='dummy-user-001')
    parser.add_argument('--table',       default=TABLE_NAME)
    parser.add_argument('--endpoint',    default=os.environ.get('DYNAMODB_ENDPOINT', 'http://localhost:8000'))
    parser.add_argument('--region',      default='us-east-1')
    parser.add_argument('--create-table', action='store_true')
    args = parser.parse_args()

    # boto3 はプロファイル（SSO 含む）をロードしようとするため、
    # ローカル接続時は環境変数で静的ダミー認証情報を強制セットして SSO をバイパスする
    os.environ['AWS_ACCESS_KEY_ID'] = 'dummy'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'dummy'
    os.environ.pop('AWS_PROFILE', None)
    os.environ.pop('AWS_DEFAULT_PROFILE', None)

    dynamodb = boto3.resource(
        'dynamodb',
        endpoint_url=args.endpoint,
        region_name=args.region,
    )

    if args.create_table:
        create_table(dynamodb, args.table)

    table = dynamodb.Table(args.table)
    items = build_items(args.user_id)

    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)

    print(f'{N_DAYS} 件のダミーデータを userId={args.user_id} で投入しました。')
    print(f'  体重: {float(items[0]["weight"]):.1f} → {float(items[-1]["weight"]):.1f} kg')


if __name__ == '__main__':
    main()
