import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, FloppyDisk, Trash, UserPlus } from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { GitHubRepositories } from "@/components/github/GitHubRepositories";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import { useAuth } from "@/hooks/useAuth";
import {
  useWorkspace,
  useActiveWorkspace,
  useUpdateWorkspace,
  useInviteMember,
  useRemoveMember,
  useDeleteWorkspace,
  usePendingInvites,
  useRevokeInvite,
} from "@/hooks/useWorkspace";
import {
  fetchMembers,
  updateMemberRole,
  type Workspace,
  type WorkspaceRole,
} from "@/lib/api/workspaces";
import { getWorkbenchCapabilities } from "@/lib/api/workbench";
import { authScope, isCurrentScope } from "@/lib/authState";
import {
  AUDIT_FRAMEWORKS,
  auditDefaults,
  canManageMember,
  canManageWorkspace,
  mergeAuditDefaults,
  validateWorkspaceDetails,
  validInviteEmail,
} from "@/lib/workspaceSettings";

const inputClass =
  "mt-1.5 min-h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground disabled:opacity-60";
const roles: Exclude<WorkspaceRole, "owner">[] = ["admin", "analyst", "viewer"];
function RoleOptions() {
  return roles.map((role) => (
    <option key={role} value={role}>
      {role[0].toUpperCase() + role.slice(1)}
    </option>
  ));
}
function Feedback({ error, success }: { error?: string; success?: string }) {
  return error || success ? (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-md border p-3 text-sm ${error ? "border-destructive/30 text-destructive" : "border-success/30 text-success"}`}
    >
      {error || success}
    </p>
  ) : null;
}
function Failure({ children, retry }: { children: ReactNode; retry: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm">
      <p>{children}</p>
      <BrutalButton size="sm" variant="secondary" className="mt-3" onClick={retry}>
        Retry
      </BrutalButton>
    </div>
  );
}
export function WorkspaceSettingsPage({ workspaceId }: { workspaceId: string }) {
  const workspace = useWorkspace(workspaceId);
  const { active, workspaces, setActive } = useActiveWorkspace();
  useEffect(() => {
    if (
      workspace.data &&
      active?.id !== workspaceId &&
      workspaces?.some((item) => item.id === workspaceId)
    )
      setActive(workspaceId);
  }, [workspace.data, workspaceId, active?.id, workspaces, setActive]);
  if (workspace.isPending)
    return (
      <AppShell title="Workspace settings">
        <p role="status" className="p-5 text-sm">
          Loading workspace settings…
        </p>
      </AppShell>
    );
  if (workspace.isError || !workspace.data)
    return (
      <AppShell title="Workspace settings">
        <Failure retry={() => void workspace.refetch()}>
          This workspace could not be loaded. It may be unavailable, access may have changed, or the
          service may be temporarily unreachable.
        </Failure>
      </AppShell>
    );
  return <SettingsForm workspace={workspace.data} />;
}
function SettingsForm({ workspace }: { workspace: Workspace }) {
  const { user } = useAuth();
  const id = workspace.id;
  const navigate = useNavigate();
  const client = useQueryClient();
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const current = useRef(workspace);
  current.current = workspace;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const allowed = canManageWorkspace(workspace.role);
  const owner = workspace.role === "owner" && workspace.owner_user_id === user?.id;
  const members = useQuery({
    queryKey: ["workspace-members", id, user?.id],
    queryFn: () => fetchMembers(id),
    enabled: !!user,
    staleTime: 30000,
    retry: false,
  });
  const invites = usePendingInvites(allowed ? id : null);
  const capabilities = useQuery({
    queryKey: ["workbench-capabilities", user?.id, id],
    queryFn: ({ signal }) => getWorkbenchCapabilities(signal),
    staleTime: 60000,
    retry: false,
  });
  const update = useUpdateWorkspace();
  const invite = useInviteMember(id);
  const remove = useRemoveMember(id);
  const revoke = useRevokeInvite(id);
  const deletion = useDeleteWorkspace();
  const roleChange = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(id, userId, role),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["workspace-members", id] });
      void client.invalidateQueries({ queryKey: ["workspaces"] });
      void client.invalidateQueries({ queryKey: ["workspace", id] });
    },
  });
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [selected, setSelected] = useState(() => auditDefaults(workspace.settings));
  const generalTouched = useRef(false);
  const defaultsTouched = useRef(false);
  useEffect(() => {
    if (!generalTouched.current) {
      setName(workspace.name);
      setSlug(workspace.slug);
    }
    if (!defaultsTouched.current) setSelected(auditDefaults(workspace.settings));
  }, [workspace]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("analyst");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { error?: string; success?: string }>>(
    {},
  );
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  async function perform(
    key: string,
    operation: (scope: ReturnType<typeof authScope>) => Promise<void>,
    success: string,
  ) {
    if (busyRef.current) return;
    const scope = authScope();
    busyRef.current = true;
    setBusy(key);
    setFeedback((old) => ({ ...old, [key]: {} }));
    try {
      await operation(scope);
      if (mounted.current && isCurrentScope(scope))
        setFeedback((old) => ({ ...old, [key]: { success } }));
    } catch {
      if (mounted.current && isCurrentScope(scope))
        setFeedback((old) => ({
          ...old,
          [key]: {
            error:
              "The change could not be confirmed. Check your access and try again. Your entered values have been kept.",
          },
        }));
    } finally {
      busyRef.current = false;
      if (mounted.current && isCurrentScope(scope)) setBusy(null);
    }
  }
  async function saveGeneral(event: FormEvent) {
    event.preventDefault();
    if (!allowed) return;
    const invalid = validateWorkspaceDetails(name, slug);
    if (invalid) {
      setFeedback((old) => ({ ...old, general: { error: invalid } }));
      return;
    }
    await perform(
      "general",
      async (scope) => {
        const saved = await update.mutateAsync({
          workspaceId: id,
          updates: { name: name.trim(), slug: slug.trim().toLowerCase() },
        });
        if (mounted.current && isCurrentScope(scope)) {
          generalTouched.current = false;
          setName(saved.name);
          setSlug(saved.slug);
        }
      },
      "Workspace details saved.",
    );
  }
  async function saveDefaults(event: FormEvent) {
    event.preventDefault();
    if (!allowed || !selected.length) return;
    await perform(
      "defaults",
      async (scope) => {
        await update.mutateAsync({
          workspaceId: id,
          updates: { settings: mergeAuditDefaults(current.current.settings, selected) },
        });
        if (mounted.current && isCurrentScope(scope)) defaultsTouched.current = false;
      },
      "Default frameworks saved. They apply to new audit uploads.",
    );
  }
  async function createInvite(event: FormEvent) {
    event.preventDefault();
    if (!allowed || members.isError || invites.isError || !members.data || !invites.data) return;
    const address = email.trim().toLowerCase();
    const duplicate =
      members.data.some((m) => m.email?.toLowerCase() === address) ||
      invites.data.some((item) => item.invited_email.toLowerCase() === address);
    if (!validInviteEmail(address) || duplicate) {
      setFeedback((old) => ({
        ...old,
        invitations: {
          error: duplicate
            ? "This email is already a member or has a pending invitation."
            : "Enter a valid email address.",
        },
      }));
      return;
    }
    await perform(
      "invitations",
      async (scope) => {
        await invite.mutateAsync({ email: address, role });
        if (mounted.current && isCurrentScope(scope)) setEmail("");
      },
      "Invitation created. Email delivery is not confirmed by this application.",
    );
  }
  const generalChanged =
    name.trim() !== workspace.name || slug.trim().toLowerCase() !== workspace.slug;
  const defaultsChanged =
    [...selected].sort().join(",") !== auditDefaults(workspace.settings).sort().join(",");
  return (
    <AppShell title="Workspace settings" subtitle={`Workspace · ${workspace.name}`}>
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-8">
        <GitHubRepositories key={workspace.id} workspaceId={workspace.id} role={workspace.role} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Manage details, audit defaults and team access. Your role:{" "}
            <span className="font-medium capitalize text-foreground">{workspace.role}</span>.
          </p>
          <Link
            to="/workspace"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs hover:bg-secondary"
          >
            Open Codebase Audit
          </Link>
        </div>
        <SectionCard
          title="General information"
          description={
            allowed
              ? "Update how this workspace is identified."
              : "Only owners and admins can change workspace details."
          }
        >
          <form onSubmit={(event) => void saveGeneral(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Workspace name
                <input
                  className={inputClass}
                  value={name}
                  maxLength={120}
                  disabled={!allowed || !!busy}
                  onChange={(event) => {
                    generalTouched.current = true;
                    setFeedback((old) => ({ ...old, general: {} }));
                    setName(event.target.value);
                  }}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                URL slug
                <input
                  className={inputClass}
                  value={slug}
                  maxLength={63}
                  disabled={!allowed || !!busy}
                  onChange={(event) => {
                    generalTouched.current = true;
                    setFeedback((old) => ({ ...old, general: {} }));
                    setSlug(event.target.value);
                  }}
                  required
                />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  2–63 lowercase letters, numbers and internal hyphens. The workspace ID stays
                  unchanged.
                </span>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 p-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Workspace ID</p>
                <code className="break-all text-xs">{id}</code>
              </div>
              <BrutalButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(id)
                    .then(() => {
                      if (!mounted.current) return;
                      setCopied(true);
                      if (copyTimer.current) clearTimeout(copyTimer.current);
                      copyTimer.current = setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() =>
                      setFeedback((old) => ({
                        ...old,
                        general: {
                          error: "Could not copy. Select and copy the workspace ID above.",
                        },
                      })),
                    );
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy ID"}
              </BrutalButton>
            </div>
            <Feedback {...feedback.general} />
            {allowed && (
              <div className="flex flex-wrap items-center gap-3">
                <BrutalButton type="submit" size="sm" disabled={!!busy || !generalChanged}>
                  <FloppyDisk size={15} />
                  {busy === "general" ? "Saving…" : "Save details"}
                </BrutalButton>
                {generalChanged && (
                  <span className="text-xs text-muted-foreground">Unsaved changes</span>
                )}
              </div>
            )}
          </form>
        </SectionCard>
        <SectionCard
          title="Audit defaults"
          description="Frameworks preselected for new ZIP uploads. Each audit can use a different selection."
        >
          <form onSubmit={(event) => void saveDefaults(event)} className="space-y-4">
            <fieldset disabled={!allowed || !!busy}>
              <legend className="text-sm font-medium">Default frameworks</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {AUDIT_FRAMEWORKS.map((framework) => (
                  <label
                    key={framework.id}
                    className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={selected.includes(framework.id)}
                      onChange={() => {
                        defaultsTouched.current = true;
                        setFeedback((old) => ({ ...old, defaults: {} }));
                        setSelected((old) =>
                          old.includes(framework.id)
                            ? old.filter((value) => value !== framework.id)
                            : [...old, framework.id],
                        );
                      }}
                    />
                    {framework.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-muted-foreground">
              Select at least one supported framework. Saving replaces older unsupported default
              choices; other stored preferences are kept.
            </p>
            <Feedback {...feedback.defaults} />
            {allowed && (
              <BrutalButton
                type="submit"
                size="sm"
                disabled={!!busy || !selected.length || !defaultsChanged}
              >
                <FloppyDisk size={15} />
                {busy === "defaults" ? "Saving…" : "Save audit defaults"}
              </BrutalButton>
            )}
          </form>
          <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <h4 className="text-sm font-medium">Source preview retention</h4>
              <p className="mt-2 text-sm">
                {capabilities.isError
                  ? "Server policy unavailable"
                  : typeof capabilities.data?.retention_hours === "number" &&
                      Number.isFinite(capabilities.data.retention_hours) &&
                      capabilities.data.retention_hours > 0
                    ? `${capabilities.data.retention_hours / 24} days`
                    : capabilities.isPending
                      ? "Checking server policy…"
                      : "Server policy unavailable"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Source previews expire separately from saved findings and reports. The old retention
                preference does not enforce this policy.
              </p>
              {capabilities.isError && (
                <button
                  type="button"
                  onClick={() => void capabilities.refetch()}
                  className="mt-2 text-xs text-accent underline"
                >
                  Retry policy check
                </button>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <h4 className="text-sm font-medium">Critical finding alerts</h4>
              <p className="mt-2 text-sm">Not available</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Automatic alert delivery is not configured. Existing preferences are kept, but do
                not send notifications. Review critical findings in Findings.
              </p>
            </div>
          </div>
        </SectionCard>
        <SectionCard
          title="Members"
          description="Owners and admins can manage other non-owner members. Ownership cannot be changed here."
        >
          {members.isError ? (
            <Failure retry={() => void members.refetch()}>
              Could not load workspace members.
            </Failure>
          ) : members.isPending ? (
            <p role="status" className="text-sm">
              Loading members…
            </p>
          ) : !members.data?.length ? (
            <p className="text-sm text-muted-foreground">
              No visible member records. Refresh before managing access.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {members.data.map((member) => {
                const editable = canManageMember(
                  workspace.role,
                  workspace.owner_user_id,
                  user?.id || "",
                  member,
                );
                const key = `member:${member.user_id}`;
                return (
                  <li key={member.user_id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">
                          {member.display_name || member.email || "Workspace member"}
                          {member.user_id === user?.id ? " (you)" : ""}
                        </p>
                        {member.email && (
                          <p className="break-all text-xs text-muted-foreground">{member.email}</p>
                        )}
                        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                          {member.user_id}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {editable ? (
                          <select
                            aria-label={`Role for ${member.email || member.display_name || member.user_id}`}
                            value={member.role}
                            disabled={!!busy}
                            className="min-h-9 rounded-md border border-border bg-card px-2 text-sm"
                            onChange={(event) => {
                              const role = event.target.value;
                              void perform(
                                key,
                                async () => {
                                  await roleChange.mutateAsync({ userId: member.user_id, role });
                                },
                                "Member role saved.",
                              );
                            }}
                          >
                            <RoleOptions />
                          </select>
                        ) : (
                          <span className="rounded border border-border px-2 py-1 text-xs capitalize">
                            {member.user_id === workspace.owner_user_id ? "owner" : member.role}
                          </span>
                        )}
                        {editable && (
                          <BrutalButton
                            size="sm"
                            variant="secondary"
                            disabled={!!busy}
                            onClick={() => setRemoveId(member.user_id)}
                          >
                            <Trash size={14} />
                            Remove
                          </BrutalButton>
                        )}
                      </div>
                    </div>
                    {editable && removeId === member.user_id && (
                      <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 p-3 text-xs">
                        <span>Remove this member’s workspace access?</span>
                        <BrutalButton
                          size="sm"
                          disabled={!!busy}
                          onClick={() =>
                            void perform(
                              key,
                              async (scope) => {
                                await remove.mutateAsync(member.user_id);
                                if (mounted.current && isCurrentScope(scope)) setRemoveId(null);
                              },
                              "Member removed.",
                            )
                          }
                        >
                          {busy === key ? "Removing…" : "Confirm remove"}
                        </BrutalButton>
                        <BrutalButton
                          size="sm"
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() => setRemoveId(null)}
                        >
                          Cancel
                        </BrutalButton>
                      </div>
                    )}
                    {busy === key && removeId !== member.user_id && (
                      <p role="status" className="text-xs text-muted-foreground">
                        Saving member role…
                      </p>
                    )}
                    <Feedback {...feedback[key]} />
                  </li>
                );
              })}
            </ul>
          )}
          {Object.entries(feedback)
            .filter(
              ([key, value]) =>
                value.success &&
                key.startsWith("member:") &&
                !members.data?.some((member) => key === `member:${member.user_id}`),
            )
            .map(([key, value]) => (
              <Feedback key={key} {...value} />
            ))}
        </SectionCard>
        {allowed && (
          <SectionCard
            title="Invitations"
            description="Create and revoke pending invitations. Creating an invitation does not confirm email delivery."
          >
            <form onSubmit={(event) => void createInvite(event)} className="space-y-4">
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                <label className="text-sm font-medium">
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    className={inputClass}
                    value={email}
                    maxLength={254}
                    disabled={!!busy}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Role
                  <select
                    className={inputClass}
                    value={role}
                    disabled={!!busy}
                    onChange={(event) =>
                      setRole(event.target.value as Exclude<WorkspaceRole, "owner">)
                    }
                  >
                    <RoleOptions />
                  </select>
                </label>
                <BrutalButton
                  type="submit"
                  size="sm"
                  className="min-h-10"
                  disabled={
                    !!busy ||
                    !validInviteEmail(email.trim()) ||
                    members.isError ||
                    invites.isError ||
                    !members.data ||
                    !invites.data
                  }
                >
                  <UserPlus size={15} />
                  {busy === "invitations" ? "Creating…" : "Create invitation"}
                </BrutalButton>
              </div>
              <Feedback {...feedback.invitations} />
            </form>
            <div className="mt-5 border-t border-border pt-4">
              <h4 className="mb-3 text-sm font-medium">Pending invitations</h4>
              {invites.isError ? (
                <Failure retry={() => void invites.refetch()}>
                  Could not load pending invitations. Retry before creating another invitation.
                </Failure>
              ) : invites.isPending ? (
                <p role="status" className="text-sm">
                  Loading invitations…
                </p>
              ) : !invites.data?.length ? (
                <p className="text-sm text-muted-foreground">No pending invitations.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {invites.data.map((item) => (
                    <li key={item.id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-all text-sm">{item.invited_email}</p>
                          <p className="mt-1 text-xs capitalize text-muted-foreground">
                            {item.role} · Expires {new Date(item.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <BrutalButton
                          size="sm"
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() =>
                            void perform(
                              `invite:${item.id}`,
                              async () => {
                                await revoke.mutateAsync(item.id);
                              },
                              "Invitation revoked.",
                            )
                          }
                        >
                          {busy === `invite:${item.id}` ? "Revoking…" : "Revoke"}
                        </BrutalButton>
                      </div>
                      <Feedback {...feedback[`invite:${item.id}`]} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {Object.entries(feedback)
              .filter(
                ([key, value]) =>
                  value.success &&
                  key.startsWith("invite:") &&
                  !invites.data?.some((item) => key === `invite:${item.id}`),
              )
              .map(([key, value]) => (
                <Feedback key={key} {...value} />
              ))}
          </SectionCard>
        )}
        {owner && (
          <SectionCard
            title="Delete workspace"
            description="Owner only. This permanently removes this workspace and its associated saved records."
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!owner || deleteName !== workspace.name) return;
                void perform(
                  "delete",
                  async (scope) => {
                    await deletion.mutateAsync(id);
                    if (mounted.current && isCurrentScope(scope))
                      void navigate({ to: "/dashboard", replace: true });
                  },
                  "Workspace deleted.",
                );
              }}
            >
              <label className="block text-sm font-medium">
                Type <span className="break-all">{workspace.name}</span> to confirm
                <input
                  className={inputClass}
                  value={deleteName}
                  disabled={!!busy}
                  autoComplete="off"
                  onChange={(event) => setDeleteName(event.target.value)}
                />
              </label>
              <Feedback {...feedback.delete} />
              <BrutalButton
                type="submit"
                size="sm"
                variant="secondary"
                className="border border-destructive/40 text-destructive"
                disabled={!!busy || deleteName !== workspace.name}
              >
                <Trash size={15} />
                {busy === "delete" ? "Deleting…" : "Delete workspace"}
              </BrutalButton>
            </form>
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
}
