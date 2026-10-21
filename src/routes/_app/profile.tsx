import { authErrorMessage, hasUnownedHistory } from "@/lib/authState";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  User,
  EnvelopeSimple,
  ShieldCheck,
  SignOut,
  PencilSimple,
  CalendarBlank,
  Key,
  Bell,
  DeviceMobile,
  Globe,
  CheckCircle,
  IdentificationCard,
  Sparkle,
  ClockCounterClockwise,
  Warning,
  ImagesSquare,
  X,
  ArrowRight,
  PaperPlaneTilt,
  Pulse,
  Bug,
  FileText,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/brutal/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { useAuditEvents } from "@/hooks/useAuditEvents";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Profile · Archon" },
      { name: "description", content: "Manage your Archon profile, security settings, and preferences." },
    ],
  }),
  component: ProfilePage,
});

// ── Wallpaper catalogue ───────────────────────────────────────────────────────
const COVERS = [
  { id: 1, src: "/covers/cover-1.jpg", label: "Grid",    desc: "Isometric mesh" },
  { id: 2, src: "/covers/cover-2.jpg", label: "Terrain", desc: "Topographic contours" },
  { id: 3, src: "/covers/cover-3.jpg", label: "Bauhaus", desc: "Brutalist geometry" },
  { id: 4, src: "/covers/cover-4.jpg", label: "Noir",    desc: "Film grain minimal" },
  { id: 5, src: "/covers/cover-5.jpg", label: "Circuit", desc: "PCB traces" },
] as const;

const COVER_STORAGE_KEY = "archon-profile-cover";

// ── Utilities ─────────────────────────────────────────────────────────────────
function getInitials(name: string | null | undefined, email: string | null | undefined) {
  if (name && name.trim()) {
    const p = name.trim().split(" ");
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-0.5 text-[14px] font-semibold">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono = false }: { icon: React.ElementType; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon size={13} weight="regular" className="shrink-0 text-muted-foreground" />
        <span className="text-[12px] text-muted-foreground whitespace-nowrap">{label}</span>
      </div>
      <span className={cn("truncate text-[13px] font-medium text-right", mono && "font-mono text-[11px]")}>{value}</span>
    </div>
  );
}

type BadgeStatus = "active" | "inactive" | "pending";

function SecurityRow({ icon: Icon, label, description, status }: { icon: React.ElementType; label: string; description: string; status: BadgeStatus }) {
  const configs = {
    active:   { dot: "bg-success animate-pulse-dot", text: "text-success",          label: "Active"   },
    inactive: { dot: "bg-border",                    text: "text-muted-foreground", label: "Inactive" },
    pending:  { dot: "bg-secondary-foreground/40",   text: "text-muted-foreground", label: "Pending"  },
  };
  const c = configs[status];
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary text-accent">
        <Icon size={14} weight="duotone" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{description}</p>
      </div>
      <div className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium shrink-0", c.text)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
        {c.label}
      </div>
    </div>
  );
}

