import { RequireAuth } from "@/components/auth/RequireAuth";
import { useState, useEffect } from "react";
import { createFileRoute, useParams, Navigate, useNavigate } from "@tanstack/react-router";
import {
  CircleNotch,
  Trash,
  UserPlus,
  Shield,
  ShieldCheck,
  CaretDown,
  FloppyDisk,
  Copy,
  Check,
  Envelope,
  Clock,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { SectionCard } from "@/components/ui/section-card";
import {
  useWorkspace,
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
  type WorkspaceRole,
  type WorkspaceSettings,
} from "@/lib/api/workspaces";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workspace/$workspaceId/settings")({
  head: () => ({
    meta: [
      { title: "Workspace Settings · Archon" },
      { name: "description", content: "Manage workspace general preferences, security baseline, and team members." },
    ],
  }),
  component: () => <RequireAuth><WorkspaceSettingsPage /></RequireAuth>,
});

const ROLE_ORDER: WorkspaceRole[] = ["owner", "admin", "analyst", "viewer"];

const AVAILABLE_FRAMEWORKS = [
  "SOC 2",
  "ISO 27001",
  "GDPR",
  "PCI DSS",
  "HIPAA",
  "NIST CSF",
  "CIS Benchmarks",
];

const RETENTION_OPTIONS = [
  { days: 30, label: "30 Days (Standard Audit Trail)" },
  { days: 90, label: "90 Days (Quarterly Compliance)" },
  { days: 180, label: "180 Days (Extended Review)" },
  { days: 365, label: "365 Days (Annual Compliance Archive)" },
];

