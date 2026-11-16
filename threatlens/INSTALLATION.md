# Python installation profiles

Use Python 3.12 (or the Docker-supported Python 3.11) in a dedicated virtual environment. `npm run dev` and `npm run dev:backend` prefer an activated environment, then `threatlens/.venv`, then `.venv`, before checking Python on PATH. The launcher checks the Python version and imports Uvicorn/asyncpg before starting; it does not install or change packages. Never copy credentials into commands, test reports or version control.

## Local API and progressive workbench

From the repository root, using Python 3.12 (verify `python --version` before creating the environment):

```powershell
python -m venv threatlens/.venv
.\threatlens\.venv\Scripts\Activate.ps1
python -m pip install -r threatlens/requirements-api.txt
python -m pip check
npm ci
npm run dev
```

Do not recreate an existing environment in place during a deployment. Build and validate a separate environment, then switch processes deliberately. The cleanup verification used Python 3.12.14 on Windows with an isolated environment under ignored `output/cleanup-python-profile`.

If Windows reports `An Application Control policy has blocked this file` while importing a native module, do not disable Application Control or unblock/rename DLLs to evade it. Use the approved project environment. If that environment is also blocked, ask your administrator to approve the intended Python installation. A global Python 3.14 installation is not the supported environment for these pinned dependencies.

This profile supports the FastAPI application, Supabase-backed workbench and direct provider clients. It does **not** install the full Celery analysis toolchain, embedding models or research dependencies. Provider keys, Supabase configuration, private Storage, feature flags and migrations are still required for their corresponding features. An installation alone does not prove those services are configured correctly.

## Regression tests

```powershell
python -m pip install -r threatlens/requirements-test.txt
python -m pip check
python -m pytest threatlens/tests -q
```

The test profile includes the API profile plus pytest and the legacy agent interfaces exercised by unit tests. `requirements-test-windows-py312.lock.txt` records the exact clean-install regression environment; it is Windows/Python 3.12 specific, not a cross-platform production lock. Use it in a fresh environment when reproducing those results.

Four smoke tests deliberately require external services. They are opt-in via `THREATLENS_RUN_SUPABASE_SMOKE`, `THREATLENS_RUN_REDIS_SMOKE`, `THREATLENS_RUN_SCANNER_SMOKE` and `THREATLENS_RUN_GROQ_SMOKE`. Run them only with isolated test resources and the required configuration. A skipped test is not a verified integration.

## Full scanner-worker and research profile

`requirements.txt` retains the full declared dependency set: Celery scanners, LangChain, embeddings, data science and report/research tools. No package was removed simply because it was absent from the existing developer environment.

Install and verify this profile separately on the intended worker platform. It also needs the configured database, Redis, private Storage, scanner executables (including TruffleHog), and model/vector services as applicable. The cleanup checked dependency resolution, not a complete Linux worker deployment or live provider run. Restrict worker network/filesystem privileges at the OS/container boundary; environment-variable filtering is not a sandbox.

Uploaded Python requirements are now audited only as exact `name==version` pins, with pip resolution disabled. Ranges, URLs, includes, markers and options result in an explicit incomplete-coverage failure, not a clean audit. Provide a separately exported, fully pinned dependency list when needed; Archon does not install uploaded packages.

## PDF runtime

The report renderer uses installed Chromium/Edge with its sandbox enabled, or WeasyPrint when its native dependencies are available. The template is inline-only: scripts, network resources and local-file resource fetching are blocked. Verify PDF generation and appearance in the target deployment; do not reintroduce `--no-sandbox` to bypass a platform setup problem.

## Narrow compatibility corrections

- `tenacity==8.5.0` satisfies the existing LangChain 0.3.3 `<9` constraint.
- `groq==0.13.0` fixes client construction with the declared HTTPX 0.28 series ([upstream release](https://github.com/groq/groq-python/releases/tag/v0.13.0)). No model selection or routing changed.
- `python-multipart` is declared directly because upload endpoints require it.
- Jinja2 uses the targeted 3.1.6 patch release.

Dependency resolution, `pip check`, unit tests and real-service smoke tests answer different questions. None alone is a guarantee that a deployment is secure or fully operational.
