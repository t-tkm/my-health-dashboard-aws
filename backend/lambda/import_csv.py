import sys, os, json, base64, io
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data_processor import import_csv_to_dynamo
from common import ok, err, get_user_id, get_origin, log_handler


@log_handler
def handler(event, context):
    origin = get_origin(event)
    if event.get('httpMethod') == 'OPTIONS':
        return ok({}, origin)

    user_id = get_user_id(event)
    if not user_id:
        return err(401, 'Unauthorized', origin)

    body = event.get('body', '')
    if event.get('isBase64Encoded'):
        body = base64.b64decode(body)
    elif isinstance(body, str):
        body = body.encode('utf-8')

    try:
        count = import_csv_to_dynamo(user_id, io.BytesIO(body))
    except Exception as e:
        return err(400, f'CSV インポートエラー: {e}', origin)

    return ok({'imported': count}, origin)
