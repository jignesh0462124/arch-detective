"""
Sample vulnerable Flask application.
WARNING: This file is intentionally insecure for testing ThreatLens scanner.
DO NOT deploy this code in production.
"""
import hashlib
import os
import subprocess
import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)

# CWE-798: Hardcoded credentials
SECRET_KEY = "super_secret_hardcoded_key_12345"
ADMIN_PASSWORD = "admin123"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
DB_PASSWORD = "postgres_prod_pass_9876"

app.secret_key = SECRET_KEY


@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username")
    password = request.form.get("password")

    # CWE-89: SQL Injection — unsanitised user input in raw SQL
    conn = sqlite3.connect("users.db")
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor = conn.execute(query)
    user = cursor.fetchone()

    if user:
        return jsonify({"status": "ok", "user": username})
    return jsonify({"status": "error"}), 401


@app.route("/ping", methods=["GET"])
def ping():
    # CWE-78: Command injection — user input passed directly to shell
    host = request.args.get("host", "localhost")
    result = subprocess.check_output(f"ping -c 1 {host}", shell=True)
    return result.decode()


@app.route("/user/<user_id>", methods=["GET"])
def get_user(user_id):
    conn = sqlite3.connect("users.db")
    # CWE-89: Second SQL injection — f-string in query
    row = conn.execute(f"SELECT * FROM users WHERE id={user_id}").fetchone()
    return jsonify({"user": row})


@app.route("/hash", methods=["POST"])
def hash_password():
    password = request.json.get("password", "")
    # CWE-328: Use of weak cryptographic hash (MD5)
    hashed = hashlib.md5(password.encode()).hexdigest()
    return jsonify({"hash": hashed})


@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "")
    # CWE-79: Reflected XSS — unsanitised user input echoed into HTML
    html = f"<html><body><h1>Results for: {query}</h1></body></html>"
    return html


@app.route("/debug", methods=["GET"])
def debug_info():
    # CWE-200: Exposure of sensitive information
    return jsonify({
        "env": dict(os.environ),
        "secret_key": SECRET_KEY,
        "db_password": DB_PASSWORD,
    })


if __name__ == "__main__":
    # Debug mode enabled — exposes interactive debugger
    app.run(debug=True, host="0.0.0.0", port=5000)
