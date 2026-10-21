"""End-to-end test for the local scan API pipeline."""
import json
import time
import requests

API = "http://127.0.0.1:8000"


def main():
    # Step 1: Upload ZIP
    print("Step 1: Uploading test ZIP...")
    with open("tests/test-project.zip", "rb") as f:
        resp = requests.post(
            f"{API}/api/local/scan",
            files={"file": ("test-project.zip", f, "application/zip")},
            data={
                "target_name": "Test Project v1.0",
                "frameworks": "gdpr,soc2,iso27001",
            },
            timeout=30,
        )

    print(f"  Status: {resp.status_code}")
    if not resp.ok:
        print(f"  Error: {resp.text}")
        return

    data = resp.json()
    scan_id = data["scan_id"]
    print(f"  Scan ID: {scan_id}")
    print(f"  Files extracted: {data.get('file_count', 'N/A')}")

    # Step 2: Poll for completion
    print("\nStep 2: Waiting for AI analysis to complete...")
    for i in range(45):
        time.sleep(3)
        r = requests.get(f"{API}/api/local/scan/{scan_id}/result", timeout=15)
        if r.status_code == 200:
            result = r.json()
            findings = result.get("findings", [])
            print("\n  Analysis complete!")
            print(f"  Total findings: {len(findings)}")
            print(f"  Overall posture: {result['summary']['overall_posture']}")
            sev = result.get("severity_counts", {})
            print(f"  Severity: critical={sev.get('critical',0)}, high={sev.get('high',0)}, medium={sev.get('medium',0)}, low={sev.get('low',0)}")
            print(f"  Frameworks scored: {list(result.get('framework_scores', {}).keys())}")
            print()
            print("  First finding:")
            if findings:
                f0 = findings[0]
                print(f"    Title: {f0.get('title')}")
                print(f"    Severity: {f0.get('severity')}")
                print(f"    CVSS: {f0.get('cvss_score', 'N/A')}")
                print(f"    File: {f0.get('file_path', 'N/A')}")
                violations = f0.get("violations", [])
                print(f"    Violations: {len(violations)}")
                steps = f0.get("remediation_steps", [])
                print(f"    Remediation steps: {len(steps)}")
            print()
            print("  Framework scores:")
            for fw, score in result.get("framework_scores", {}).items():
                print(f"    {fw.upper()}: {score}%")
            return scan_id
        elif r.status_code == 202:
            elapsed = (i + 1) * 3
            detail = r.json().get("detail", "scanning...")
            print(f"  [{elapsed}s] {detail}")
        else:
            print(f"  Unexpected status: {r.status_code} {r.text}")
            return

    print("  TIMEOUT — scan took too long")
    return None


if __name__ == "__main__":
    scan_id = main()
    if scan_id:
        print(f"\nPipeline test PASSED. Scan ID: {scan_id}")
        report_url = f"{API}/api/local/scan/{scan_id}/report"
        print(f"Downloading generated PDF from {report_url}...")
        try:
            pdf_resp = requests.get(report_url, timeout=60)
            if pdf_resp.ok and len(pdf_resp.content) > 1000:
                out_path = "tests/threatlens-audit-report.pdf"
                with open(out_path, "wb") as f:
                    f.write(pdf_resp.content)
                print(f"Successfully saved audit report to: {out_path} ({len(pdf_resp.content):,} bytes)")
            else:
                print(f"Failed to download report: HTTP {pdf_resp.status_code}")
        except Exception as e:
            print(f"Error downloading PDF report: {e}")
    else:
        print("\nPipeline test FAILED")
