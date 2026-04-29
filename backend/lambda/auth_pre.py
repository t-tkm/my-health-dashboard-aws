import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    logger.info(json.dumps({
        'type': 'login_attempt',
        'username': event.get('userName', 'unknown'),
        'triggerSource': event.get('triggerSource', ''),
        'clientId': event.get('callerContext', {}).get('clientId', ''),
    }))
    return event
