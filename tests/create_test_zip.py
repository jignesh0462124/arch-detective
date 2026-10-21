"""Create a test ZIP file from the sample codebase for workspace testing."""
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent.parent

sample_dir = ROOT / "tests" / "sample-codebase"
out_zip = ROOT / "tests" / "test-project.zip"

if not sample_dir.exists():
    # Create minimal vulnerable sample files
    sample_dir.mkdir(parents=True, exist_ok=True)

    (sample_dir / "app.py").write_text(
        """import os
import sqlite3
import subprocess

# Hardcoded credentials - BAD
SECRET_KEY = "hardcoded-secret-key-12345"
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
DB_PASSWORD = "admin123"

def get_user(username):
    \"\"\"Vulnerable to SQL injection.\"\"\"
    db = sqlite3.connect("users.db")
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    return db.execute(query).fetchall()

def run_command(user_input):
    \"\"\"Vulnerable to command injection.\"\"\"
    os.system("echo " + user_input)
    subprocess.run(user_input, shell=True)

def read_file(filename):
    \"\"\"Vulnerable to path traversal.\"\"\"
    with open("/var/data/" + filename) as f:
        return f.read()

def login(username, password):
    \"\"\"Insecure password comparison (timing attack).\"\"\"
    stored = "admin123"
    return password == stored
""",
        encoding="utf-8",
    )

    (sample_dir / "config.yaml").write_text(
        """database:
  host: localhost
  port: 5432
  password: supersecret123
  username: admin

redis:
  url: redis://localhost:6379
  password: redis-password-123

aws:
  region: us-east-1
  access_key_id: AKIAIOSFODNN7EXAMPLE
  secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
""",
        encoding="utf-8",
    )

    (sample_dir / "api" / "routes.py").write_text(
        """from flask import Flask, request, render_template_string
import pickle

app = Flask(__name__)

@app.route("/search")
def search():
    \"\"\"Vulnerable to XSS.\"\"\"
    q = request.args.get("q", "")
    template = f"<h1>Results for: {q}</h1>"  # XSS - no escaping
    return render_template_string(template)

@app.route("/load", methods=["POST"])
def load_data():
    \"\"\"Insecure deserialization.\"\"\"
    data = request.data
    obj = pickle.loads(data)  # Dangerous!
    return str(obj)

@app.route("/admin")
def admin():
    \"\"\"Missing authentication check.\"\"\"
    # No auth check - anyone can access admin panel
    return "Admin panel"
""",
        encoding="utf-8",
    )
    (sample_dir / "api").mkdir(parents=True, exist_ok=True)
    (sample_dir / "api" / "routes.py").write_text(
        """from flask import Flask, request, render_template_string
import pickle

app = Flask(__name__)

@app.route("/search")
def search():
    q = request.args.get("q", "")
    template = f"<h1>Results for: {q}</h1>"
    return render_template_string(template)

@app.route("/load", methods=["POST"])
def load_data():
    data = request.data
    obj = pickle.loads(data)
    return str(obj)
""",
        encoding="utf-8",
    )

with zipfile.ZipFile(str(out_zip), "w", zipfile.ZIP_DEFLATED) as zf:
    for f in sample_dir.rglob("*"):
        if f.is_file():
            zf.write(f, f.relative_to(sample_dir.parent))

size = out_zip.stat().st_size
print(f"Created {out_zip} ({size:,} bytes)")
print(f"Files inside:")
with zipfile.ZipFile(str(out_zip)) as zf:
    for name in zf.namelist():
        print(f"  {name}")
