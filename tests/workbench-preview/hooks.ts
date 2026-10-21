// Non-production test doubles. No real session, account or hosted workspace is used.
export const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "UI test workspace",
  role: "owner",
  slug: "fixture",
  scan_count: 0,
};
export function useAuth() {
  return {
    user: {
      id: "fixture-user",
      email: "fixture@example.invalid",
      user_metadata: { full_name: "UI Test" },
    },
    isLoading: false,
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
