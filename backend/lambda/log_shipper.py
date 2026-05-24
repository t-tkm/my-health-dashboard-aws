import base64, gzip, json, os, boto3
from datetime import datetime, timezone

s3 = boto3.client('s3')
BUCKET = os.environ['LOG_BUCKET']

LOG_GROUP_MAP = {
    '/aws/apigateway/health-dashboard-access': 'api-gateway',
    '/aws/lambda/health-dashboard-preauth':    'lambda-preauth',
    '/aws/lambda/health-dashboard-postauth':   'lambda-postauth',
}


def handler(event, context):
    raw = base64.b64decode(event['awslogs']['data'])
    payload = json.loads(gzip.decompress(raw))

    if payload.get('messageType') == 'CONTROL_MESSAGE':
        return

    log_group = payload['logGroup']
    log_type = LOG_GROUP_MAP.get(log_group, 'unknown')

    now = datetime.now(timezone.utc)
    key = f"logs/{log_type}/{now.strftime('%Y/%m/%d')}/{now.strftime('%H%M%S%f')}-{context.aws_request_id}.ndjson"

    lines = [json.dumps({'timestamp': e['timestamp'], 'message': e['message']}) for e in payload['logEvents']]
    s3.put_object(Bucket=BUCKET, Key=key, Body=('\n'.join(lines) + '\n').encode(), ContentType='application/x-ndjson')
