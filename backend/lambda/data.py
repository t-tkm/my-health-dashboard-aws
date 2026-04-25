import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data_processor import load_items, compute
from common import ok, err, get_user_id, get_origin


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

    return ok(compute(items), origin)
