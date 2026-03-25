import json
import os
from pathlib import Path

from flask import Flask, Response, jsonify, send_from_directory

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / 'dist'

app = Flask(__name__, static_folder=str(DIST_DIR), static_url_path='')


def read_env(name, fallback=''):
  return os.getenv(name) or os.getenv(f'VITE_{name}', fallback)


def read_bool(name, default=False):
  raw = read_env(name, 'true' if default else 'false')
  return str(raw).strip().lower() in {'1', 'true', 'yes', 'on'}


def build_firebase_config():
  config = {
    'apiKey': read_env('FIREBASE_API_KEY'),
    'authDomain': read_env('FIREBASE_AUTH_DOMAIN'),
    'projectId': read_env('FIREBASE_PROJECT_ID'),
    'storageBucket': read_env('FIREBASE_STORAGE_BUCKET'),
    'messagingSenderId': read_env('FIREBASE_MESSAGING_SENDER_ID'),
    'appId': read_env('FIREBASE_APP_ID'),
    'measurementId': read_env('FIREBASE_MEASUREMENT_ID'),
  }
  return {key: value for key, value in config.items() if value}


def firebase_diagnostics():
  config = build_firebase_config()
  required_keys = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId']
  missing_keys = [key for key in required_keys if not config.get(key)]
  firebase_disabled = read_bool('DISABLE_FIREBASE', False)
  return {
    'firebaseConfigured': len(missing_keys) == 0,
    'firebaseDisabled': firebase_disabled,
    'firebaseConfigKeys': sorted(config.keys()),
    'missingFirebaseKeys': missing_keys,
    'appId': read_env('APP_ID', 'arcraidersmap'),
    'initialAuthTokenPresent': bool(read_env('INITIAL_AUTH_TOKEN', '')),
    'sharedRealtimeReady': not firebase_disabled and len(missing_keys) == 0,
  }


@app.get('/api/health')
def health_check():
  payload = {'status': 'ok', 'service': 'arcraiders-web'}
  payload.update(firebase_diagnostics())
  return jsonify(payload)


@app.get('/config.js')
def runtime_config():
  payload = {
    '__firebase_config': build_firebase_config(),
    '__app_id': read_env('APP_ID', 'arcraidersmap'),
    '__initial_auth_token': read_env('INITIAL_AUTH_TOKEN', ''),
    '__disable_firebase': read_bool('DISABLE_FIREBASE', False),
  }
  lines = [f'window.{key} = {json.dumps(value, ensure_ascii=False)};' for key, value in payload.items()]
  return Response('\n'.join(lines) + '\n', mimetype='application/javascript')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_client(path):
  if not DIST_DIR.exists():
    return jsonify({'status': 'error', 'message': 'Frontend build not found'}), 503

  target = DIST_DIR / path
  if path and target.is_file():
    return send_from_directory(DIST_DIR, path)
  if path and Path(path).suffix:
    return jsonify({'status': 'error', 'message': 'Asset not found'}), 404

  return send_from_directory(DIST_DIR, 'index.html')
