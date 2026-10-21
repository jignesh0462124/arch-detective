import { workspace } from "./data";
export function useAuth() {
  return {
    user: {
      id: "fixture-user",
      email: "fixture@example.invalid",
      user_metadata: { full_name: "Fixture User" },
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
      throw new Error("Workspace creation is disabled in the fixture");
    },
    isPending: false,
  };
}
