from flask import Flask, render_template, request, redirect, url_for, send_from_directory, send_file, jsonify
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash
import os

from data_processor import DATA_CSV_PATH, import_csv, load_csv, compute, add_entry, delete_entry

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
auth = HTTPBasicAuth()

USER = os.environ.get('DASHBOARD_USER', 'test')
PASS = os.environ.get('DASHBOARD_PASS', 'pw2026@')
users = {USER: generate_password_hash(PASS)}

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')


@auth.verify_password
def verify_password(username, password):
    if username in users and check_password_hash(users[username], password):
        return username


@app.route('/')
@auth.login_required
def index():
    index_path = os.path.join(DIST_DIR, 'index.html')
    if not os.path.exists(index_path):
        return 'React build not found. Run <code>npm run build</code> first.', 404
    return send_from_directory(DIST_DIR, 'index.html')


@app.route('/assets/<path:filename>')
@auth.login_required
def assets(filename):
    return send_from_directory(os.path.join(DIST_DIR, 'assets'), filename)


@app.route('/api/data')
@auth.login_required
def api_data():
    try:
        return jsonify(compute(load_csv()))
    except FileNotFoundError:
        return jsonify({'error': 'no_data'}), 404


@app.route('/api/export')
@auth.login_required
def api_export():
    if not os.path.exists(DATA_CSV_PATH):
        return jsonify({'error': 'no_data'}), 404
    return send_file(
        DATA_CSV_PATH,
        as_attachment=True,
        download_name='health_data.csv',
        mimetype='text/csv; charset=utf-8-sig',
    )


@app.route('/api/entry', methods=['DELETE'])
@auth.login_required
def api_entry_delete():
    body = request.get_json(silent=True)
    if not body or 'date' not in body:
        return jsonify({'error': 'date は必須です'}), 400
    try:
        data = delete_entry(body['date'])
    except FileNotFoundError:
        return jsonify({'error': 'データがありません'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify(data)


@app.route('/api/entry', methods=['POST'])
@auth.login_required
def api_entry():
    body = request.get_json(silent=True)
    if not body or 'date' not in body:
        return jsonify({'error': 'date は必須です'}), 400

    date = body['date']
    weight = body.get('weight')
    nutrition_keys = ('calories', 'protein_g', 'fat_g', 'carb_g', 'sugar_g', 'fiber_g', 'salt_g')
    nutrition = {k: body[k] for k in nutrition_keys if k in body} or None

    if weight is None and not nutrition:
        return jsonify({'error': '体重か栄養素のどちらかを入力してください'}), 400

    try:
        data = add_entry(date, weight=weight, nutrition=nutrition)
    except FileNotFoundError:
        return jsonify({'error': 'データがありません。先に CSV をアップロードしてください'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify(data)


@app.route('/upload', methods=['GET', 'POST'])
@auth.login_required
def upload():
    error = None
    if request.method == 'POST':
        f = request.files.get('file')
        if not f or not f.filename:
            error = 'ファイルが選択されていません'
        elif not f.filename.lower().endswith('.csv'):
            error = '.csv ファイルを選択してください'
        else:
            try:
                import_csv(f)
                return redirect(url_for('index'))
            except Exception as e:
                error = f'処理中にエラーが発生しました: {e}'
    return render_template('upload.html', error=error)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
