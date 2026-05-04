import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data_processor import load_items, compute, put_entry, delete_entry
from common import ok, err, get_user_id, get_origin, log_handler


@log_handler
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
        weight           = body.get('weight')
        body_fat_percent = body.get('body_fat_percent')
        nutrition_keys = ('calories', 'protein_g', 'fat_g', 'carb_g', 'sugar_g', 'fiber_g', 'salt_g')
        target_keys = ('cal_target', 'protein_target', 'fat_target', 'carb_target',
                       'sugar_target', 'fiber_target', 'salt_target')
        targets = {k: body[k] for k in target_keys if k in body} or None

        # Fields explicitly set to null mean "clear this field"
        clear_fields = set()
        if 'weight' in body and body['weight'] is None:
            clear_fields.add('weight')
        if 'body_fat_percent' in body and body['body_fat_percent'] is None:
            clear_fields.add('body_fat_percent')
        for k in nutrition_keys:
            if k in body and body[k] is None:
                clear_fields.add(k)

        nutrition = {k: body[k] for k in nutrition_keys if k in body and body[k] is not None} or None

        data_fields = ['weight', 'body_fat_percent'] + list(nutrition_keys)
        if not any(k in body for k in data_fields):
            return err(400, '体重か体脂肪率か栄養素のいずれかを入力してください', origin)

        put_entry(user_id, date, weight=weight, body_fat_percent=body_fat_percent,
                  nutrition=nutrition, targets=targets, clear_fields=clear_fields)
        items = load_items(user_id)
        return ok(compute(items), origin)

    return err(405, 'Method Not Allowed', origin)
