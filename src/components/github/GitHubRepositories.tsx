import { useEffect, useRef, useState } from "react";
import { authScope, isCurrentScope } from "@/lib/authState";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { gh, githubError, type Integration } from "@/lib/api/github";
import { linkGitHubSignIn } from "@/lib/api/auth";
import { AUDIT_FRAMEWORKS } from "@/lib/workspaceSettings";
import { rememberAudit } from "@/lib/auditResume";

const button = "min-h-10 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50";
const input = "min-h-10 w-full rounded-md border border-border bg-card px-3 text-sm";
export function GitHubRepositories({
  workspaceId,
  role,
  scan = false,
  defaults,
}: {
  workspaceId: string;
  role: string;
  scan?: boolean;
  defaults?: string[];
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [installation, setInstallation] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("");
  const [branch, setBranch] = useState("");
  const [branchPage, setBranchPage] = useState(1);
  const [frameworks, setFrameworks] = useState(defaults ?? ["gdpr", "soc2", "iso27001"]);
  useEffect(() => {
    setRequestKey(crypto.randomUUID());
  }, [selected, branch, frameworks]);
  const [query, setQuery] = useState("");
  const capability = useQuery({
    queryKey: ["github-capabilities", user?.id],
    queryFn: ({ signal }) =>
      gh<{ enabled: boolean; reason: string; install_url?: string }>(
        "/github/capabilities",
        undefined,
        "GET",
        signal,
      ),
    retry: false,
  });
  const connected = useQuery({
    queryKey: ["github-connection", user?.id],
    queryFn: ({ signal }) =>
      gh<{ connected: boolean; login?: string }>("/github/connection", undefined, "GET", signal),
    enabled: capability.data?.enabled === true,
    retry: false,
  });
  const shared = useQuery({
    queryKey: ["github-shared", user?.id, workspaceId],
    queryFn: ({ signal }) =>
      gh<Integration[]>(`/workspaces/${workspaceId}/repositories`, undefined, "GET", signal),
    enabled: capability.data?.enabled === true,
  });
  const installs = useQuery({
    queryKey: ["github-installations", user?.id],
    queryFn: ({ signal }) =>
      gh<{ installations: { id: number; account: { login: string } }[] }>(
        "/github/repositories",
        undefined,
        "GET",
        signal,
      ),
    enabled: connected.data?.connected === true,
  });
  const repos = useQuery({
    queryKey: ["github-repositories", user?.id, installation, page],
    queryFn: ({ signal }) =>
      gh<{
        repositories: { id: number; full_name: string; private: boolean }[];
        total_count: number;
      }>(
        `/github/repositories?installation_id=${installation}&page=${page}`,
        undefined,
        "GET",
        signal,
      ),
    enabled: !!installation && connected.data?.connected === true,
  });
  const branches = useQuery({
    queryKey: ["github-branches", user?.id, workspaceId, selected, branchPage],
    queryFn: ({ signal }) =>
      gh<{ name: string; commit: { sha: string } }[]>(
        `/github/repositories/${selected}/branches?page=${branchPage}`,
        undefined,
        "GET",
        signal,
      ),
    enabled: !!selected && connected.data?.connected === true,
  });
  async function action(run: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      if (alive.current) setError(githubError(e));
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  const admin = ["owner", "admin"].includes(role);
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">GitHub repositories</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect repository access separately from your Archon sign-in. Shared audit results are
          visible to this workspace.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {capability.isPending ? (
        <p role="status">Checking GitHub availability…</p>
      ) : capability.isError ? (
        <button className={button} onClick={() => void capability.refetch()}>
          Retry GitHub availability
        </button>
      ) : !capability.data?.enabled ? (
        <p className="text-sm">{capability.data?.reason}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            {capability.data?.install_url && (
              <a
                className={button + " inline-flex items-center"}
                href={capability.data.install_url}
                target="_blank"
                rel="noreferrer"
              >
                Install / manage repository access
              </a>
            )}
            <span className="text-sm">
              {connected.isPending
                ? "Checking connection…"
                : connected.isError
                  ? "Connection could not be checked"
                  : connected.data?.connected
                    ? `Connected as ${connected.data.login}`
                    : "GitHub is not connected"}
            </span>
            <button
              className={button}
              disabled={busy || connected.isPending || connected.isError}
              onClick={() =>
                void action(async () => {
                  if (connected.data?.connected) {
                    if (
                      !window.confirm(
                        "Disconnect your personal GitHub repository access? Saved audits and GitHub branches and pull requests will remain. Workspace repository sharing is managed separately.",
                      )
                    )
                      return;
                    const scope = authScope();
                    await gh("/github/connection", undefined, "DELETE");
                    if (!alive.current || !isCurrentScope(scope)) return;
                    for (const key of [
                      "github-connection",
                      "github-installations",
                      "github-repositories",
                      "github-branches",
                    ]) {
                      await client.cancelQueries({ queryKey: [key, user?.id] });
                      client.removeQueries({ queryKey: [key, user?.id] });
                    }
                    await connected.refetch();
                  } else {
                    const scope = authScope();
                    const result = await gh<{ url: string }>("/github/connect", {
                      workspace_id: workspaceId,
                    });
                    if (!alive.current || !isCurrentScope(scope)) return;
                    window.location.assign(result.url);
                  }
                })
              }
            >
              {connected.data?.connected ? "Disconnect personal access" : "Connect GitHub"}
            </button>
          </div>
          {connected.data?.connected && admin && (
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="font-medium">Share a repository with this workspace</h3>
              <select
                aria-label="GitHub installation"
                className={input}
                value={installation}
                onChange={(e) => {
                  setInstallation(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Choose installed account</option>
                {installs.data?.installations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.account.login}
                  </option>
                ))}
              </select>
              {installs.data?.installations.length === 0 && (
                <p className="text-sm">
                  Install the Archon GitHub App on your GitHub account, then reconnect.
                </p>
              )}
              <input
                aria-label="Filter this repository page"
                placeholder="Filter repositories on this page"
                className={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {repos.data?.repositories
                .filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()))
                .map((r) => (
                  <div
                    className="flex flex-wrap justify-between gap-2 border-b border-border py-2"
                    key={r.id}
                  >
                    <span className="break-all text-sm">
                      {r.full_name} · {r.private ? "Private" : "Public"}
                    </span>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await gh(`/workspaces/${workspaceId}/repositories`, {
                            repository_id: r.id,
                            installation_id: Number(installation),
                          });
                          await shared.refetch();
                        })
                      }
                    >
                      Share repository
                    </button>
                  </div>
                ))}
              {installation && (
                <div className="flex items-center gap-3 text-sm">
                  <button
                    className={button}
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} · {repos.data?.total_count ?? "…"} repositories
                  </span>
                  <button
                    className={button}
                    disabled={!repos.data || page * 20 >= repos.data.total_count}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
          <h3 className="font-medium">Shared repositories</h3>
          {shared.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No repositories shared. Ask a workspace owner or admin to add one.
            </p>
          )}
          {!scan &&
            shared.data?.map((r) => (
              <div className="flex flex-wrap justify-between gap-2" key={r.id}>
                <span className="break-all text-sm">{r.full_name}</span>
                {admin && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await gh(
                          `/workspaces/${workspaceId}/repositories/${r.id}`,
                          undefined,
                          "DELETE",
                        );
                        await shared.refetch();
                      })
                    }
                  >
                    Disconnect from workspace
                  </button>
                )}
              </div>
            ))}
          {scan && (
            <>
              <select
                aria-label="Shared repository"
                value={selected}
                className={input}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setBranch("");
                  setBranchPage(1);
                }}
              >
                <option value="">Choose shared repository</option>
                {shared.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                  </option>
                ))}
              </select>
              {selected && (
                <>
                  <select
                    aria-label="Repository branch"
                    className={input}
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="">Choose a branch</option>
                    {branches.data?.map((b) => (
                      <option key={b.name}>{b.name}</option>
                    ))}
                  </select>
                  <p className="break-all font-mono text-xs">
                    {branches.data?.find((b) => b.name === branch)?.commit.sha}
                  </p>
                  <div className="flex gap-2">
                    <button
                      className={button}
                      disabled={branchPage === 1}
                      onClick={() => setBranchPage((p) => p - 1)}
                    >
                      Previous branches
                    </button>
                    <button
                      className={button}
                      disabled={branches.data?.length !== 50}
                      onClick={() => setBranchPage((p) => p + 1)}
                    >
                      More branches
                    </button>
                  </div>
                </>
              )}
              <fieldset className="flex flex-wrap gap-3">
                <legend className="mb-2 text-sm font-medium">Assessment frameworks</legend>
                {AUDIT_FRAMEWORKS.map((f) => (
                  <label className="text-sm" key={f.id}>
                    <input
                      type="checkbox"
                      checked={frameworks.includes(f.id)}
                      onChange={(e) =>
                        setFrameworks((old) =>
                          e.target.checked ? [...old, f.id] : old.filter((x) => x !== f.id),
                        )
                      }
                    />{" "}
                    {f.label}
                  </label>
                ))}
              </fieldset>
              <button
                className={button + " bg-primary text-primary-foreground"}
                disabled={
                  busy ||
                  !branch ||
                  !branches.data?.some((item) => item.name === branch) ||
                  !selected ||
                  frameworks.length === 0 ||
                  role === "viewer" ||
                  !connected.data?.connected
                }
                onClick={() =>
                  void action(async () => {
                    const result = await gh<{ scan_id: string }>(
                      `/workspaces/${workspaceId}/repository-audits`,
                      {
                        integration_id: selected,
                        branch,
                        frameworks,
                        idempotency_key: requestKey,
                        commit_sha: branches.data?.find((item) => item.name === branch)?.commit.sha,
                      },
                    );
                    if (!alive.current) return;
                    rememberAudit(workspaceId, {
                      id: result.scan_id,
                      name:
                        shared.data?.find((item: Integration) => item.id === selected)?.full_name ||
                        "Repository audit",
                      created: new Date().toISOString(),
                    });
                    window.location.assign(
                      `/workspace/${workspaceId}/scans/${result.scan_id}/workbench`,
                    );
                  })
                }
              >
                {busy ? "Preparing repository scan…" : "Start repository scan"}
              </button>
            </>
          )}
          {[connected, shared, installs, repos, branches].some((q) => q.isError) && (
            <button
              className={button}
              onClick={() =>
                void action(async () => {
                  await Promise.all([
                    connected.refetch(),
                    shared.refetch(),
                    installs.refetch(),
                    ...(installation ? [repos.refetch()] : []),
                    ...(selected ? [branches.refetch()] : []),
                  ]);
                })
              }
            >
              Repository request failed · Retry
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function GitHubAccounts() {
  const { user } = useAuth();
  const linked = user?.identities?.some((identity) => identity.provider === "github");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h2 className="text-lg font-semibold">Connected sign-in accounts</h2>
      <p className="text-sm text-muted-foreground">
        Link GitHub as another way to sign into this Archon account. Repository access is connected
        separately.
      </p>
      <button
        className={button}
        disabled={busy || linked}
        onClick={() => {
          setBusy(true);
          void linkGitHubSignIn().catch(() => {
            setError(
              "GitHub sign-in linking is unavailable. Enable manual identity linking in Supabase, then retry.",
            );
            setBusy(false);
          });
        }}
      >
        {linked ? "GitHub sign-in linked" : "Link GitHub sign-in"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
