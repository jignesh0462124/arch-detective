import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getReportLibrary,
  getReportPreview,
  fetchReportPdf,
  triggerReportDownload,
  reportError,
  type ReportFilters,
  type ReportEntry,
} from "@/lib/api/reports";
import { buildReportZip, reportFilename } from "@/lib/reportExport";

export function useReports(
  user: string,
  workspace: string,
  filters: ReportFilters,
  cursor: string | null,
) {
  return useQuery({
    queryKey: ["reports", user, workspace, filters, cursor],
    queryFn: ({ signal }) => getReportLibrary(workspace, filters, cursor, signal),
    enabled: !!user && !!workspace,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
  });
}
export function useReport(user: string, workspace: string, id: string) {
  return useQuery({
    queryKey: ["report", user, workspace, id],
    queryFn: ({ signal }) => getReportPreview(workspace, id, signal),
    enabled: !!user && !!workspace && !!id,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
  });
}
export function useReportDownloads(user: string, workspace: string) {
  const { user: currentUser, status } = useAuth();
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  useEffect(() => {
    if (status !== "authenticated" || currentUser?.id !== user) controller.current?.abort();
    return () => {
      controller.current?.abort();
    };
  }, [user, workspace, currentUser?.id, status]);
  async function run(items: ReportEntry[], zip: boolean, frameworks?: string[]) {
    if (controller.current) return;
    if (!items.length) {
      setError("Select at least one report to download.");
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setBusy(zip ? "zip" : items[0].id);
    setMessage("");
    setError("");
    setProgress({ done: 0, total: items.length });
    const authorize = async () => {
      for (const item of items) await getReportPreview(workspace, item.id, current.signal);
    };
    try {
      if (zip) {
        const result = await buildReportZip(
          items,
          (id) => fetchReportPdf(workspace, id, current.signal),
          authorize,
          current.signal,
          (done, total) => setProgress({ done, total }),
        );
        current.signal.throwIfAborted();
        triggerReportDownload(result.blob, "archon-audit-reports.zip");
        setMessage(
          `ZIP download started: ${result.succeeded} reports included${result.failed ? `; ${result.failed} failed (see manifest.json)` : ""}.`,
        );
      } else {
        const blob = await fetchReportPdf(workspace, items[0].id, current.signal, frameworks);
        await authorize();
        current.signal.throwIfAborted();
        triggerReportDownload(blob, reportFilename(items[0].target_name, items[0].id));
        setMessage("PDF download started.");
      }
    } catch (failure) {
      if (!current.signal.aborted) setError(reportError(failure));
      else setMessage("Download cancelled. No new file was downloaded.");
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setBusy(null);
      }
    }
  }
  const cancel = useCallback(() => controller.current?.abort(), []);
  return { busy, message, error, progress, run, cancel };
}
