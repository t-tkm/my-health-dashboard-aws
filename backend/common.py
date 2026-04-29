import json
import logging
import os
import time

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173').split(',')


def cors_headers(origin: str | None = None) -> dict:
    allow = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    }


def ok(body: dict, origin: str | None = None) -> dict:
    return {
        'statusCode': 200,
        'headers': {**cors_headers(origin), 'Content-Type': 'application/json'},
        'body': json.dumps(body),
    }


def err(status: int, message: str, origin: str | None = None) -> dict:
    return {
        'statusCode': status,
        'headers': {**cors_headers(origin), 'Content-Type': 'application/json'},
        'body': json.dumps({'error': message}),
    }


def get_user_id(event: dict) -> str | None:
    """Cognito JWT の sub claim を返す。"""
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except (KeyError, TypeError):
        return None


def get_origin(event: dict) -> str | None:
    headers = event.get('headers') or {}
    return headers.get('origin') or headers.get('Origin')


def log_handler(func):
    """Decorator that emits a structured JSON access log for every Lambda invocation."""
    def wrapper(event, context):
        t0 = time.time()
        method = event.get('httpMethod', 'UNKNOWN')
        path = event.get('path', '/')
        user_id = get_user_id(event) or 'anonymous'
        try:
            response = func(event, context)
            logger.info(json.dumps({
                'type': 'access',
                'method': method,
                'path': path,
                'userId': user_id,
                'status': response.get('statusCode', 0),
                'durationMs': round((time.time() - t0) * 1000, 1),
            }))
            return response
        except Exception as e:
            logger.error(json.dumps({
                'type': 'error',
                'method': method,
                'path': path,
                'userId': user_id,
                'error': str(e),
                'durationMs': round((time.time() - t0) * 1000, 1),
            }))
            raise
    return wrapper
