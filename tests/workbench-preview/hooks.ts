// Non-production test doubles. No real session, account or hosted workspace is used.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workspace, WorkspaceUpdatePayload } from "../../src/lib/api/workspaces";
import { setAuthOwner } from "../../src/lib/authState";
setAuthOwner("fixture-user");
export const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "UI test workspace",
  role: new URLSearchParams(window.location.search).get("role") || "owner",
  slug: "fixture",
  owner_user_id:
    new URLSearchParams(window.location.search).get("role") === "admin"
      ? "fixture-owner"
      : "fixture-user",
  member_count: 2,
  created_at: "2026-10-01T00:00:00Z",
  settings: {
    default_frameworks: ["SOC 2", "GDPR"],
    retention_days: 365,
    notify_on_critical: true,
  },
  scan_count: 0,
};
export function useAuth() {
  return {
    user: {
      id: "fixture-user",
      email: "fixture@example.invalid",
      user_metadata: { full_name: "UI Test" },
      email_confirmed_at: "2026-10-01T00:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
    },
    isLoading: false,
    isAuthenticated: true,
    status: "authenticated",
    signOut: async () => {
      throw new Error("Sign out is disabled in this fixture");
    },
    resetPassword: async () => {
      throw new Error("Email delivery is disabled in this fixture");
    },
  };
}
export function useActiveWorkspace() {
  return { active: workspace, workspaces: [workspace], isLoading: false, setActive: () => {} };
}
export function useWorkspaces() {
  return { data: [workspace], isLoading: false };
}
export function useCreateWorkspace() {
  return {
    mutateAsync: async () => {
      throw new Error("Workspace creation is disabled in this fixture");
    },
    isPending: false,
  };
}
export function useScans() {
  return { data: { items: [] }, isLoading: false };
}
const state = new URLSearchParams(window.location.search).get("state");
export function useWorkspace() {
  return useQuery({
    queryKey: ["fixture-settings-workspace"],
    queryFn: async () => {
      if (state === "denied") throw new Error("Fixture access denied");
      return { ...workspace } as Workspace;
    },
    retry: false,
  });
}
export function useUpdateWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ updates }: { workspaceId: string; updates: WorkspaceUpdatePayload }) => {
      if (state === "mutation-error") throw new Error("Fixture write rejected");
      Object.assign(workspace, updates);
      return { ...workspace } as Workspace;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["fixture-settings-workspace"] });
    },
  });
}
export function usePendingInvites(id?: string | null) {
  return useQuery({
    queryKey: ["fixture-invites", id],
    enabled: !!id,
    queryFn: async () => {
      if (state === "invites-error") throw new Error("Fixture request failed");
      return [] as import("../../src/lib/api/workspaces").WorkspaceInvite[];
    },
    retry: false,
  });
}
function useFixtureMutation() {
  return useMutation({
    mutationFn: async (_value: unknown) => {
      throw new Error("Member and workspace deletion are disabled in this visual fixture");
    },
  });
}
export const useInviteMember = useFixtureMutation;
export const useRemoveMember = useFixtureMutation;
export const useDeleteWorkspace = useFixtureMutation;
export const useRevokeInvite = useFixtureMutation;
