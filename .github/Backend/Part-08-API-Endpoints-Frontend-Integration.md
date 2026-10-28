# Part 8 — FastAPI Endpoints + Frontend Integration

> Historical build plan. References below to `useScanProgress` and `useFindings` describe the original design, not maintained modules. Current workbench and saved Findings queries are implemented in `src/components/audit-workbench`, `src/lib/api/workbench.ts` and `src/routes/_app/findings.tsx`. See the root README and cleanup verification report for current setup.

> **Timeline:** Week 10 (final integration)  
> **Priority:** 🔴 Critical  
> **Dependencies:** All previous parts  

---

## 8.1 Objective

Build all remaining FastAPI route handlers, implement JWT authentication, rate limiting, WebSocket for real-time progress, and complete the frontend API integration layer. This is the glue that connects the backend engine to the TanStack Start frontend.

---

## 8.2 Files to Create/Modify

| File | Purpose |
|------|---------|
| `threatlens/app/api/__init__.py` | Router registration |
| `threatlens/app/api/scans.py` | Scan CRUD endpoints |
| `threatlens/app/api/reports.py` | Report generation + download |
| `threatlens/app/api/frameworks.py` | Framework metadata endpoint |
| `threatlens/app/api/export.py` | CSV/JSON export endpoints |
| `threatlens/app/api/auth.py` | JWT auth endpoints (login, register, token refresh) |
| `threatlens/app/api/ws.py` | WebSocket endpoint for scan progress |

**Frontend files to create/modify:**

| File | Purpose |
|------|---------|
| `src/lib/api/client.ts` | Base API client with auth headers |
| `src/lib/api/types.ts` | TypeScript interfaces mirroring Pydantic schemas |
| `src/lib/api/scans.ts` | Scan API functions |
| `src/lib/api/findings.ts` | Findings API functions |
| `src/lib/api/reports.ts` | Report API functions |
| `src/lib/api/frameworks.ts` | Framework API functions |
| `src/hooks/useScanProgress.ts` | TanStack Query hook for scan polling |
| `src/hooks/useFindings.ts` | TanStack Query hook for findings |

---

## 8.3 Complete API Reference

### 8.3.1 Scan Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/scan` | Start a new scan (file upload or Git URL) |
| `GET` | `/api/v1/scan/{scan_id}/status` | Poll scan progress (status, progress %, finding count) |
| `GET` | `/api/v1/scan/{scan_id}/findings` | Get all findings with optional severity/framework filters |
| `GET` | `/api/v1/scans` | List all scans for the authenticated user |
| `DELETE` | `/api/v1/scan/{scan_id}` | Delete a scan and its findings |

### 8.3.2 Report Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/scan/{scan_id}/report` | Trigger PDF report generation |
| `GET` | `/api/v1/report/{scan_id}/download` | Get signed download URL |
| `GET` | `/api/v1/scan/{scan_id}/export/csv` | Export findings as CSV |
| `GET` | `/api/v1/scan/{scan_id}/export/json` | Export findings as JSON |

### 8.3.3 Framework Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/frameworks` | List all compliance frameworks with metadata |

### 8.3.4 Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/register` | Create new account |
| `POST` | `/api/v1/auth/login` | Login → JWT token |
| `POST` | `/api/v1/auth/refresh` | Refresh expired token |
| `GET` | `/api/v1/auth/me` | Get current user profile |

### 8.3.5 WebSocket

| Protocol | Path | Description |
|----------|------|-------------|
| `WS` | `/ws/scan/{scan_id}` | Real-time scan progress updates |

---

## 8.4 JWT Authentication Implementation

```python
# app/api/auth.py
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict, expires_delta: timedelta = timedelta(hours=24)):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + expires_delta})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

# Dependency for protected routes
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(401, "Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(401, "Invalid token")
```

### Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/scan")
@limiter.limit("10/hour")
async def create_scan(request: Request, ...):
    ...
```

---

## 8.5 Frontend API Client

### Base Client (`src/lib/api/client.ts`)

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: HeadersInit = {
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
```

### Frontend Route → Backend Endpoint Mapping

| Frontend Page | Backend Endpoints Used |
|--------------|----------------------|
| `index.tsx` (Landing) | None (static) |
| `_app/dashboard.tsx` | `GET /scans`, `GET /frameworks` |
| `_app/new-scan.tsx` | `POST /scan`, `GET /frameworks` |
| `_app/findings.tsx` | `GET /scan/{id}/findings`, `GET /scan/{id}/status` |
| `_app/reports.tsx` | `POST /scan/{id}/report`, `GET /report/{id}/download`, `GET /scans` |
| `_app/reports.$reportId.tsx` | `GET /report/{id}/download`, `GET /scan/{id}/findings` |

---

## 8.6 Environment Variable for Frontend

Add to `.env` in the frontend project root:

```env
VITE_API_URL=http://localhost:8000
```

Add to `vite.config.ts` proxy (for dev):

```typescript
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

---

## 8.7 Verification Checklist

- [ ] All endpoints return correct HTTP status codes
- [ ] JWT authentication protects scan/report endpoints
- [ ] Rate limiting blocks >10 scans/hour from same IP
- [ ] Frontend can create a scan via file upload
- [ ] Frontend can create a scan via Git URL
- [ ] Frontend polls scan progress and shows live progress bar
- [ ] Frontend displays findings with severity and framework filters
- [ ] Frontend generates and downloads PDF reports
- [ ] WebSocket sends real-time progress updates
- [ ] CORS allows frontend origin
- [ ] OpenAPI docs at `/docs` are complete and accurate
- [ ] Error responses include meaningful messages

---

## 8.8 Security Notes

- **JWT secret:** Use a strong, random SECRET_KEY (64+ chars)
- **Token expiry:** Access tokens expire in 24 hours; refresh tokens in 7 days
- **Password hashing:** bcrypt with default salt rounds
- **Rate limiting:** Prevents API abuse and scan flooding
- **CORS:** Only allow the specific frontend origin, not `*` in production
- **Input validation:** All request bodies validated by Pydantic schemas
- **File upload:** Validate file type, size, and content before processing
