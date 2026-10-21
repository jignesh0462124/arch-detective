import type { LocalScanResult, ScanProgressEvent } from "./localScan";

/** A single cancellable transport: SSE first, sequential polling on disconnect. */
export function consumeScanProgress(
  baseUrl: string,
  scanId: string,
  onEvent: (event: ScanProgressEvent) => void,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<LocalScanResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let source: EventSource | undefined;
    let polling = false;
    let progress = 0;
    const seenEvents = new Set<string>();
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const endpoint = `${baseUrl}/api/local/scan/${encodeURIComponent(scanId)}`;
    const cleanup = () => {
      source?.close();
      clearTimeout(pollTimer);
      clearTimeout(quietTimer);
      clearTimeout(deadline);
      request?.abort();
      options.signal?.removeEventListener("abort", abort);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(new DOMException("Scan connection cancelled", "AbortError"));
    const accept = (event: ScanProgressEvent) => {
      if (settled) return;
      if (event.step === "error") {
        fail(new Error(event.label || "Scan failed"));
        return;
      }
      if (Number(event.progress) < progress && event.step !== "done") return;
      progress = Math.max(progress, Math.min(100, Number(event.progress) || 0));
      const key = `${event.step}:${progress}:${event.label}`;
      if (!seenEvents.has(key)) {
        seenEvents.add(key);
        try {
          onEvent({ ...event, progress });
        } catch (error) {
          fail(error);
          return;
        }
      }
      if (event.step === "done" && event.result && Array.isArray(event.result.findings)) {
        settled = true;
        cleanup();
        resolve(event.result);
      }
    };
    const poll = async () => {
      if (settled) return;
      request = new AbortController();
      const requestTimeout = setTimeout(() => request?.abort(), 10_000);
      try {
        const response = await fetch(`${endpoint}/result`, { signal: request.signal });
        const body = await response.json();
        if (settled) return;
        if (response.status === 200) {
          if (!Array.isArray(body?.findings)) {
            fail(new Error("The scanner returned invalid result data."));
            return;
          }
          accept({ step: "done", label: "Analysis complete", progress: 100, result: body });
        } else if (response.status === 202) {
          for (const event of Array.isArray(body.events) ? body.events : []) accept(event);
        } else if ((response.status >= 400 && response.status < 500) || body.status === "error") {
          fail(new Error(body.detail || body.error || "The scan is unavailable. Run a new audit."));
        }
      } catch {
        // Transient network errors retry only until the explicit deadline.
      } finally {
        clearTimeout(requestTimeout);
        if (!settled) pollTimer = setTimeout(() => void poll(), 1500);
      }
    };
    const startPolling = () => {
      if (settled || polling) return;
      polling = true;
      source?.close();
      clearTimeout(quietTimer);
      void poll();
    };
    const deadline = setTimeout(
      () => fail(new Error("Scan connection timed out. Reopen the audit to reconnect.")),
      options.timeoutMs ?? 600_000,
    );
    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      source = new EventSource(`${endpoint}/stream`);
      source.onmessage = (message) => {
        if (settled) return;
        let event: ScanProgressEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        if (!event || typeof event.step !== "string") return;
        clearTimeout(quietTimer);
        quietTimer = setTimeout(startPolling, 10_000);
        try {
          accept(event);
        } catch (error) {
          fail(error);
        }
      };
      source.onerror = startPolling;
      quietTimer = setTimeout(startPolling, 4000);
    } catch {
      startPolling();
    }
  });
}
