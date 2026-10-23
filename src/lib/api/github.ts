import { apiClient, ApiError } from "./client";
export interface Integration {
  id: string;
  repository_id: number;
  full_name: string;
  installation_id: number;
}
export interface Proposal {
  expired?: boolean;
  id: string;
  revision: number;
  scan_id: string;
  finding_id: string;
  status: string;
  expires_at: string;
  metadata: {
    title: string;
    explanation: string;
    repository: string;
    branch: string;
    commit_sha: string;
    assumptions: string[];
    tests: string[];
  };
  diff?: string;
  checks?: { path: string; status: string }[];
  operation?: { url?: string; branch?: string; commit?: string };
}
export function gh<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
  signal?: AbortSignal,
) {
  return apiClient<T>(`/api/v1${path}`, {
    method,
    signal,
    credentials: "include",
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
export function githubError(error: unknown) {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "detail" in error.body &&
    typeof error.body.detail === "string"
  )
    return error.body.detail;
  return "This request could not be completed. Check your connection and retry.";
}
