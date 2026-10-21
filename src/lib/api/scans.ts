import {
  dbFetchScans,
  dbFetchScan,
  dbCreateScan,
  dbDeleteScan,
} from "./database";
import type {
  Scan,
  ScanStatusResponse,
} from "./types";

export interface CreateScanPayload {
  workspace_id: string;
  scan_type: "codebase" | "architecture" | "logs" | "full";
  target_name: string;
  selected_frameworks: string[];
  filename?: string;
  content_type?: string;
  size?: number;
  git_url?: string;
}

export interface ScanListResponse {
  items: Scan[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchScans(
  workspaceId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<ScanListResponse> {
  const items = await dbFetchScans(workspaceId);
  return {
    items,
    total: items.length,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  };
}

export async function fetchScan(scanId: string): Promise<Scan> {
  const scan = await dbFetchScan(scanId);
  if (!scan) throw new Error(`Scan not found: ${scanId}`);
  return scan;
}

export async function fetchScanStatus(scanId: string): Promise<ScanStatusResponse> {
  const scan = await dbFetchScan(scanId);
  if (!scan) throw new Error(`Scan not found: ${scanId}`);
  return {
    scan_id: scanId,
    status: scan?.status || "completed",
    progress: scan?.status === "completed" ? 100 : 0,
    finding_count: scan?.finding_count || 0,
    current_phase: scan?.status === "completed" ? "Done" : "Analyzing",
    error_code: null,
    error_message: null,
  };
}

export async function createScan(payload: CreateScanPayload): Promise<{
  scan_id: string;
  artifact_id?: string;
  object_path?: string;
}> {
  const scan = await dbCreateScan({
    workspace_id: payload.workspace_id,
    scan_type: payload.scan_type,
    target_name: payload.target_name,
    status: "pending",
    selected_frameworks: payload.selected_frameworks,
  });
  return { scan_id: scan.id };
}

export async function deleteScan(scanId: string): Promise<{ scan_id: string }> {
  await dbDeleteScan(scanId);
  return { scan_id: scanId };
}
