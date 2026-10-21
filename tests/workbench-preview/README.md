# Isolated Workbench visual QA

Run from the repository root:

```sh
npx vite --config tests/workbench-preview/vite.config.ts
```

Open `http://127.0.0.1:5175/tests/workbench-preview/index.html`.
Use `?view=upload`, `?view=scan`, or `?state=expired|failed|old|empty|denied`.
Progressive mode is the default. Use `?state=indexing&hold=1` for a stable partial-upload state, `?state=indexing` for late findings/completion after 20 seconds, or `?progressive=false` for the older completed-only backend contract.

The visible fixture performance output counts source requests and editor creation, and measures tab click → next paint after a model switch. Open both source files, then alternate their tabs: requests should stop increasing and editor creation should remain at one. This development-build measurement is not a hosted load-test result.

The harness uses the real workbench, Monaco, upload UI, scan animation, shell and design tokens. Only this dedicated Vite config aliases authentication/workspace hooks to test doubles. The application build does not load these files. Fixture networking blocks non-local requests; it cannot authenticate, create a real scan or alter hosted data. This verifies rendering and interactions, not hosted deployment or model accuracy.
