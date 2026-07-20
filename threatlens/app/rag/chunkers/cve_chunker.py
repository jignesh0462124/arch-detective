from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.config import settings
from app.rag.chunkers.base import Chunk


NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"


class NVDClientError(RuntimeError):
    """Raised when NVD data cannot be fetched or parsed."""


def _iso_nvd(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _description(cve: dict[str, Any]) -> str:
    descriptions = cve.get("descriptions", [])
    for description in descriptions:
        if description.get("lang") == "en" and description.get("value"):
            return str(description["value"])
    return "No English description was provided by NVD."


def _cvss(cve: dict[str, Any]) -> tuple[float, str]:
    metrics = cve.get("metrics", {})
    for metric_name in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = metrics.get(metric_name, [])
        if not entries:
            continue
        cvss_data = entries[0].get("cvssData", {})
        return float(cvss_data.get("baseScore", 0.0)), str(cvss_data.get("baseSeverity", "UNKNOWN"))
    return 0.0, "UNKNOWN"


def chunk_nvd_payload(payload: dict[str, Any]) -> list[Chunk]:
    chunks: list[Chunk] = []
    for item in payload.get("vulnerabilities", []):
        cve = item.get("cve", {})
        cve_id = str(cve.get("id", "")).strip()
        if not cve_id:
            continue
        score, severity = _cvss(cve)
        description = _description(cve)
        weaknesses = [
            entry.get("description", [{}])[0].get("value", "")
            for entry in cve.get("weaknesses", [])
            if entry.get("description")
        ]
        chunks.append(
            {
                "text": f"{cve_id} - {severity} ({score})\n\n{description}\nWeaknesses: {', '.join(weaknesses) or 'Not classified'}.",
                "metadata": {
                    "framework": "NVD",
                    "version": "2.0",
                    "control_id": cve_id,
                    "control_title": description[:160],
                    "category": "Known vulnerability",
                    "severity_weight": round(min(max(score / 10.0, 0.0), 1.0), 3),
                    "chunk_type": "cve_entry",
                    "published": cve.get("published"),
                    "last_modified": cve.get("lastModified"),
                },
            }
        )
    return chunks


async def fetch_nvd_cves(days: int = 30, limit: int = 100) -> list[Chunk]:
    if not 1 <= days <= 120:
        raise ValueError("days must be between 1 and 120")
    if not 1 <= limit <= 2_000:
        raise ValueError("limit must be between 1 and 2000")

    end = datetime.now(UTC)
    params = {
        "pubStartDate": _iso_nvd(end - timedelta(days=days)),
        "pubEndDate": _iso_nvd(end),
        "resultsPerPage": limit,
    }
    headers = {"apiKey": settings.NVD_API_KEY} if settings.NVD_API_KEY else {}

    try:
        async with httpx.AsyncClient(timeout=settings.NVD_TIMEOUT_SECONDS) as client:
            response = await client.get(NVD_API_URL, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise NVDClientError("Unable to fetch CVE data from NVD") from exc

    return chunk_nvd_payload(payload)
