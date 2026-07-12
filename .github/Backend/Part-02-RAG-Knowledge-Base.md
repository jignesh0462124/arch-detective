# Part 2 — RAG Knowledge Base (All 5 Compliance Frameworks)

> **Timeline:** Weeks 2–3  
> **Priority:** 🔴 Critical (blocks compliance mapping in Part 5)  
> **Dependencies:** Part 1 (Docker services running, Qdrant accessible)  

---

## 2.1 Objective

Build the complete RAG (Retrieval-Augmented Generation) pipeline: download compliance framework documents, chunk them per article/control, embed with `all-MiniLM-L6-v2`, upsert into Qdrant, and build the retrieval function that every subsequent scan uses.

---

## 2.2 Files to Create

| File | Purpose |
|------|---------|
| `threatlens/app/rag/__init__.py` | Module init |
| `threatlens/app/rag/embedder.py` | `SentenceTransformer` wrapper, encode function |
| `threatlens/app/rag/qdrant_client.py` | Qdrant connection, collection creation |
| `threatlens/app/rag/retriever.py` | `retrieve_relevant_controls()` — cosine search |
| `threatlens/app/rag/chunkers/__init__.py` | Chunker exports |
| `threatlens/app/rag/chunkers/gdpr_chunker.py` | GDPR article chunker |
| `threatlens/app/rag/chunkers/soc2_chunker.py` | SOC 2 control chunker |
| `threatlens/app/rag/chunkers/iso27001_chunker.py` | ISO 27001 Annex A chunker |
| `threatlens/app/rag/chunkers/pci_chunker.py` | PCI DSS v4.0 requirement chunker |
| `threatlens/app/rag/chunkers/nist_chunker.py` | NIST CSF 2.0 subcategory chunker |
| `threatlens/app/rag/chunkers/cve_chunker.py` | NVD CVE data chunker |
| `threatlens/app/rag/chunkers/owasp_chunker.py` | OWASP Top 10 category chunker |
| `threatlens/scripts/seed_rag.py` | One-time seeding script |
| `threatlens/scripts/sync_nvd.py` | Weekly CVE sync cron |
| `threatlens/data/` | Directory for framework PDFs |

---

## 2.3 Implementation Details

### 2.3.1 Embedder (`app/rag/embedder.py`)

```python
from sentence_transformers import SentenceTransformer

# Load once at module level — singleton pattern
_model = None

def get_encoder() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def encode_text(text: str) -> list[float]:
    return get_encoder().encode(text).tolist()
```

- **Model:** `all-MiniLM-L6-v2` → 384-dimension vectors
- **Singleton pattern** to avoid reloading 90MB model per request

### 2.3.2 Qdrant Collection Setup (`app/rag/qdrant_client.py`)

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from app.config import settings

def get_qdrant():
    return QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)

def create_collection():
    client = get_qdrant()
    client.recreate_collection(
        collection_name=settings.QDRANT_COLLECTION,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )
```

### 2.3.3 Chunking Strategy

Each framework is chunked by its logical unit:

| Framework | Chunk Unit | Key IDs | ~Chunk Count |
|-----------|-----------|---------|-------------|
| GDPR | Article | Art.5, Art.25, Art.32, Art.33, Art.34, Art.35, Art.83 | ~89 |
| SOC 2 | Common Criteria Control | CC6.1–CC9.1 | ~67 |
| ISO 27001 | Annex A Control | A.5.14–A.8.28 | ~114 |
| PCI DSS v4.0 | Requirement | Req.2.2.7–Req.11.3.1 | ~156 |
| NIST CSF 2.0 | Subcategory | GV.OC-01–RS.MA-01 | ~108 |
| NVD CVEs | CVE Entry | CVE-YYYY-NNNNN | Variable |
| OWASP Top 10 | Category | A01–A10 | ~10 |

**Each chunk dict must have:**
```python
{
    "text": "Art.32 — Security of processing\n\n<full article text>",
    "metadata": {
        "framework": "GDPR",
        "control_id": "Art.32",
        "control_title": "Security of processing",
        "category": "Technical Measures",
        "severity_weight": 0.9,
    }
}
```

### 2.3.4 Retriever Function (`app/rag/retriever.py`)

The core RAG query function — embed the finding text, cosine search Qdrant, return top-K relevant controls. Supports optional framework filtering.

```python
def retrieve_relevant_controls(
    finding_text: str,
    frameworks: list[str] = None,
    top_k: int = 10,
) -> list[dict]:
    # 1. Embed the finding
    # 2. Build Qdrant filter (optional framework filter)
    # 3. Search with cosine similarity
    # 4. Return control_id, control_title, text, score
```

### 2.3.5 Seed Script (`scripts/seed_rag.py`)

Orchestration flow:
1. Create/recreate Qdrant collection
2. Run all 7 chunkers (5 frameworks + NVD + OWASP)
3. Embed each chunk text
4. Batch upsert to Qdrant in groups of 100
5. Print total chunks seeded

---

## 2.4 Frontend Connection Points

| Backend | Frontend |
|---------|----------|
| `GET /frameworks` endpoint | Framework selection checkboxes on New Scan page |
| Framework metadata (name, version, chunks_indexed) | Framework cards on Dashboard |
| RAG retrieval scores | Confidence scores shown per compliance mapping in findings view |

### Frontend API Integration

```typescript
// src/lib/api/frameworks.ts
export async function fetchFrameworks(): Promise<Framework[]> {
  const res = await fetch(`${API_BASE}/api/v1/frameworks`);
  return (await res.json()).frameworks;
}
```

The New Scan page (`src/routes/_app/new-scan.tsx`) should use this to populate the framework selection.

---

## 2.5 Verification Checklist

- [ ] Qdrant is running on port 6333 (check `http://localhost:6333/dashboard`)
- [ ] `python scripts/seed_rag.py` completes without errors
- [ ] Qdrant dashboard shows `compliance_knowledge` collection with 1,000+ points
- [ ] Test query: `retrieve_relevant_controls("Redis running without authentication")` returns controls from GDPR Art.32 and PCI Req.2
- [ ] Test with framework filter: `retrieve_relevant_controls("hardcoded JWT secret", frameworks=["GDPR"])` returns only GDPR chunks
- [ ] `GET /frameworks` endpoint returns all 5 frameworks with chunk counts
- [ ] Frontend framework selection component renders correctly

---

## 2.6 Security Notes

- Framework PDFs should be stored locally in `data/` — do not commit copyrighted documents to git
- Add `data/` to `.gitignore`
- NVD API key is optional but recommended to avoid rate limiting
- Qdrant has no auth by default — in production, set up API key auth
