import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data_processor import load_items, items_to_csv
from common import ok, err, get_user_id, get_origin, cors_headers


def handler(event, context):
    origin = get_origin(event)
    if event.get('httpMethod') == 'OPTIONS':
        return ok({}, origin)

    user_id = get_user_id(event)
    if not user_id:
        return err(401, 'Unauthorized', origin)

    items = load_items(user_id)
    if not items:
        return err(404, 'no_data', origin)

    csv_str = items_to_csv(items)
    return {
        'statusCode': 200,
        'headers': {
            **cors_headers(origin),
            'Content-Type': 'text/csv; charset=utf-8-sig',
            'Content-Disposition': 'attachment; filename="health_data.csv"',
        },
        'body': csv_str,
        'isBase64Encoded': False,
    }