function IntegrationCard({ icon: Icon, name, description, status }: { icon: React.ElementType; name: string; description: string; status: BadgeStatus }) {
  const configs = {
    active:   { pill: "bg-success/10 text-success border-success/20",              dot: "bg-success animate-pulse-dot", label: "Connected"    },
    inactive: { pill: "bg-border/50 text-muted-foreground border-border",          dot: "bg-muted-foreground",          label: "Disconnected" },
    pending:  { pill: "bg-secondary text-muted-foreground border-border",          dot: "bg-muted-foreground",          label: "Pending"      },
  };
  const c = configs[status];
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-border bg-background p-4 transition-colors hover:border-border/80 hover:bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-secondary text-accent shrink-0">
          <Icon size={17} weight="duotone" />
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium", c.pill)}>
          <span className={cn("h-1 w-1 rounded-full", c.dot)} />
          {c.label}
        </span>
      </div>
      <div>
        <p className="text-[13px] font-semibold">{name}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ActivityItem({ icon: Icon, text, time, accent }: { icon: React.ElementType; text: string; time: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary", accent)}>
        <Icon size={13} weight="duotone" />
      </div>
      <p className="min-w-0 flex-1 text-[13px]">{text}</p>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  );
}

function MiniStat({ code, label, value }: { code: string; label: string; value: string }) {
  return (
    <div className="flex flex-col px-5 py-3">
      <p className="font-mono text-[9px] text-muted-foreground">{code}</p>
      <p className="mt-1 text-sm font-bold tabular-nums sm:text-base">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Cover picker ──────────────────────────────────────────────────────────────
function CoverPicker({ current, onSelect, onClose }: { current: number; onSelect: (id: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-sm border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ImagesSquare size={15} weight="duotone" className="text-accent" />
            <div>
              <p className="text-[13px] font-semibold">Choose cover wallpaper</p>
              <p className="text-[11px] text-muted-foreground">Select from {COVERS.length} curated wallpapers</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <X size={14} weight="bold" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-3 p-5">
          {COVERS.map((c) => (
            <button key={c.id} type="button" onClick={() => { onSelect(c.id); onClose(); }}
              className={cn("group relative overflow-hidden rounded-sm border-2 transition-all focus-visible:outline-none",
                current === c.id ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/60"
              )}
            >
              <img src={c.src} alt={c.label} className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-4">
                <p className="text-[11px] font-bold text-white">{c.label}</p>
                <p className="text-[9px] text-white/55">{c.desc}</p>
              </div>
              {current === c.id && (
                <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent shadow-sm">
                  <CheckCircle size={11} weight="fill" className="text-white" />
                </div>
              )}
              <div className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded bg-black/65 font-mono text-[9px] font-bold text-white/70">
                {c.id}
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          Preference is stored in your browser. Applies immediately.
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user, signOut, resetPassword } = useAuth();
  const { active: workspace } = useActiveWorkspace();
  const { data: auditData } = useAuditEvents(workspace?.id, { limit: 4 });
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resetUntil, setResetUntil] = useState(0);
  const [resetSeconds, setResetSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setResetSeconds(Math.max(0, Math.ceil((resetUntil - Date.now()) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [resetUntil]);
  const [resetError, setResetError] = useState("");

  const savedCover = typeof window !== "undefined"
    ? Number(window.localStorage.getItem(COVER_STORAGE_KEY) ?? "1") || 1 : 1;
  const [coverId, setCoverId] = useState(savedCover);

  const handleSelectCover = (id: number) => {
    setCoverId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(COVER_STORAGE_KEY, String(id));
  };

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.display_name as string | undefined) || null;
  const email = user?.email ?? null;
  const createdAt = user?.created_at ?? null;
  const lastSignIn = user?.last_sign_in_at ?? null;
  const initials = getInitials(displayName, email);
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const activeCover = COVERS.find((c) => c.id === coverId) ?? COVERS[0];

  const handleSignOut = async (scope: "local" | "global" = "local") => {
    if (isSigningOut) return;
    if (scope === "global" && !window.confirm("Sign out on all devices, including this browser? Existing access tokens may remain valid until they expire.")) return;
    setIsSigningOut(true); setSignOutError("");
    try { await signOut(scope); await navigate({ to: "/login", replace: true }); }
    catch { setSignOutError("Couldn’t confirm sign out. Please retry."); }
    finally { setIsSigningOut(false); }
  };

  const handleResetPassword = async () => {
    const emailToReset = email;
    if (!emailToReset || resetState === "sending" || resetUntil > Date.now()) return;
    setResetState("sending");
    setResetError("");
    try {
      await resetPassword(emailToReset);
      setResetUntil(Date.now() + 60_000);
      setResetState("sent");
    } catch (err) {
      setResetError(authErrorMessage(err));
      setResetState("error");
    }
  };

  return (
    <AppShell subtitle="Account" title="Your profile">
      <div className="space-y-5">

        {/* ━━━ HERO CARD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="overflow-hidden rounded-sm border border-border bg-card">

          {/* Cover */}
          <div className="group relative h-32 w-full overflow-hidden sm:h-44">
            <img src={activeCover.src} alt={activeCover.label}
              className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15" />

            {/* Top-right auth badge */}
            <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded border border-white/15 bg-black/65 px-2.5 py-1 backdrop-blur-md">
              <ShieldCheck size={10} className="text-accent" />
              <span className="font-mono text-[10px] text-white/80">AUTHENTICATED</span>
            </div>

            {/* Bottom-right: change cover (hover only) */}
            <button type="button" onClick={() => setPickerOpen(true)}
              className="absolute bottom-3 right-4 flex items-center gap-1.5 rounded border border-white/20 bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white/80 opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:border-white/40 hover:text-white focus-visible:opacity-100 focus-visible:outline-none"
            >
              <ImagesSquare size={12} weight="duotone" />
              Change cover
            </button>

            {/* Bottom-left: cover name */}
            <div className="absolute bottom-3 left-5 font-mono text-[9px] text-white/35">
              {String(coverId).padStart(2, "0")} / {activeCover.label}
            </div>
          </div>

          {/* Avatar + identity row */}
          <div className="relative px-5 pb-0">
            {/* Avatar — overlaps cover */}
            <div className="absolute -top-9 left-5 sm:-top-11">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-16 w-16 rounded-sm border-[3px] border-card object-cover sm:h-20 sm:w-20" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-sm border-[3px] border-card bg-accent text-lg font-bold text-white sm:h-20 sm:w-20 sm:text-xl">
                    {initials}
                  </div>
                )}
                <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-card bg-success" />
              </div>
            </div>

            {/* Name row */}
            <div className="flex items-start justify-between gap-3 pb-4 pt-3 ml-[76px] sm:ml-[92px]">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold sm:text-lg">{displayName ?? email ?? "Anonymous"}</h2>
                {email && <p className="truncate text-[13px] text-muted-foreground">{email}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium">
                    <IdentificationCard size={10} weight="duotone" /> Member
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <CheckCircle size={10} weight="fill" /> Verified
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setPickerOpen(true)}
                className="hidden shrink-0 items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-secondary sm:inline-flex"
              >
                <PencilSimple size={12} /> Edit cover
              </button>
            </div>
          </div>

          {/* Stats strip — 3 equal columns */}
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
            <MiniStat code="01 // SINCE" label="Member since"  value={formatDate(createdAt)} />
            <MiniStat code="02 // LAST"  label="Last sign-in"  value={lastSignIn ? formatDate(lastSignIn) : "Now"} />
            <MiniStat code="03 // ROLE"  label="Account type"  value="Full" />
          </div>
        </div>

        {/* ━━━ ROW 1 — IDENTITY (left) + SECURITY (right) ━━━━━━━━━━━━━━━━━━ */}
        {/*
          Rationale: Identity (who you are) pairs naturally with Security (how
          you are protected). Both are read-heavy info cards, similar density.
          Identity is narrower (5 cols) since it's a simple key→value list.
          Security is wider (7 cols) to give breathing room to each row.
        */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Identity — 5 cols */}
          <section className="rounded-sm border border-border bg-card p-5 lg:col-span-5">
            <SectionHeader eyebrow="// 01" title="Identity" />
            <div className="space-y-0">
              <InfoRow icon={User}             label="Display name"  value={displayName ?? "—"} />
              <InfoRow icon={EnvelopeSimple}   label="Email"         value={email ?? "—"} />
              <InfoRow icon={IdentificationCard} label="User ID"     value={user?.id ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : "—"} mono />
              <InfoRow icon={CalendarBlank}    label="Joined"        value={formatDate(createdAt)} />
              <InfoRow icon={CalendarBlank}    label="Last active"   value={lastSignIn ? formatDate(lastSignIn) : "—"} />
            </div>
          </section>

          {/* Security — 7 cols */}
          <section className="rounded-sm border border-border bg-card p-5 lg:col-span-7">
            <SectionHeader
              eyebrow="// 02"
              title="Security"
              action={
                <span className="font-mono text-[10px] text-muted-foreground">
                  2 of 4 active
                </span>
              }
            />
            <div>
              <SecurityRow icon={ShieldCheck}         label="Supabase auth"   description="Email & password — your primary authentication method" status="active" />
              <SecurityRow icon={DeviceMobile}        label="Two-factor auth" description="TOTP authenticator app or SMS one-time password"       status="inactive" />
              <SecurityRow icon={Key}                 label="Active session"  description="Authenticated browser session via Supabase JWT"        status="active" />
              <SecurityRow icon={Bell}                label="Login alerts"    description="Email notification on each new successful sign-in"     status="inactive" />
            </div>
          </section>
        </div>

        {/* ━━━ ROW 2 — RECENT ACTIVITY (left) + DANGER ZONE (right) ━━━━━━━━ */}
        {/*
          Activity and Danger Zone are both "action-oriented" sections.
          Activity logs what happened; Danger Zone drives critical actions.
          Activity gets more space (7 cols) since it will grow with entries.
          Danger Zone is intentionally compact (5 cols) — minimal and severe.
        */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Recent Activity — 7 cols */}
          <section className="rounded-sm border border-border bg-card p-5 lg:col-span-7">
            <SectionHeader
              eyebrow="// 03"
              title="Recent activity"
              action={
                auditData?.items && auditData.items.length > 0 ? (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {auditData.total} events recorded
                  </span>
                ) : undefined
              }
            />
            <div>
              {auditData?.items && auditData.items.length > 0 ? (
                auditData.items.slice(0, 4).map((ev) => {
                  let Icon = ClockCounterClockwise;
                  let accent = "text-muted-foreground";
                  let text = ev.event_type;

                  if (ev.event_type.startsWith("scan.")) {
                    Icon = Pulse;
                    accent = "text-accent";
                    const target = (ev.event_metadata?.target as string) || "Codebase scan";
                    text =
                      ev.event_type === "scan.completed"
                        ? `Completed scan: "${target}"`
                        : `Initiated scan: "${target}"`;
                  } else if (ev.event_type.startsWith("finding.")) {
                    Icon = Bug;
                    accent = "text-destructive";
                    text = `Finding state triaged: ${String(ev.event_metadata?.to ?? "updated")}`;
                  } else if (ev.event_type.startsWith("workspace.")) {
                    Icon = Globe;
                    accent = "text-success";
                    text = `Workspace event: ${ev.event_type.replace("workspace.", "")}`;
                  } else if (ev.event_type.startsWith("report.")) {
                    Icon = FileText;
                    accent = "text-primary";
                    text = "Compliance audit report generated";
                  }

                  const timeStr = formatDate(ev.created_at);

                  return (
                    <ActivityItem
                      key={ev.id}
                      icon={Icon}
                      text={text}
                      time={timeStr}
                      accent={accent}
                    />
                  );
                })
              ) : (
                <>
                  <ActivityItem icon={ShieldCheck} text="Profile page accessed" time="Just now" accent="text-success" />
                  <ActivityItem icon={Key} text="Session authenticated via Supabase JWT" time={formatDate(lastSignIn)} accent="text-accent" />
                  <ActivityItem icon={Globe} text="Workspace data loaded" time="This session" accent="text-muted-foreground" />
                  <ActivityItem icon={ClockCounterClockwise} text="Audit log active" time="This session" accent="text-muted-foreground" />
                </>
              )}
            </div>

            {/* View full log CTA */}
            <Link
              to="/audit-log"
              id="profile-view-audit-log-btn"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded border border-border bg-secondary/50 py-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary hover:text-accent hover:border-accent/40 focus-visible:outline-none"
            >
              View full audit log <ArrowRight size={13} weight="bold" />
            </Link>
          </section>

          {/* Danger Zone — 5 cols */}
          <section className="flex flex-col gap-4 lg:col-span-5">
            {/* Reset password card */}
            <div className="rounded-sm border border-border bg-card p-5">
              <SectionHeader eyebrow="// 04" title="Password" />

              {/* Sent success state */}
              {resetState === "sent" ? (
                <div className="flex flex-col items-center gap-3 py-3 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
                    <CheckCircle size={22} weight="fill" className="text-success" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">Check your email</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      If this address is eligible, reset instructions will arrive at{" "}
                      <span className="font-medium text-foreground">{email}</span>.
                      Check your inbox and spam folder.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={resetSeconds > 0}
                    onClick={() => setResetState("idle")}
                    className="text-[12px] font-medium text-accent hover:underline"
                  >
                    {resetSeconds ? `Resend in ${resetSeconds}s` : "Send again"}
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
                    A secure reset link will be sent to{" "}
                    <span className="font-medium text-foreground">{email ?? "your registered email"}</span>.
                    Click the link in the email to set a new password.
                  </p>

                  {/* Error banner */}
                  {resetState === "error" && resetError && (
                    <div className="mb-3 flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
                      <Warning size={12} className="mt-0.5 shrink-0 text-destructive" />
                      <p className="text-[12px] text-foreground">{resetError}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    id="profile-reset-password-btn"
                    disabled={resetState === "sending"}
                    onClick={() => void handleResetPassword()}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-border bg-secondary px-4 text-[13px] font-medium transition-colors hover:bg-secondary/70 focus-visible:outline-none disabled:opacity-50"
                  >
                    {resetState === "sending" ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                        Sending link…
                      </>
                    ) : (
                      <>
                        <PaperPlaneTilt size={13} weight="bold" />
                        Send reset link
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {hasUnownedHistory() && <p className="rounded border border-border p-3 text-xs text-muted-foreground">Older browser history has no verified account owner. It is preserved on this device but hidden from account views.</p>}
            {/* Sessions */}
            <div className="flex-1 rounded-sm border border-destructive/30 bg-destructive/5 p-5">
              <SectionHeader eyebrow="// 05" title="Your sessions" />
              <div className="mb-4 flex items-start gap-2.5 rounded border border-destructive/20 bg-card px-3 py-3">
                <Warning size={13} className="mt-0.5 shrink-0 text-destructive" weight="fill" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Normal sign out affects this browser and its open tabs. Other devices stay signed in. Saved audits remain available when you return.
                </p>
              </div>
              <button
                type="button"
                id="profile-signout-btn"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-destructive/35 bg-destructive/10 px-4 text-[13px] font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none disabled:opacity-50"
              >
                <SignOut size={13} weight="bold" />
                {isSigningOut ? "Signing out…" : "Sign out of this browser"}
              </button>
              <button type="button" disabled={isSigningOut} onClick={() => void handleSignOut("global")} className="mt-3 min-h-10 w-full rounded border border-border px-3 text-xs font-medium disabled:opacity-50">Sign out on all devices…</button>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Existing access tokens can remain valid until expiry.</p>
              {signOutError && <p role="alert" className="mt-3 text-xs text-destructive">{signOutError}</p>}
            </div>
          </section>
        </div>

        {/* ━━━ ROW 3 — AI & INTEGRATIONS (full width) ━━━━━━━━━━━━━━━━━━━━━━ */}
        {/*
          Integrations gets its own full-width row at the bottom.
          It's treated as a feature showcase — horizontal card grid.
          This is the pattern used by Vercel, Linear, and Notion integrations pages.
        */}
        <section className="rounded-sm border border-border bg-card p-5">
          <SectionHeader
            eyebrow="// 06"
            title="AI & Integrations"
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                Configured services
              </span>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <IntegrationCard
              icon={Sparkle}
              name="Groq LLM"
              description="Powers AI scan analysis, threat explanations, and the Ask AI assistant."
              status="active"
            />
            <IntegrationCard
              icon={Globe}
              name="Supabase"
              description="Manages authentication, database records, and cloud storage for this workspace."
              status="active"
            />
            <IntegrationCard
              icon={ClockCounterClockwise}
              name="Audit logging"
              description="Every action is recorded for compliance reporting and security review."
              status="active"
            />
          </div>
        </section>

      </div>

      {/* Cover picker modal */}
      {pickerOpen && (
        <CoverPicker
          current={coverId}
          onSelect={handleSelectCover}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </AppShell>
  );
}
