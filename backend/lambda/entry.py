import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data_processor import load_items, compute, put_entry, delete_entry
from common import ok, err, get_user_id, get_origin


def handler(event, context):
    origin = get_origin(event)
    method = event.get('httpMethod', '')

    if method == 'OPTIONS':
        return ok({}, origin)

    user_id = get_user_id(event)
    if not user_id:
        return err(401, 'Unauthorized', origin)

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except ValueError:
            return err(400, 'Invalid JSON', origin)

    if 'date' not in body:
        return err(400, 'date は必須です', origin)

    date = body['date']

    if method == 'DELETE':
        delete_entry(user_id, date)
        items = load_items(user_id)
        return ok(compute(items) if items else {}, origin)

    if method == 'POST':
        weight = body.get('weight')
        nutrition_keys = ('calories', 'protein_g', 'fat_g', 'carb_g', 'sugar_g', 'fiber_g', 'salt_g')
        nutrition = {k: body[k] for k in nutrition_keys if k in body} or None
        target_keys = ('cal_target', 'protein_target', 'fat_target', 'carb_target',
                       'sugar_target', 'fiber_target', 'salt_target')
        targets = {k: body[k] for k in target_keys if k in body} or None

        if weight is None and not nutrition:
            return err(400, '体重か栄養素のどちらかを入力してください', origin)

        put_entry(user_id, date, weight=weight, nutrition=nutrition, targets=targets)
        items = load_items(user_id)
        return ok(compute(items), origin)

    return err(405, 'Method Not Allowed', origin)
