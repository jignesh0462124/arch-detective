import { ApiError } from "./api/client";

export const ZIP_MAX_REPORTS = 20;
export const ZIP_MAX_BYTES = 50 * 1024 * 1024;
export const reportFilename = (name: string, id: string) =>
  `archon-${name.replace(/[^a-z0-9-]/gi, "-").slice(0, 65) || "audit"}-${id}.pdf`;
export async function buildReportZip(
  items: readonly { id: string; target_name: string }[],
  fetchPdf: (id: string) => Promise<Blob>,
  authorize: () => Promise<unknown>,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
) {
  if (
    !items.length ||
    items.length > ZIP_MAX_REPORTS ||
    new Set(items.map((x) => x.id)).size !== items.length
  )
    throw new Error("Select between 1 and 20 distinct reports for one ZIP.");
  const { zip, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const manifest: { scan_id: string; filename?: string; status: string }[] = [];
  let bytes = 0,
    succeeded = 0;
  await authorize();
  for (const item of items) {
    signal.throwIfAborted();
    let blob: Blob;
    try {
      blob = await fetchPdf(item.id);
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) throw error;
      manifest.push({
        scan_id: item.id,
        status: "PDF preparation failed; retry this report separately",
      });
      progress(manifest.length, items.length);
      continue;
    }
    bytes += blob.size;
    if (bytes > ZIP_MAX_BYTES)
      throw new Error("Selected PDFs exceed 50 MiB. Select fewer reports; no ZIP was downloaded.");
    const filename = reportFilename(item.target_name, item.id);
    files[filename] = new Uint8Array(await blob.arrayBuffer());
    manifest.push({ scan_id: item.id, filename, status: "included" });
    succeeded++;
    progress(manifest.length, items.length);
  }
  if (!succeeded) throw new Error("No PDFs could be prepared. Retry the reports individually.");
  await authorize();
  signal.throwIfAborted();
  files["manifest.json"] = strToU8(
    JSON.stringify({ generated_at: new Date().toISOString(), reports: manifest }, null, 2),
  );
  const result = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const cancel = zip(files, { level: 0 }, (error, data) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(data);
    });
    function abort() {
      cancel();
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  signal.throwIfAborted();
  if (result.byteLength > ZIP_MAX_BYTES)
    throw new Error("The ZIP exceeds 50 MiB. Select fewer reports.");
  return {
    blob: new Blob([result], { type: "application/zip" }),
    succeeded,
    failed: items.length - succeeded,
  };
}
