import { apiClient } from "./client";

export type ExtensionStore = "chrome" | "edge";
export type PolicyOutcome =
  "passed" | "violation" | "needs_review" | "not_assessed" | "not_applicable";
export const outcomeLabels: Record<PolicyOutcome, string> = {
  passed: "Passed check",
  violation: "Violation detected",
  needs_review: "Needs review",
  not_assessed: "Not assessed",
  not_applicable: "Not applicable",
};
export interface ExtensionListing {
  description: string;
  screenshots_description: string;
  privacy_text: string;
  privacy_url: string;
}
export interface ExtensionDeclarations {
  purpose: string;
  permissions: string;
  browser_settings: string;
  data_use: string;
  advertising: string;
  paid_features: string;
  chrome: ExtensionListing;
  edge: ExtensionListing;
}
export interface ExtensionReview {
  scan_id: string;
  status: string;
  package_name: string;
  package_version: string;
  manifest_version: number;
  stores: ExtensionStore[];
  policy_version: string;
  declarations: ExtensionDeclarations | null;
  coverage: {
    security_analysis_files?: number;
    security_analysis_limitations?: string[];
    analysis_exclusions?: { path?: string; reason: string }[];
    total?: number;
    outcomes?: Partial<Record<PolicyOutcome, number>>;
    limitations?: string[];
    omitted_executable_files?: number;
  };
}
export interface PolicyResult {
  id: string;
  store: ExtensionStore;
  rule_id: string;
  category: string;
  title: string;
  outcome: PolicyOutcome;
  finding_id: string | null;
}
export interface PolicyDetail extends PolicyResult {
  source_available?: boolean;
  details: {
    explanation: string;
    remedy: string;
    verification: string;
    path: string | null;
    line: number | null;
    evidence: string | null;
    method: string;
    policy_url: string;
    policy_version: string;
    reviewed_at: string;
    exceptions: string;
    notification_id: string | null;
  };
  notice: {
    label: string;
    message: string;
    remedy: string;
    help_url: string;
    notification_id: string | null;
    reference_available: boolean;
  };
  annotation: { note: string; updated_at: string } | null;
}
export const extensionBase = (workspace: string, scan: string) =>
  `/api/v1/workspaces/${encodeURIComponent(workspace)}/extension-reviews/${encodeURIComponent(scan)}`;
export const extensionCapabilities = (signal?: AbortSignal) =>
  apiClient<{ enabled: boolean; reason: string | null; policy_version: string }>(
    "/api/v1/extension-reviews/capabilities",
    { signal },
  );
export const getExtensionReview = (workspace: string, scan: string, signal?: AbortSignal) =>
  apiClient<ExtensionReview>(extensionBase(workspace, scan), { signal });
export const getPolicyResults = (
  workspace: string,
  scan: string,
  offset: number,
  store: string,
  outcome: string,
  signal?: AbortSignal,
  area?: string,
) => {
  const params = new URLSearchParams({ offset: String(offset) });
  if (store) params.set("store_filter", store);
  if (outcome) params.set("outcome", outcome);
  if (area) params.set("area", area);
  return apiClient<{ items: PolicyResult[]; total: number }>(
    `${extensionBase(workspace, scan)}/results?${params}`,
    { signal },
  );
};
export const getPolicyDetail = (
  workspace: string,
  scan: string,
  result: string,
  signal?: AbortSignal,
) =>
  apiClient<PolicyDetail>(
    `${extensionBase(workspace, scan)}/results/${encodeURIComponent(result)}`,
    { signal },
  );
export async function startExtensionReview(
  workspace: string,
  file: File,
  stores: ExtensionStore[],
  declarations: ExtensionDeclarations,
  key: string,
  signal: AbortSignal,
  screenshots: { store: ExtensionStore; file: File }[] = [],
) {
  const body = new FormData();
  body.set("file", file);
  body.set("stores", stores.join(","));
  body.set("declarations", JSON.stringify(declarations));
  body.set("screenshot_stores", JSON.stringify(screenshots.map((image) => image.store)));
  screenshots.forEach((image) => body.append("screenshots", image.file));
  return apiClient<{ scan_id: string; status: string }>(
    `/api/v1/workspaces/${encodeURIComponent(workspace)}/extension-reviews`,
    { method: "POST", body, headers: { "Idempotency-Key": key }, signal },
  );
}
export const savePolicyNote = (workspace: string, scan: string, result: string, note: string) =>
  apiClient(`${extensionBase(workspace, scan)}/results/${encodeURIComponent(result)}/annotation`, {
    method: "PUT",
    body: JSON.stringify({ note }),
  });
export const compareExtensionReviews = (
  workspace: string,
  scan: string,
  baseline: string,
  offset: number,
  signal?: AbortSignal,
) =>
  apiClient<{
    items: { category: string; title: string; path: string | null }[];
    total: number;
    compatible: boolean;
    counts: Record<string, number>;
    limitation: string;
  }>(`${extensionBase(workspace, scan)}/compare/${encodeURIComponent(baseline)}?offset=${offset}`, {
    signal,
  });
