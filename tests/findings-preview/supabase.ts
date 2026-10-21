import { findings, scenario, workspace } from "./data";
export const isSupabaseConfigured = true;
export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: "isolated-fixture-not-a-real-token" } },
      error: null,
    }),
  },
  from(table: string) {
    const filters: Record<string, string> = {};
    let updates: Record<string, string> = {};
    const query = {
      update(value: Record<string, string>) {
        updates = value;
        return query;
      },
      eq(key: string, value: string) {
        filters[key] = value;
        return query;
      },
      select() {
        return query;
      },
      async single() {
        const row = findings.find((f) => f.id === filters.id && f.scan_id === filters.scan_id);
        if (
          table !== "findings" ||
          !row ||
          scenario === "write-error" ||
          workspace.role === "viewer"
        )
          return { data: null, error: new Error("Write denied") };
        Object.assign(row, updates);
        return { data: { id: row.id }, error: null };
      },
    };
    return query;
  },
};
