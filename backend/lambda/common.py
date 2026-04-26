import json
import os

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
