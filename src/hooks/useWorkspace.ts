import { useAuth } from "@/hooks/useAuth";
import { accountStorage } from "@/lib/authState";
/**
 * useWorkspace.ts
 * React hooks for managing workspace state, project-wise switching, and CRUD operations.
 * Connected directly to the Supabase database.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import {
  fetchWorkspaces,
  fetchWorkspace,
  createWorkspace,
  updateWorkspace,
  inviteMember,
  removeMember,
  fetchPendingInvites,
  revokeInvite,
  type Workspace,
  type WorkspaceUpdatePayload,
} from "@/lib/api/workspaces";

const ACTIVE_WS_KEY = "threatlens-active-workspace";

export function useWorkspaces() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["workspaces", user?.id],
    queryFn: async () => {
      const list = await fetchWorkspaces();
      return list ?? [];
    },
    staleTime: 30_000,
    enabled: isAuthenticated,
  });
}

export function useWorkspace(workspaceId: string | null | undefined) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["workspace", workspaceId, user?.id],
    queryFn: () => fetchWorkspace(workspaceId!),
    enabled: isAuthenticated && Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function usePendingInvites(workspaceId: string | null | undefined) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["workspace-invites", workspaceId, user?.id],
    queryFn: () => (workspaceId ? fetchPendingInvites(workspaceId) : Promise.resolve([])),
    enabled: isAuthenticated && Boolean(workspaceId),
    staleTime: 10_000,
  });
}

export function useRevokeInvite(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-invites", workspaceId] });
    },
  });
}

export function useActiveWorkspace() {
  const { user } = useAuth();
  const { data: workspaces, isLoading, isError, error } = useWorkspaces();
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return accountStorage.getItem(ACTIVE_WS_KEY);
  });

  useEffect(() => {
    setActiveId(accountStorage.getItem(ACTIVE_WS_KEY));
  }, [user?.id]);

  // Listen for workspace change events dispatched across tabs/components
  useEffect(() => {
    const handleWorkspaceChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ workspaceId: string }>;
      if (customEvent.detail?.workspaceId) {
        setActiveId(customEvent.detail.workspaceId);
      }
    };
    window.addEventListener("threatlens-workspace-changed", handleWorkspaceChange);
    return () => {
      window.removeEventListener("threatlens-workspace-changed", handleWorkspaceChange);
    };
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") {
      accountStorage.setItem(ACTIVE_WS_KEY, id);
      window.dispatchEvent(
        new CustomEvent("threatlens-workspace-changed", { detail: { workspaceId: id } }),
      );
    }
  }, []);

  // Determine active workspace: match stored ID, or fallback to first available database workspace
  const active: Workspace | undefined =
    workspaces?.find((w) => w.id === activeId) ?? workspaces?.[0];

  // If activeId wasn't set or became invalid, update accountStorage to the first valid workspace
  useEffect(() => {
    if (active && active.id !== activeId) {
      setActiveId(active.id);
      if (typeof window !== "undefined") {
        accountStorage.setItem(ACTIVE_WS_KEY, active.id);
      }
    }
  }, [active, activeId]);

  return { active, activeId, workspaces: workspaces ?? [], isLoading, isError, error, setActive };
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const { setActive } = useActiveWorkspace();

  return useMutation({
    mutationFn: ({ name, slug }: { name: string; slug: string }) => createWorkspace(name, slug),
    onSuccess: (newWorkspace) => {
      // Invalidate queries so lists refresh
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      // Switch immediately to the newly created project workspace
      if (newWorkspace?.id) {
        setActive(newWorkspace.id);
      }
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      updates,
    }: {
      workspaceId: string;
      updates: WorkspaceUpdatePayload | string;
    }) => updateWorkspace(workspaceId, updates),
    onSuccess: (updatedWs) => {
      if (updatedWs?.id) {
        void queryClient.invalidateQueries({ queryKey: ["workspace", updatedWs.id] });
      }
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      inviteMember(workspaceId, email, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-invites", workspaceId] });
    },
  });
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(workspaceId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { deleteWorkspace } = await import("@/lib/api/workspaces");
      await deleteWorkspace(workspaceId);
    },
    onSuccess: (_data, workspaceId) => {
      if (typeof window !== "undefined") {
        const stored = accountStorage.getItem(ACTIVE_WS_KEY);
        if (stored === workspaceId) {
          accountStorage.removeItem(ACTIVE_WS_KEY);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
