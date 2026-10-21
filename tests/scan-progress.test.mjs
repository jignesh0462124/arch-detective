import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { consumeScanProgress } from "../src/lib/api/scanProgress.ts";

const originalSource = globalThis.EventSource;
const originalFetch = globalThis.fetch;
class FakeSource {
  static current;
  closed = false;
  constructor(url) {
    this.url = url;
    FakeSource.current = this;
  }
  close() {
    this.closed = true;
  }
  emit(value) {
    this.onmessage({ data: JSON.stringify(value) });
  }
}
beforeEach(() => {
  globalThis.EventSource = FakeSource;
});
afterEach(() => {
  globalThis.EventSource = originalSource;
  globalThis.fetch = originalFetch;
});
const result = { scan_id: "fixture", findings: [] };

test("SSE completes once, de-duplicates events and ignores stale progress", async () => {
  const seen = [];
  const pending = consumeScanProgress("http://test", "fixture", (e) => seen.push(e));
  const source = FakeSource.current;
  source.emit({ step: "finding", label: "Review", progress: 30 });
  source.emit({ step: "finding", label: "Review", progress: 30 });
  source.emit({ step: "upload", label: "Old", progress: 5 });
  source.emit({ step: "done", label: "Done", progress: 100, result });
  assert.deepEqual(await pending, result);
  assert.deepEqual(
    seen.map((e) => e.progress),
    [30, 100],
  );
  assert.equal(source.closed, true);
  source.emit({ step: "error", label: "Late", progress: 0 });
  assert.equal(seen.length, 2);
});

test("disconnect closes SSE and starts only one sequential fallback request", async () => {
  let count = 0;
  globalThis.fetch = async () => {
    count++;
    return Response.json(result);
  };
  const pending = consumeScanProgress("http://test", "fixture", () => {});
  const source = FakeSource.current;
  source.onerror();
  source.onerror();
  assert.deepEqual(await pending, result);
  assert.equal(source.closed, true);
  assert.equal(count, 1);
});

test("unknown and failed scans reject instead of polling forever", async () => {
  for (const status of [404, 409]) {
    globalThis.fetch = async () => Response.json({ detail: "Scan failed or missing" }, { status });
    const pending = consumeScanProgress("http://test", "fixture", () => {});
    FakeSource.current.onerror();
    await assert.rejects(pending, /failed or missing/);
  }
});

test("polling propagates a terminal error event from 202 progress payloads", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { events: [{ step: "error", label: "Analysis failed", progress: 0 }] },
      { status: 202 },
    );
  const pending = consumeScanProgress("http://test", "fixture", () => {});
  FakeSource.current.onerror();
  await assert.rejects(pending, /Analysis failed/);
});

test("abort cancels the active request and closes the event stream", async () => {
  let requestSignal;
  globalThis.fetch = (_, options) =>
    new Promise((_, reject) => {
      requestSignal = options.signal;
      options.signal.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });
  const controller = new AbortController();
  const pending = consumeScanProgress("http://test", "fixture", () => {}, {
    signal: controller.signal,
  });
  FakeSource.current.onerror();
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requestSignal.aborted, true);
  assert.equal(FakeSource.current.closed, true);
});

test("watchdog has a finite deadline and cleans up stalled streams", async () => {
  const pending = consumeScanProgress("http://test", "fixture", () => {}, { timeoutMs: 5 });
  await assert.rejects(pending, /timed out/);
  assert.equal(FakeSource.current.closed, true);
});

test("malformed result data is rejected, never treated as a clean audit", async () => {
  globalThis.fetch = async () => Response.json({ status: "running" });
  const pending = consumeScanProgress("http://test", "fixture", () => {});
  FakeSource.current.onerror();
  await assert.rejects(pending, /invalid result/);
});

test("callback errors reject rather than being swallowed", async () => {
  const pending = consumeScanProgress("http://test", "fixture", () => {
    throw new Error("Callback failure");
  });
  FakeSource.current.emit({ step: "finding", progress: 30 });
  await assert.rejects(pending, /Callback failure/);
});

test("already aborted signals do not open a new connection", async () => {
  const controller = new AbortController();
  controller.abort();
  const previous = FakeSource.current;
  await assert.rejects(
    consumeScanProgress("http://test", "fixture", () => {}, { signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(FakeSource.current, previous);
});