function roleColor(role: WorkspaceRole): string {
  switch (role) {
    case "owner":   return "bg-primary/15 text-primary border border-primary/30";
    case "admin":   return "bg-secondary/15 text-secondary-foreground border border-secondary/30";
    case "analyst": return "bg-success/10 text-success border border-success/30";
    case "viewer":  return "bg-muted text-muted-foreground border border-border";
    default:        return "bg-muted text-muted-foreground border border-border";
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function WorkspaceSettingsPage() {
  const { workspaceId } = useParams({ from: "/workspace/$workspaceId/settings" });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Queries
  const { data: workspace, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId, user?.id],
    queryFn: () => fetchMembers(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
  const { data: pendingInvites = [], isLoading: invitesLoading } = usePendingInvites(workspaceId);

  // Mutations
  const updateWs = useUpdateWorkspace();
  const invite = useInviteMember(workspaceId);
  const revokeInvite = useRevokeInvite(workspaceId);
  const remove = useRemoveMember(workspaceId);
  const deleteWs = useDeleteWorkspace();

  const roleChange = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(workspaceId, userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
  });

  // Section 1: General Info Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Section 2: Security Baseline Form State
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([
    "SOC 2",
    "ISO 27001",
    "GDPR",
  ]);
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [notifyOnCritical, setNotifyOnCritical] = useState<boolean>(true);
  const [baselineSuccess, setBaselineSuccess] = useState<string | null>(null);
  const [baselineError, setBaselineError] = useState<string | null>(null);

  // Section 3: Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("analyst");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Section 4: Removal and Danger Zone Confirmation State
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync state when workspace loads
  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setSlug(workspace.slug);
      if (workspace.settings) {
        if (Array.isArray(workspace.settings.default_frameworks)) {
          setSelectedFrameworks(workspace.settings.default_frameworks);
        }
        if (typeof workspace.settings.retention_days === "number") {
          setRetentionDays(workspace.settings.retention_days);
        }
        if (typeof workspace.settings.notify_on_critical === "boolean") {
          setNotifyOnCritical(workspace.settings.notify_on_critical);
        }
      }
    }
  }, [workspace]);

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role ?? workspace?.role;
  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

  if (!wsLoading && !workspace) {
    return <Navigate to="/dashboard" />;
  }

  // Copy Workspace ID helper
  async function handleCopyId() {
    if (!workspaceId) return;
    try {
      await navigator.clipboard.writeText(workspaceId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback
    }
  }

  // Handle General Settings Update
  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (!trimmedName) {
      setGeneralError("Workspace name cannot be empty.");
      return;
    }

    if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(trimmedSlug)) {
      setGeneralError(
        "Slug must be 2-63 characters, lowercase alphanumeric with hyphens, and not start or end with a hyphen.",
      );
      return;
    }

    try {
      await updateWs.mutateAsync({
        workspaceId,
        updates: {
          name: trimmedName,
          slug: trimmedSlug,
        },
      });
      setGeneralSuccess("Workspace details updated successfully.");
      setTimeout(() => setGeneralSuccess(null), 4000);
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Failed to update workspace.");
    }
  }

  // Handle Compliance Baseline Save
  async function handleSaveBaseline(e: React.FormEvent) {
    e.preventDefault();
    setBaselineError(null);
    setBaselineSuccess(null);

    const updatedSettings: WorkspaceSettings = {
      default_frameworks: selectedFrameworks,
      retention_days: retentionDays,
      notify_on_critical: notifyOnCritical,
    };

    try {
      await updateWs.mutateAsync({
        workspaceId,
        updates: {
          settings: updatedSettings,
        },
      });
      setBaselineSuccess("Security & compliance baseline saved.");
      setTimeout(() => setBaselineSuccess(null), 4000);
    } catch (err: unknown) {
      setBaselineError(err instanceof Error ? err.message : "Failed to update security baseline.");
    }
  }

  // Toggle Security Framework selection
  function toggleFramework(framework: string) {
    setSelectedFrameworks((prev) =>
      prev.includes(framework)
        ? prev.filter((f) => f !== framework)
        : [...prev, framework],
    );
  }

  // Handle Member Invitation
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    const cleanedEmail = inviteEmail.trim().toLowerCase();
    if (!cleanedEmail || !cleanedEmail.includes("@") || !cleanedEmail.includes(".")) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    // Check if already in members
    if (members.some((m) => m.email?.toLowerCase() === cleanedEmail)) {
      setInviteError("A member with this email address already belongs to this workspace.");
      return;
    }

    // Check if already invited
    if (pendingInvites.some((inv) => inv.invited_email.toLowerCase() === cleanedEmail)) {
      setInviteError("An invitation has already been sent to this email address.");
      return;
    }

    try {
      await invite.mutateAsync({ email: cleanedEmail, role: inviteRole });
      setInviteSuccess(`Invitation sent to ${cleanedEmail}.`);
      setInviteEmail("");
      setTimeout(() => setInviteSuccess(null), 5000);
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation.");
    }
  }

  // Handle Workspace Deletion
  async function handleDeleteWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    if (deleteConfirmText.trim() !== workspace?.name.trim()) {
      setDeleteError("Confirmation text does not match workspace name.");
      return;
    }

    try {
      await deleteWs.mutateAsync(workspaceId);
      void navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete workspace.");
    }
  }

  const isGeneralDirty =
    Boolean(workspace) &&
    (name.trim() !== workspace?.name || slug.trim().toLowerCase() !== workspace?.slug);

  return (
    <AppShell title="Workspace settings" subtitle={workspace?.name ?? "Loading…"}>
      <div className="space-y-6 max-w-4xl pb-16">

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 1: GENERAL INFORMATION & IDENTIFICATION
        ───────────────────────────────────────────────────────────────── */}
        <SectionCard
          eyebrow="// Workspace"
          title="General information"
          padding="md"
          actions={
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                ID: {workspaceId ? `${workspaceId.slice(0, 8)}…` : "—"}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyId()}
                className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                title="Copy Workspace UUID"
              >
                {copiedId ? (
                  <>
                    <Check size={12} className="text-success" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy ID
                  </>
                )}
              </button>
            </div>
          }
        >
          {wsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <CircleNotch size={14} className="animate-spin" /> Loading workspace details…
            </div>
          ) : (
            <form onSubmit={(e) => void handleSaveGeneral(e)} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="ws-name" className="block text-xs font-semibold text-foreground">
                    Workspace Name
                  </label>
                  <input
                    id="ws-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setGeneralError(null);
                      setGeneralSuccess(null);
                    }}
                    placeholder="e.g. ThreatLens Core Security"
                    disabled={!canManageMembers || updateWs.isPending}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The human-readable title displayed across reports, navigation, and audit trails.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="ws-slug" className="block text-xs font-semibold text-foreground">
                      Workspace Slug
                    </label>
                    {canManageMembers && (
                      <button
                        type="button"
                        onClick={() => setSlug(slugify(name))}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Generate from name
                      </button>
                    )}
                  </div>
                  <input
                    id="ws-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase());
                      setGeneralError(null);
                      setGeneralSuccess(null);
                    }}
                    placeholder="e.g. threatlens-core"
                    disabled={!canManageMembers || updateWs.isPending}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Unique identifier used for permalinks and API routing. Only lowercase letters, numbers, and hyphens.
                  </p>
                </div>
              </div>

              {/* Read-only metadata summary badges */}
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 border-t border-border/60">
                <div className="rounded-lg border border-border/80 bg-card/60 p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Your Role</p>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      roleColor(currentUserRole ?? "viewer"),
                    )}
                  >
                    {currentUserRole ?? "—"}
                  </span>
                </div>
                <div className="rounded-lg border border-border/80 bg-card/60 p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Total Scans</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {workspace?.scan_count ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card/60 p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Active Members</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {members.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card/60 p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Created</p>
                  <p className="mt-1 text-[12px] font-medium text-foreground">
                    {workspace?.created_at
                      ? new Date(workspace.created_at).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              {generalError && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <Shield size={14} className="shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              {generalSuccess && (
                <div role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
                  <Check size={14} className="shrink-0" />
                  <span>{generalSuccess}</span>
                </div>
              )}

              {canManageMembers && (
                <div className="flex items-center justify-end pt-1">
                  <BrutalButton
                    type="submit"
                    variant="primary"
                    disabled={updateWs.isPending || !isGeneralDirty}
                  >
                    {updateWs.isPending ? (
                      <>
                        <CircleNotch size={14} className="animate-spin" /> Saving changes…
                      </>
                    ) : (
                      <>
                        <FloppyDisk size={14} /> Save changes
                      </>
                    )}
                  </BrutalButton>
                </div>
              )}
            </form>
          )}
        </SectionCard>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 2: DEFAULT SECURITY & COMPLIANCE BASELINE
        ───────────────────────────────────────────────────────────────── */}
        <SectionCard
          eyebrow="// Baseline"
          title="Security & compliance presets"
          padding="md"
          actions={
            <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
              <SlidersHorizontal size={12} /> {selectedFrameworks.length} Framework(s) Active
            </span>
          }
        >
          <form onSubmit={(e) => void handleSaveBaseline(e)} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-foreground">
                Default Target Frameworks
              </label>
              <p className="text-xs text-muted-foreground">
                Scans initiated in this workspace automatically evaluate findings against these selected compliance standards.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {AVAILABLE_FRAMEWORKS.map((fw) => {
                  const isSelected = selectedFrameworks.includes(fw);
                  return (
                    <button
                      key={fw}
                      type="button"
                      onClick={() => toggleFramework(fw)}
                      disabled={!canManageMembers || updateWs.isPending}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                        !canManageMembers && "cursor-default opacity-80",
                      )}
                    >
                      {isSelected ? (
                        <ShieldCheck size={14} className="text-primary" />
                      ) : (
                        <Shield size={14} className="opacity-40" />
                      )}
                      <span>{fw}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 pt-2 border-t border-border/60">
              <div className="space-y-1.5">
                <label htmlFor="retention-select" className="block text-xs font-semibold text-foreground">
                  Audit Log & Report Retention
                </label>
                <div className="relative">
                  <select
                    id="retention-select"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    disabled={!canManageMembers || updateWs.isPending}
                    className="w-full appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {RETENTION_OPTIONS.map((opt) => (
                      <option key={opt.days} value={opt.days}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <CaretDown
                    size={13}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Automated retention window for security scan artifacts and generated compliance proofs.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Security Notifications
                </label>
                <label className="flex items-start gap-2.5 rounded-lg border border-border bg-card/60 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnCritical}
                    onChange={(e) => setNotifyOnCritical(e.target.checked)}
                    disabled={!canManageMembers || updateWs.isPending}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">
                      Critical vulnerability triage alerts
                    </span>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      Trigger workspace alerts whenever CVSS ≥ 9.0 zero-day or high-risk architectural flaw is detected.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {baselineError && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <Shield size={14} className="shrink-0" />
                <span>{baselineError}</span>
              </div>
            )}

            {baselineSuccess && (
              <div role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
                <Check size={14} className="shrink-0" />
                <span>{baselineSuccess}</span>
              </div>
            )}

            {canManageMembers && (
              <div className="flex items-center justify-end pt-1">
                <BrutalButton
                  type="submit"
                  variant="primary"
                  disabled={updateWs.isPending}
                >
                  {updateWs.isPending ? (
                    <>
                      <CircleNotch size={14} className="animate-spin" /> Saving baseline…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} /> Save baseline preferences
                    </>
                  )}
                </BrutalButton>
              </div>
            )}
          </form>
        </SectionCard>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 3: TEAM MEMBERS LIST
        ───────────────────────────────────────────────────────────────── */}
        <SectionCard
          eyebrow="// Team"
          title="Members & roles"
          padding="none"
          actions={
            <span className="font-mono text-[11px] text-muted-foreground">
              {members.length} member(s)
            </span>
          }
        >
          {membersLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <CircleNotch size={14} className="animate-spin" /> Loading members…
            </div>
          ) : members.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No members found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const isSelf = member.user_id === user?.id;
                const canRemove = isOwner && !isSelf;
                const canChangeRole = isOwner && !isSelf;

                // Member display information fallback
                const displayName =
                  member.display_name ||
                  (isSelf && (user?.user_metadata?.full_name || user?.user_metadata?.name)) ||
                  (member.email ? member.email.split("@")[0] : null) ||
                  "Workspace Member";

                const emailDisplay =
                  member.email ||
                  (isSelf ? user?.email : null) ||
                  "No email on file";

                const initial = (displayName.charAt(0) || "U").toUpperCase();

                return (
                  <li
                    key={member.user_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {displayName}
                          </p>
                          {isSelf && (
                            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {emailDisplay}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/75 mt-0.5">
                          ID: {member.user_id.slice(0, 13)}… · Joined{" "}
                          {new Date(member.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      {canChangeRole ? (
                        <div className="relative">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              void roleChange.mutate({
                                userId: member.user_id,
                                role: e.target.value,
                              })
                            }
                            className="appearance-none rounded-lg border border-border bg-card py-1.5 pl-3 pr-7 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                            disabled={roleChange.isPending}
                          >
                            {ROLE_ORDER.map((r) => (
                              <option key={r} value={r}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                              </option>
                            ))}
                          </select>
                          <CaretDown
                            size={12}
                            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          />
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            roleColor(member.role as WorkspaceRole),
                          )}
                        >
                          {member.role}
                        </span>
                      )}

                      {canRemove && (
                        <div className="flex items-center">
                          {memberToRemove === member.user_id ? (
                            <div className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 rounded-lg px-2 py-1">
                              <span className="text-[11px] text-destructive font-medium">
                                Confirm remove?
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  void remove.mutate(member.user_id);
                                  setMemberToRemove(null);
                                }}
                                disabled={remove.isPending}
                                className="text-[11px] font-bold text-destructive underline hover:opacity-80"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setMemberToRemove(null)}
                                className="text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setMemberToRemove(member.user_id)}
                              disabled={remove.isPending}
                              title="Remove member"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            >
                              <Trash size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 4: PENDING INVITATIONS
        ───────────────────────────────────────────────────────────────── */}
        <SectionCard
          eyebrow="// Invites"
          title="Pending invitations"
          padding="none"
          actions={
            <span className="font-mono text-[11px] text-muted-foreground">
              {pendingInvites.length} pending
            </span>
          }
        >
          {invitesLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <CircleNotch size={14} className="animate-spin" /> Loading invitations…
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Envelope size={24} className="mx-auto mb-2 opacity-40" />
              <p className="font-medium text-foreground">No pending invitations</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                New teammates invited to this workspace will appear here until they accept.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pendingInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-muted/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Envelope size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {inv.invited_email}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Clock size={12} />
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        roleColor(inv.role as WorkspaceRole),
                      )}
                    >
                      {inv.role}
                    </span>

                    {canManageMembers && (
                      <button
                        type="button"
                        onClick={() => void revokeInvite.mutate(inv.id)}
                        disabled={revokeInvite.isPending}
                        title="Revoke invitation"
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50"
                      >
                        {revokeInvite.isPending ? (
                          <CircleNotch size={12} className="animate-spin" />
                        ) : (
                          <Trash size={12} />
                        )}
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 5: INVITE NEW MEMBER
        ───────────────────────────────────────────────────────────────── */}
        {canManageMembers && (
          <SectionCard eyebrow="// Add Member" title="Invite team member" padding="md">
            <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="invite-email" className="block text-xs font-semibold text-foreground">
                    Colleague's Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        setInviteError(null);
                        setInviteSuccess(null);
                      }}
                      placeholder="engineer@company.com"
                      className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <Envelope
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="invite-role" className="block text-xs font-semibold text-foreground">
                    Assigned Role
                  </label>
                  <div className="relative">
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                      className="w-full appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-7 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="analyst">Analyst</option>
                      <option value="viewer">Viewer</option>
                      {isOwner && <option value="admin">Admin</option>}
                    </select>
                    <CaretDown
                      size={12}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </div>
              </div>

              {inviteError && (
                <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                  <Shield size={14} className="shrink-0" /> {inviteError}
                </p>
              )}
              {inviteSuccess && (
                <p role="status" className="flex items-center gap-2 text-sm text-success">
                  <Check size={14} className="shrink-0" /> {inviteSuccess}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Invitations remain active for 7 days.
                </span>
                <BrutalButton
                  type="submit"
                  variant="primary"
                  disabled={invite.isPending || !inviteEmail}
                >
                  {invite.isPending ? (
                    <>
                      <CircleNotch size={14} className="animate-spin" /> Sending invite…
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} /> Send invite
                    </>
                  )}
                </BrutalButton>
              </div>
            </form>

            {/* Role Permissions Matrix */}
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2.5 text-xs font-semibold text-foreground">Role Permissions Overview</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { role: "owner" as const, desc: "Full root authority, billing, deletion, and all settings." },
                  { role: "admin" as const, desc: "Configure presets, invite members, and trigger scans." },
                  { role: "analyst" as const, desc: "Execute codebase/cloud scans, triage security findings." },
                  { role: "viewer" as const, desc: "Read-only access to dashboards, graphs, and audit reports." },
                ].map(({ role, desc }) => (
                  <div key={role} className="rounded-lg border border-border/80 bg-card/40 p-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        roleColor(role),
                      )}
                    >
                      {role.toUpperCase()}
                    </span>
                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 6: DANGER ZONE
        ───────────────────────────────────────────────────────────────── */}
        {isOwner && (
          <SectionCard eyebrow="// Danger Zone" title="Destructive workspace operations" padding="md">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-destructive">Delete Workspace</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Permanently wipe this workspace and all associated code scans, architecture models, findings, compliance audits, and member associations. This action is irreversible.
                </p>
              </div>

              <form onSubmit={(e) => void handleDeleteWorkspace(e)} className="space-y-3 pt-1">
                <label htmlFor="confirm-ws-name" className="block text-xs font-medium text-foreground">
                  To confirm, type <span className="font-mono font-bold text-destructive">{workspace?.name}</span> below:
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    id="confirm-ws-name"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => {
                      setDeleteConfirmText(e.target.value);
                      setDeleteError(null);
                    }}
                    placeholder={workspace?.name}
                    className="flex-1 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive"
                  />
                  <BrutalButton
                    type="submit"
                    variant="ghost"
                    disabled={
                      deleteWs.isPending ||
                      deleteConfirmText.trim() !== workspace?.name.trim()
                    }
                    className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    {deleteWs.isPending ? (
                      <>
                        <CircleNotch size={14} className="animate-spin" /> Deleting…
                      </>
                    ) : (
                      <>
                        <Trash size={14} /> Permanently delete
                      </>
                    )}
                  </BrutalButton>
                </div>

                {deleteError && (
                  <p role="alert" className="text-xs text-destructive flex items-center gap-1.5">
                    <Shield size={12} /> {deleteError}
                  </p>
                )}
              </form>
            </div>
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
}
