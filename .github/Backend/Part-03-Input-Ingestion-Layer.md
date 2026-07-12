# Part 3 — Input Ingestion Layer

> **Timeline:** Weeks 4–5 (parallel with Part 4)  
> **Priority:** 🟠 High  
> **Dependencies:** Part 1 (FastAPI running)  

---

## 3.1 Objective

Build the input ingestion layer that accepts user uploads (ZIP codebases, Git URLs, YAML/JSON architecture files, `.log` server logs), extracts/parses them, and prepares them for scanning.

---

## 3.2 Files to Create

| File | Purpose |
|------|---------|
| `threatlens/app/ingestion/__init__.py` | Module init |
| `threatlens/app/ingestion/code_extractor.py` | ZIP extraction, Git cloning, source file collector |
| `threatlens/app/ingestion/arch_parser.py` | YAML/JSON architecture parser |
| `threatlens/app/ingestion/log_parser.py` | Log file parser (`.log`, structured logs) |

---

## 3.3 Implementation Details

### 3.3.1 Code Extractor (`app/ingestion/code_extractor.py`)

Three main functions:

**`extract_from_zip(zip_path)`** — Extracts ZIP to temp directory, returns path  
**`extract_from_git(git_url)`** — Shallow clones repo (`depth=1`), returns path  
**`collect_source_files(repo_path)`** — Walks directory tree, collects all source files

**Supported extensions:**
```python
SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
    ".rb", ".php", ".cs", ".cpp", ".c", ".rs", ".yaml",
    ".yml", ".json", ".env", ".toml", ".cfg", ".ini",
    ".sh", ".bash", ".dockerfile", ".tf"
}
```

**Excluded directories:**
```python
EXCLUDED_DIRS = {
    "node_modules", ".git", "venv", "__pycache__",
    ".pytest_cache", "dist", "build", ".next"
}
```

**Output per file:**
```python
{
    "path": "/src/auth/login.py",      # relative path
    "content": "import jwt\n...",       # full file content
    "language": "py",                    # file extension
    "size_bytes": 2456,                  # file size
}
```

### 3.3.2 Architecture Parser (`app/ingestion/arch_parser.py`)

Parses YAML/JSON architecture definitions and extracts:
- Service names and ports
- Database connections
- External API endpoints
- Network topology
- Container configurations (Docker/K8s)

```python
def parse_architecture(file_content: str, file_type: str) -> dict:
    """
    Parse YAML/JSON architecture file.
    Returns structured service topology.
    """
    if file_type in ("yaml", "yml"):
        data = yaml.safe_load(file_content)
    else:
        data = json.loads(file_content)
    
    return {
        "services": extract_services(data),
        "exposed_ports": extract_ports(data),
        "databases": extract_databases(data),
        "network_config": extract_network(data),
    }
```

### 3.3.3 Log Parser (`app/ingestion/log_parser.py`)

Handles multiple log formats:
- Apache/Nginx access logs
- Application JSON logs
- Syslog format
- Custom timestamped logs

```python
def parse_log_file(content: str) -> list[dict]:
    """Parse log file into structured entries."""
    lines = content.strip().split("\n")
    entries = []
    for line in lines:
        entry = try_parse_json(line) or try_parse_apache(line) or try_parse_syslog(line)
        if entry:
            entries.append(entry)
    return entries
```

---

## 3.4 Frontend Connection Points

| Backend | Frontend |
|---------|----------|
| `POST /api/v1/scan` (file upload) | New Scan page — file upload dropzone |
| `POST /api/v1/scan` (git_url) | New Scan page — Git URL text input |
| File size validation (MAX_FILE_SIZE_MB) | Frontend file size check before upload |
| Supported scan types | Scan type selector (codebase / architecture / logs / full) |

### Frontend Integration — New Scan Page

The `new-scan.tsx` page needs:

```typescript
// File upload handler
const handleFileUpload = async (file: File, scanType: string, frameworks: string[]) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scan_type", scanType);
  frameworks.forEach(fw => formData.append("frameworks", fw));
  
  const res = await fetch(`${API_BASE}/api/v1/scan`, {
    method: "POST",
    body: formData,
  });
  const { scan_id } = await res.json();
  // Navigate to scan status page
};

// Git URL handler
const handleGitScan = async (gitUrl: string, scanType: string, frameworks: string[]) => {
  const res = await fetch(`${API_BASE}/api/v1/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scan_type: scanType, git_url: gitUrl, frameworks }),
  });
  const { scan_id } = await res.json();
  // Navigate to scan status page
};
```

---

## 3.5 Verification Checklist

- [ ] ZIP upload extracts successfully to temp directory
- [ ] Git clone works with public repo URLs (e.g., a test Flask app)
- [ ] Source file collector finds `.py`, `.js`, `.ts` files correctly
- [ ] Excluded directories (node_modules, .git, venv) are skipped
- [ ] YAML architecture file parses and extracts services/ports
- [ ] JSON architecture file parses correctly
- [ ] Log parser handles Apache-format logs
- [ ] Log parser handles JSON-structured logs
- [ ] File size validation rejects files > MAX_FILE_SIZE_MB
- [ ] Frontend file upload triggers backend correctly

---

## 3.6 Security Notes

- **ZIP bomb protection:** Check extracted size vs compressed size ratio (max 100x)
- **Path traversal:** Sanitize all extracted file paths — reject `../` patterns
- **Git URL validation:** Only allow `https://` URLs, block `file://` and `ssh://`
- **Temp directory cleanup:** Delete temp directories after scan completion
- **File type validation:** Verify MIME type matches expected format
- **Max file count:** Cap extracted files at 1000 to prevent DoS
