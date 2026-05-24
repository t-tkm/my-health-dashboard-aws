import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json, boto3
from datetime import datetime, timedelta
from common import ok, err, get_user_id, get_origin, cors_headers, log_handler

s3 = boto3.client('s3')
BUCKET = os.environ['LOG_BUCKET']

VALID_TYPES = {'api-gateway', 'lambda-preauth', 'lambda-postauth'}


@log_handler
def handler(event, context):
    origin = get_origin(event)
    if event.get('httpMethod') == 'OPTIONS':
        return ok({}, origin)

    user_id = get_user_id(event)
    if not user_id:
        return err(401, 'Unauthorized', origin)

    params = event.get('queryStringParameters') or {}
    log_type = params.get('type', '')
    from_date = params.get('from', '')
    to_date = params.get('to', '')

    if log_type not in VALID_TYPES:
        return err(400, f'invalid type; valid: {sorted(VALID_TYPES)}', origin)

    try:
        d_from = datetime.strptime(from_date, '%Y-%m-%d')
        d_to   = datetime.strptime(to_date,   '%Y-%m-%d')
    except ValueError:
        return err(400, 'invalid date; use YYYY-MM-DD', origin)

    if d_from > d_to:
        return err(400, 'from must be <= to', origin)
    if (d_to - d_from).days > 31:
        return err(400, 'date range exceeds 31 days', origin)

    keys = []
    d = d_from
    while d <= d_to:
        prefix = f"logs/{log_type}/{d.strftime('%Y/%m/%d')}/"
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            keys.extend(obj['Key'] for obj in page.get('Contents', []))
        d += timedelta(days=1)

    if not keys:
        return err(404, 'no logs found for the specified range', origin)

    parts = []
    for key in sorted(keys):
        resp = s3.get_object(Bucket=BUCKET, Key=key)
        parts.append(resp['Body'].read().decode())

    body = ''.join(parts)
    filename = f"logs_{log_type}_{from_date}_{to_date}.ndjson"
    return {
        'statusCode': 200,
        'headers': {
            **cors_headers(origin),
            'Content-Type': 'application/x-ndjson',
            'Content-Disposition': f'attachment; filename="{filename}"',
        },
        'body': body,
        'isBase64Encoded': False,
    }
