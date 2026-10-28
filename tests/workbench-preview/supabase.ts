import { workspace } from "./hooks";
const state = new URLSearchParams(window.location.search).get("state");
type Row = Record<string, unknown>;
const scanId = "22222222-2222-4222-8222-222222222222";
const removed = new Set<string>();
export const isSupabaseConfigured = true;
export const supabase = {
  from: (table: string) => {
    const filters: Array<[string, string, unknown]> = [];
    let from = 0,
      to = 10000,
      single = false,
      writing = "";
    function result() {
      if (
        writing &&
        !(
          writing === "delete" &&
          table === "scans" &&
          ["delete-success", "delete-zero"].includes(state || "") &&
          ["owner", "admin"].includes(workspace.role)
        )
      )
        return {
          data: null,
          count: 0,
          error: { code: "42501", message: "Fixture write rejected" },
        };
      if (
        (table === "scans" && state === "history-error") ||
        (table === "workspace_members" && state === "members-error")
      )
        return {
          data: null,
          count: null,
          error: { code: "fixture", message: "Fixture request failed" },
        };
      const own = {
        workspace_id: workspace.id,
        user_id: "fixture-user",
        role: workspace.role,
        created_at: "2026-10-01T00:00:00Z",
      };
      let rows: Row[] =
        table === "workspaces"
          ? state === "denied"
            ? []
            : [workspace]
          : table === "workspace_members"
            ? [
                own,
                {
                  workspace_id: workspace.id,
                  user_id: "fixture-member",
                  role: "analyst",
                  created_at: "2026-10-01T00:00:00Z",
                },
              ]
            : table === "profiles"
              ? [
                  { id: "fixture-user", display_name: "UI Test", email: "fixture@example.invalid" },
                  {
                    id: "fixture-member",
                    display_name: "Sample Analyst",
                    email: "analyst@example.invalid",
                  },
                ]
              : table === "scans" && state !== "empty"
                ? Array.from({ length: 54 }, (_, i) => ({
                    id: i === 0 ? scanId : `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`,
                    workspace_id: workspace.id,
                    scan_type: "codebase",
                    target_name: `Fixture project ${i + 1}`,
                    status:
                      i === 0
                        ? "completed"
                        : i % 7 === 0
                          ? "failed"
                          : i % 11 === 0
                            ? "running"
                            : "completed",
                    created_at: new Date(Date.now() - i * 86400000).toISOString(),
                    completed_at: new Date(Date.now() - i * 86400000).toISOString(),
                    selected_frameworks: ["soc2"],
                    finding_count: 2,
                  }))
                : [];
      rows = rows.filter(
        (row) =>
          !removed.has(String(row.id)) &&
          filters.every(([op, key, value]) => {
            if (op === "eq") return row[key] === value;
            if (op === "neq") return row[key] !== value;
            if (op === "in") return (value as unknown[]).includes(row[key]);
            if (op === "ilike")
              return String(row[key])
                .toLowerCase()
                .includes(
                  String(value)
                    .slice(1, -1)
                    .replace(/\\([%_\\])/g, "$1")
                    .toLowerCase(),
                );
            return true;
          }),
      );
      if (writing === "delete") {
        if (state === "delete-zero") return { data: [], error: null };
        for (const row of rows) removed.add(String(row.id));
        return { data: rows.map((row) => ({ id: row.id })), error: null };
      }
      return {
        data: single ? (rows[0] ?? null) : rows.slice(from, to + 1),
        count: rows.length,
        error: null,
      };
    }
    const query: Record<string, unknown> = {};
    for (const op of ["eq", "neq", "in", "ilike", "gt"])
      query[op] = (key: string, value: unknown) => {
        filters.push([op, key, value]);
        return query;
      };
    for (const op of ["select", "order", "abortSignal"]) query[op] = () => query;
    for (const op of ["update", "delete", "insert"])
      query[op] = () => {
        writing = op;
        return query;
      };
    query.range = (start: number, end: number) => {
      from = start;
      to = end;
      return query;
    };
    query.maybeSingle = query.single = () => {
      single = true;
      return Promise.resolve(result());
    };
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return query;
  },
  auth: {
    updateUser: async ({ data }: { data: Record<string, string> }) =>
      state === "name-error"
        ? { data: { user: null }, error: new Error("Fixture rejected write") }
        : { data: { user: { id: "fixture-user", user_metadata: data } }, error: null },
    getSession: async () => ({
      data: { session: { access_token: "isolated-ui-fixture-not-a-real-token" } },
      error: null,
    }),
    getUser: async () => ({ data: { user: { id: "fixture-user" } }, error: null }),
  },
};
