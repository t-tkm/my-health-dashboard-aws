import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    attrs = event.get('request', {}).get('userAttributes', {})
    logger.info(json.dumps({
        'type': 'login_success',
        'username': event.get('userName', 'unknown'),
        'userId': attrs.get('sub', 'unknown'),
        'email': attrs.get('email', ''),
        'newDeviceUsed': event.get('request', {}).get('newDeviceUsed', False),
        'triggerSource': event.get('triggerSource', ''),
        'clientId': event.get('callerContext', {}).get('clientId', ''),
    }))
    return event
