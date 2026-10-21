import { accountStorage } from "@/lib/authState";
import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import {
  getWorkbench,
  getWorkbenchCapabilities,
  getWorkbenchBootstrap,
  getWorkbenchStatus,
  getSnapshotFiles,
  getSnapshotFilePage,
  getWorkbenchFindings,
  getWorkbenchFinding,
  type WorkbenchOverview,
  type WorkbenchCapabilities,
} from "@/lib/api/workbench";

export function useWorkbenchData(
  workspaceId: string,
  scanId: string,
  userId: string | undefined,
  allowed: boolean,
  fileSearch: string,
  severity: string,
  search: string,
  selectedId: string | null,
) {
  const client = useQueryClient();
  const scope = [userId, workspaceId, scanId];
  const caps = useQuery({
    queryKey: ["workbench-capabilities", userId],
    queryFn: ({ signal }) => getWorkbenchCapabilities(signal),
    initialData: () =>
      client.getQueryData<WorkbenchCapabilities>(["workbench-capabilities", workspaceId]),
    initialDataUpdatedAt: () =>
      client.getQueryState(["workbench-capabilities", workspaceId])?.dataUpdatedAt,
    enabled: allowed,
    retry: false,
    staleTime: 60000,
  });
  const progressive = !!caps.data?.progressive_workbench;
  const bootstrap = useQuery({
    queryKey: ["workbench-bootstrap", ...scope],
    queryFn: ({ signal }) => getWorkbenchBootstrap(workspaceId, scanId, signal),
    enabled: allowed && progressive,
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const status = useQuery({
    queryKey: ["workbench-status", ...scope],
    queryFn: ({ signal }) => getWorkbenchStatus(workspaceId, scanId, signal),
    enabled: allowed && progressive && !!bootstrap.data,
    initialData: bootstrap.data
      ? {
          scan: bootstrap.data.scan,
          snapshot: bootstrap.data.snapshot,
          metadata: bootstrap.data.metadata,
          counts: bootstrap.data.counts,
          events: bootstrap.data.events,
          job_status: bootstrap.data.job_status,
        }
      : undefined,
    retry: false,
    gcTime: 0,
    refetchInterval: (query) => (query.state.data?.scan.status === "running" ? 2000 : 15000),
  });
  const legacy = useQuery({
    queryKey: ["workbench", ...scope],
    queryFn: ({ signal }) => getWorkbench(workspaceId, scanId, signal),
    enabled: allowed && !caps.isPending && !progressive,
    retry: false,
    gcTime: 0,
    refetchInterval: 15000,
  });
  const current = status.data || bootstrap.data;
  const running = current?.scan.status === "running";
  const snapshot = progressive ? current?.snapshot : legacy.data?.snapshot;
  const readable = snapshot?.state === "ready" || (progressive && snapshot?.state === "indexing");
  const blocked = !allowed || (progressive ? status.isError || bootstrap.isError : legacy.isError);
  const filePages = useInfiniteQuery({
    queryKey: ["workbench-file-pages", ...scope, snapshot?.id, fileSearch],
    queryFn: ({ signal, pageParam }) => getSnapshotFilePage(scanId, fileSearch, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const count = all.reduce((n, p) => n + p.items.length, 0);
      return count < last.total && last.items.length ? count : undefined;
    },
    initialData:
      !fileSearch && bootstrap.data?.files.items.length
        ? { pages: [bootstrap.data.files], pageParams: [0] }
        : undefined,
    enabled: progressive && readable && !blocked,
    retry: false,
    gcTime: 0,
    refetchInterval: snapshot?.state === "indexing" ? 2000 : false,
  });
  const legacyFiles = useQuery({
    queryKey: ["snapshot-files", ...scope, snapshot?.id],
    queryFn: ({ signal }) => getSnapshotFiles(scanId, signal),
    enabled: !progressive && readable && !blocked,
    retry: false,
    gcTime: 0,
  });
  const {
    hasNextPage: hasMoreFiles,
    isFetching: fetchingFiles,
    isError: fileError,
    fetchNextPage: nextFiles,
  } = filePages;
  useEffect(() => {
    if (progressive && !blocked && readable && hasMoreFiles && !fetchingFiles && !fileError)
      void nextFiles();
  }, [progressive, blocked, readable, hasMoreFiles, fetchingFiles, fileError, nextFiles]);
  const findingPages = useInfiniteQuery({
    queryKey: ["workbench-finding-pages", ...scope, severity, search],
    queryFn: ({ signal, pageParam }) =>
      getWorkbenchFindings(scanId, severity, search, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const count = all.reduce((n, p) => n + p.items.length, 0);
      return count < last.total && last.items.length ? count : undefined;
    },
    initialData:
      severity === "all" && !search && bootstrap.data
        ? { pages: [bootstrap.data.finding_page], pageParams: [0] }
        : undefined,
    enabled: progressive && !!current && !blocked,
    retry: false,
    gcTime: 0,
    refetchInterval: running ? 2000 : false,
  });
  const summaries = useMemo(
    () =>
      progressive
        ? findingPages.data?.pages.flatMap((p) => p.items) || []
        : legacy.data?.findings || [],
    [progressive, findingPages.data, legacy.data],
  );
  const detailId = selectedId || summaries[0]?.id;
  const detail = useQuery({
    queryKey: ["workbench-finding-detail", ...scope, detailId],
    queryFn: ({ signal }) => getWorkbenchFinding(scanId, detailId!, signal),
    enabled: progressive && !!detailId && !blocked,
    retry: false,
    gcTime: 0,
  });
  const denial = [filePages.error, legacyFiles.error, findingPages.error, detail.error].find(
    (error) => error instanceof ApiError && [401, 403, 404, 410].includes(error.status),
  );
  useEffect(() => {
    if (progressive && current?.scan.status === "completed") {
      void client.invalidateQueries({ queryKey: ["workbench-finding-pages", ...scope] });
      void client.invalidateQueries({ queryKey: ["workbench-file-pages", ...scope] });
      try {
        accountStorage.removeItem(`archon-workbench-job:${workspaceId}`);
      } catch {
        /* Optional navigation metadata only. */
      }
    }
    // Only the durable completion transition invalidates pages, not every status check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressive, current?.scan.status, client, userId, workspaceId, scanId]);
  const { refetch: refetchStatus } = status;
  const { refetch: refetchLegacy } = legacy;
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible" && allowed)
        void (progressive ? refetchStatus() : refetchLegacy());
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [allowed, progressive, refetchStatus, refetchLegacy]);
  const fileData = useMemo(() => {
    let items = progressive
      ? filePages.data?.pages.flatMap((p) => p.items) || []
      : legacyFiles.data || [];
    if (
      bootstrap.data?.initial_file &&
      !items.some((f) => f.id === bootstrap.data.initial_file!.id)
    )
      items = [...items, bootstrap.data.initial_file];
    return detail.data?.file && !items.some((f) => f.id === detail.data.file!.id)
      ? [...items, detail.data.file]
      : items;
  }, [progressive, filePages.data, legacyFiles.data, detail.data, bootstrap.data?.initial_file]);
  const data: WorkbenchOverview | undefined =
    progressive && current ? { ...current, findings: summaries } : legacy.data;
  const overview = progressive
    ? {
        data,
        isPending: bootstrap.isPending,
        isError: bootstrap.isError || status.isError || !!denial,
        error: bootstrap.error || status.error || denial,
        refetch: bootstrap.isError ? bootstrap.refetch : status.refetch,
      }
    : { ...legacy, isError: legacy.isError || !!denial, error: legacy.error || denial };
  return {
    overview,
    progressive,
    blocked: blocked || !!denial,
    snapshot,
    files: {
      data: fileData,
      isPending: progressive ? filePages.isPending : legacyFiles.isPending,
      isError: progressive ? filePages.isError : legacyFiles.isError,
      error: progressive ? filePages.error : legacyFiles.error,
    },
    detail,
    summaries,
    findingPages,
    initialSource: bootstrap.data?.initial_source,
    sourceAllowed: readable && !blocked && !denial,
  };
}
