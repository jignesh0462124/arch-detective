import pytest
from fastapi import HTTPException
from app.services.reviewed_fixes import apply_edits, safe_path, syntax_checks, compare_findings

def test_patch_preserves_original_secrets_and_line_endings():
    original = 'password = "original-secret"\r\nquery = input()\r\n'
    output, diff = apply_edits({"app.py": original}, [{"path":"app.py", "replacements":[{"before":"query = input()", "after":"query = validate(input())"}]}])
    assert output["app.py"] == original.replace("query = input()", "query = validate(input())")
    assert "original-secret" not in diff
    assert "validate" in diff

@pytest.mark.parametrize("path", ["../app.py", "/app.py", "C:\\app.py", ".github/workflows/check.yml", "node_modules/x.js", ".env", "src/.env.local", "./x.py"])
def test_unsafe_paths(path):
    assert not safe_path(path)

@pytest.mark.parametrize("before,after", [("missing", "x"), ('password = "secret"', 'password = "new-secret"'), ("****", "safe")])
def test_patch_rejects_ungrounded_or_secret_edits(before, after):
    with pytest.raises(HTTPException):
        apply_edits({"x.py": 'password = "secret"\n****'}, [{"path":"x.py", "replacements":[{"before":before,"after":after}]}])

def test_ambiguous_and_overlapping_replacements():
    for source, edits in [("a a", [{"before":"a","after":"b"}]), ("abcd", [{"before":"abc","after":"b"},{"before":"bcd","after":"x"}])]:
        with pytest.raises(HTTPException):
            apply_edits({"x.py":source}, [{"path":"x.py","replacements":edits}])

@pytest.mark.parametrize("path,source,broken", [("x.py","x = 1\n","x = ("),("x.js","let x = 1;","let x = ;"),("x.ts","let x: number = 1;","let x: = ;"),("x.php","<?php $x = 1;","<?php $x = ;")])
def test_non_executing_syntax(path, source, broken):
    assert syntax_checks({path:source},{path:source})[0]["status"] == "passed"
    assert syntax_checks({path:source},{path:broken})[0]["status"] == "failed"

def test_comparison_preserves_duplicates_and_coverage_unknowns():
    before=[{"id":"1","title":"SQL", "file_path":"x.php", "cwe_id":"CWE-89", "code_snippet":"query"}]
    after=[{**before[0],"id":"2"},{**before[0],"id":"3"}]
    rows=compare_findings(before,after,True)
    assert len(rows)==3
    assert rows[0]["status"]=="needs_review"
    assert all(row["status"]=="needs_review" for row in rows)
    assert all(x["status"]=="needs_review" for x in compare_findings(before,after,False))

def test_line_move_with_unique_evidence_is_retained():
    old={"id":"1","cwe_id":"CWE-89","file_path":"Login.php","code_snippet":"query"}
    new={**old,"id":"2"}
    assert compare_findings([old],[new],True)[0]["status"]=="still_present"
    new["file_path"]="login.php"
    assert len(compare_findings([old],[new],True))==2


def test_duplicate_baselines_cannot_claim_one_revised_finding():
    old={"id":"1","cwe_id":"CWE-89","file_path":"x.php","code_snippet":"query"}
    rows=compare_findings([old,{**old,"id":"2"}],[{**old,"id":"3"}],True)
    assert all(row["status"]!="still_present" for row in rows)
    assert all(row["status"]!="no_longer_detected" for row in rows)


def test_large_comparison_preserves_every_identity():
    before=[{"id":str(i),"fingerprint":str(i),"file_path":"x.py"} for i in range(1200)]
    after=[{**row,"id":"new-"+row["id"]} for row in before]
    rows=compare_findings(before,after,True)
    assert len(rows)==1200 and all(row["status"]=="still_present" for row in rows)


@pytest.mark.parametrize("edits", ["bad", [None], [{"path":None}], [{"path":"x.py","replacements":[None]}]])
def test_malformed_provider_patch_is_rejected(edits):
    with pytest.raises(HTTPException): apply_edits({"x.py":"x = 1"},edits)
