export const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Reports QA",
  slug: "qa",
  role: "owner",
  scan_count: 31,
};
export function useAuth() {
  return {
    user: {
      id: "fixture-user",
      email: "fixture@example.invalid",
      user_metadata: { full_name: "Fixture User" },
    },
    isLoading: false,
    status: "authenticated",
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
      throw new Error("Isolated QA");
    },
    isPending: false,
  };
}
