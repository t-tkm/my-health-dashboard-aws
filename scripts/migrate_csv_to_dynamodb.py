#!/usr/bin/env python3
"""
既存の data.csv を DynamoDB に移行するスクリプト。

使い方:
  # ローカル DynamoDB Local（docker-compose up 後）
  python scripts/migrate_csv_to_dynamodb.py \
      --csv data.csv \
      --user-id <cognito-user-sub> \
      --endpoint http://localhost:8000 \
      --create-table

  # 本番 AWS
  python scripts/migrate_csv_to_dynamodb.py \
      --csv data.csv \
      --user-id <cognito-user-sub> \
      --region ap-northeast-1
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import boto3
import pandas as pd
from data_processor import _to_decimal, _TARGET_FIELDS, _CSV_TO_DB


def create_table_if_needed(dynamodb, table_name: str) -> None:
    existing = [t.name for t in dynamodb.tables.all()]
    if table_name in existing:
        print(f"テーブル '{table_name}' は既に存在します。スキップします。")
        return
    table = dynamodb.create_table(
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
    table.wait_until_exists()
    print(f"テーブル '{table_name}' を作成しました。")


def migrate(csv_path: str, user_id: str, table_name: str, endpoint: str | None,
            region: str, dry_run: bool) -> None:
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
    except UnicodeDecodeError:
        df = pd.read_csv(csv_path, encoding='shift-jis')

    df.rename(columns=_CSV_TO_DB, inplace=True)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    df = df.sort_values('date').reset_index(drop=True)

    print(f"{len(df)} 件のレコードを '{table_name}' に移行します。")
    print(f"  ユーザーID : {user_id}")
    print(f"  期間       : {df['date'].iloc[0]} 〜 {df['date'].iloc[-1]}")

    if dry_run:
        print("[DRY RUN] 実際の書き込みはスキップします。")
        return

    kwargs: dict = {'region_name': region}
    if endpoint:
        kwargs['endpoint_url'] = endpoint
        kwargs['aws_access_key_id'] = 'dummy'
        kwargs['aws_secret_access_key'] = 'dummy'

    dynamodb = boto3.resource('dynamodb', **kwargs)

    if endpoint:  # ローカルのみテーブル自動作成
        create_table_if_needed(dynamodb, table_name)

    table = dynamodb.Table(table_name)
    numeric_cols = ['weight', 'calories', 'protein_g', 'fat_g', 'carb_g',
                    'sugar_g', 'fiber_g', 'salt_g'] + _TARGET_FIELDS

    written = 0
    with table.batch_writer() as batch:
        for _, row in df.iterrows():
            item: dict = {'userId': user_id, 'date': row['date']}
            for col in numeric_cols:
                if col in row and pd.notna(row[col]):
                    item[col] = _to_decimal(row[col])
            batch.put_item(Item=item)
            written += 1

    print(f"完了: {written} 件書き込みました。")


def main() -> None:
    parser = argparse.ArgumentParser(description='data.csv を DynamoDB に移行する')
    parser.add_argument('--csv',         required=True,  help='移行元 CSV ファイルパス')
    parser.add_argument('--user-id',     required=True,  help='Cognito ユーザーの sub (UUID)')
    parser.add_argument('--table',       default='health-entries', help='DynamoDB テーブル名')
    parser.add_argument('--endpoint',    default=None,   help='DynamoDB エンドポイント（ローカル用）')
    parser.add_argument('--region',      default='ap-northeast-1')
    parser.add_argument('--create-table', action='store_true', help='テーブルが無い場合に作成する（ローカル用）')
    parser.add_argument('--dry-run',     action='store_true', help='書き込みせず件数だけ確認する')
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        print(f"エラー: ファイルが見つかりません: {args.csv}", file=sys.stderr)
        sys.exit(1)

    migrate(
        csv_path=args.csv,
        user_id=args.user_id,
        table_name=args.table,
        endpoint=args.endpoint,
        region=args.region,
        dry_run=args.dry_run,
    )


if __name__ == '__main__':
    main()
