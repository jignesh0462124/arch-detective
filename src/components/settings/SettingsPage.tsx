import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useUnsavedSettings } from "@/hooks/useUnsavedSettings";
import { useQuery } from "@tanstack/react-query";
import {
  UserCircle,
  Users,
  GithubLogo,
  ShieldCheck,
  CreditCard,
  BookOpen,
  CaretRight,
  Check,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace, useWorkspaces } from "@/hooks/useWorkspace";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { authScope, isCurrentScope } from "@/lib/authState";
import { getWorkbenchCapabilities } from "@/lib/api/workbench";
import { settingsSections, validateDisplayName, type SettingsSection } from "@/lib/settings";
import { PrivacyContent, TermsContent } from "./LegalContent";

const Profile = lazy(() =>
  import("@/routes/_app/profile").then((m) => ({ default: m.ProfileContent })),
);
const Workspace = lazy(() =>
  import("@/components/workspace/WorkspaceSettingsPage").then((m) => ({
    default: m.WorkspaceSettingsPage,
  })),
);
const Repositories = lazy(() =>
  import("@/components/github/GitHubRepositories").then((m) => ({ default: m.GitHubRepositories })),
);
const control =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-secondary focus-visible:shadow-ring disabled:opacity-50";

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
function SectionLink({ section, children }: { section: SettingsSection; children: ReactNode }) {
  return (
    <Link to="/settings" search={{ section }} className={control}>
      {children}
      <CaretRight size={15} />
    </Link>
  );
}
function Appearance() {
  const { theme, setTheme } = useTheme();
  return (
    <Card title="Appearance" description="Choose a comfortable reading theme.">
      <div className="grid grid-cols-2 gap-4" role="group" aria-label="Colour theme">
        {(["light", "dark"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={theme === option}
            onClick={() => setTheme(option)}
            className={`relative rounded-lg border p-3 text-left focus-visible:shadow-ring ${theme === option ? "border-accent ring-1 ring-accent" : "border-border"}`}
          >
            <span
              aria-hidden="true"
              className={`flex h-24 overflow-hidden rounded border border-border ${option === "dark" ? "bg-[#17191b]" : "bg-[#f5f1ec]"}`}
            >
              <span
                className={`w-1/4 border-r ${option === "dark" ? "border-white/15 bg-[#222426]" : "border-black/10 bg-white"}`}
              />
              <span className="flex flex-1 flex-col gap-2 p-3">
                <span
                  className={`h-2 w-2/3 rounded ${option === "dark" ? "bg-white/25" : "bg-black/20"}`}
                />
                <span
                  className={`flex-1 rounded ${option === "dark" ? "bg-white/10" : "bg-white"}`}
                />
              </span>
            </span>
            <span className="mt-3 flex items-center justify-between text-sm font-medium capitalize">
              {option === "light" ? "Light" : "Dark"}
              {theme === option && <Check size={18} className="text-accent" />}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Saved on this browser and shared with its other Archon tabs. This preference also applies
        when you sign out.
      </p>
    </Card>
  );
}
function DisplayName() {
  const { user } = useAuth();
  const initial = user?.user_metadata?.full_name || user?.user_metadata?.display_name || "";
  const [name, setName] = useState(typeof initial === "string" ? initial : "");
  const [saved, setSaved] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const dirty = name.trim() !== saved.trim();
  useUnsavedSettings(dirty, "Leave without saving your account name?");
  return (
    <Card
      title="Display name"
      description="This name appears in your account menu. Your email address stays unchanged."
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current || !user) return;
          const invalid = validateDisplayName(name);
          if (invalid) {
            setError(invalid);
            return;
          }
          const scope = authScope();
          const next = name.trim();
          pending.current = true;
          setBusy(true);
          setError("");
          setSuccess(false);
          try {
            const { data, error: failure } = await supabase.auth.updateUser({
              data: { full_name: next, display_name: next },
            });
            if (
              failure ||
              data.user?.id !== user.id ||
              data.user.user_metadata?.display_name !== next
            )
              throw failure || new Error("Update not confirmed");
            if (alive.current && isCurrentScope(scope)) {
              setSaved(next);
              setName(next);
              setSuccess(true);
            }
          } catch {
            if (alive.current && isCurrentScope(scope))
              setError("Your name could not be saved. Check your connection and try again.");
          } finally {
            if (alive.current && isCurrentScope(scope)) setBusy(false);
            pending.current = false;
          }
        }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium">
          Display name
          <input
            value={name}
            maxLength={120}
            autoComplete="name"
            disabled={busy}
            onChange={(e) => {
              setName(e.target.value);
              setSuccess(false);
              setError("");
            }}
            className="mt-2 min-h-10 w-full rounded-md border border-border bg-card px-3 text-foreground"
            aria-invalid={!!error}
            aria-describedby={error ? "name-error" : undefined}
          />
        </label>
        <button type="submit" className={control} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save name"}
        </button>
        {error && (
          <p id="name-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-success">
            Display name saved.
          </p>
        )}
      </form>
    </Card>
  );
}
function Retention() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["settings-retention", user?.id],
    queryFn: ({ signal }) => getWorkbenchCapabilities(signal),
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });
  const hours = query.data?.retention_hours;
  return (
    <div className="rounded-md border border-border bg-secondary p-4 text-sm">
      <p className="font-medium">Source preview retention</p>
      {query.isPending ? (
        <p role="status">Checking retention…</p>
      ) : query.isError || !hours || !Number.isFinite(hours) || hours <= 0 ? (
        <p role="alert">
          Could not confirm retention.{" "}
          <button className="underline" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <p className="mt-1">{hours / 24} days after preparation.</p>
      )}
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Source previews expire separately from saved findings and reports. Preview availability can
        also end when the audit is deleted.
      </p>
    </div>
  );
}
function Privacy() {
  return (
    <div className="space-y-5">
      <Card title="Privacy & data" description="Understand what is stored, processed and retained.">
        <p className="text-sm text-muted-foreground">Draft documents · Research prototype</p>
        <Retention />
        <details className="rounded-md border border-border p-4">
          <summary className="cursor-pointer font-medium">
            Privacy policy — current data-handling notice
          </summary>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
            <PrivacyContent />
            <Link to="/privacy" className="underline">
              Open public notice
            </Link>
          </div>
        </details>
        <details className="rounded-md border border-border p-4">
          <summary className="cursor-pointer font-medium">
            Terms of use — current usage notes
          </summary>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
            <TermsContent />
            <Link to="/terms" className="underline">
              Open public usage notes
            </Link>
          </div>
        </details>
      </Card>
      <Card
        title="Managing saved data"
        description="Choose the action that matches the records you want to manage."
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Owners and admins can delete completed or failed scans in Codebase Audit → History. This
          removes the saved audit, associated findings, report entries and source previews. Private
          storage cleanup can finish asynchronously. Original uploads on your device, downloaded
          reports and GitHub branches or pull requests remain.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/workspace" className={control}>
            Open Codebase Audit
          </Link>
          <SectionLink section="workspace">Workspace controls</SectionLink>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Clearing browser site data removes local copies and preferences; it does not delete server
          records. Workspace deletion remains an owner-only action with confirmation.
        </p>
      </Card>
    </div>
  );
}
function Pricing() {
  return (
    <Card title="Plan & pricing" description="Proposed plans for individual and shared reviews.">
      <span className="inline-block rounded bg-secondary px-2 py-1 text-xs font-medium">
        Proposed
      </span>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            name: "Individual",
            purpose: "Personal security reviews",
            description: "A proposed option for reviewing your own projects and findings.",
          },
          {
            name: "Team",
            purpose: "Shared workspace reviews",
            description:
              "A proposed option for teams reviewing findings and tracking remediation together.",
          },
        ].map((plan) => (
          <div key={plan.name} className="rounded-lg border border-border p-5">
            <h3 className="font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm">{plan.purpose}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.description}</p>
            <p className="mt-5 font-medium">Pricing to be announced</p>
          </div>
        ))}
      </div>
      <p className="rounded-md bg-secondary p-4 text-sm leading-6">
        Billing is not enabled. Prices, limits and plan features are not final. These proposals do
        not change your current access.
      </p>
    </Card>
  );
}
function Help() {
  return (
    <div className="space-y-5">
      <Card title="Getting started" description="Follow a project from upload to review.">
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6">
          <li>Select or create a workspace. Owners and admins manage members and defaults.</li>
          <li>
            Open Codebase Audit, upload a ZIP or select an authorized GitHub repository, then start
            the audit.
          </li>
          <li>
            Use the workbench to inspect source locations, evidence and suggested remediation.
          </li>
          <li>
            Review Findings, explore Attack Graph associations and download a report from Reports.
          </li>
          <li>
            For supported findings, review a proposed fix in Fix verification, inspect checks and
            rescan when ready.
          </li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link to="/workspace" className={control}>
            Open Codebase Audit
          </Link>
          <Link to="/reports" className={control}>
            Open Reports
          </Link>
        </div>
      </Card>
      <Card title="Common questions">
        <dl className="space-y-4 text-sm leading-6">
          <div>
            <dt className="font-medium">Why can’t I change workspace settings?</dt>
            <dd className="text-muted-foreground">
              Your workspace role determines which actions are available. Ask an owner or admin to
              review your access.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Why is source unavailable?</dt>
            <dd className="text-muted-foreground">
              A preview may still be preparing, may have expired, or may not have been stored. Check
              the workbench message; saved findings and reports have separate history.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Why is GitHub unavailable?</dt>
            <dd className="text-muted-foreground">
              Repository access needs the configured GitHub App as well as your authorization. The
              Integrations section shows the current connection state.
            </dd>
          </div>
        </dl>
      </Card>
      <Card title="Help & about" description="Archon — Security Audits & Threat Modeling.">
        <p className="text-sm leading-6 text-muted-foreground">
          Archon helps review source evidence, security findings, suggested fixes and framework
          mappings. Automated results require human review and testing.
        </p>
        <p className="text-sm leading-6">
          A support contact is not configured for this deployment. Contact your workspace
          administrator. When describing a problem, exclude credentials, private source and
          sensitive findings.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/privacy" className={control}>
            Data handling
          </Link>
          <Link to="/terms" className={control}>
            Usage notes
          </Link>
        </div>
      </Card>
    </div>
  );
}
export function SettingsPage({ section }: { section: SettingsSection }) {
  const { user } = useAuth();
  const active = useActiveWorkspace();
  const workspaces = useWorkspaces();
  const navigate = useNavigate();
  const scopeKey = `${user?.id}/${active.active?.id ?? "none"}`;
  const workspaceContent = () =>
    workspaces.isError ? (
      <Card title="Workspace unavailable">
        <p role="alert" className="text-sm">
          Your workspaces could not be loaded.
        </p>
        <button className={control} onClick={() => void workspaces.refetch()}>
          Retry
        </button>
      </Card>
    ) : workspaces.isPending ? (
      <p role="status">Loading workspace…</p>
    ) : !active.active ? (
      <Card
        title="No workspace selected"
        description="Personal settings remain available. Create a workspace to manage audits and repository sharing."
      >
        <Link to="/workspace/new" className={control}>
          Create workspace
        </Link>
      </Card>
    ) : section === "integrations" ? (
      <Repositories workspaceId={active.active.id} role={active.active.role} />
    ) : (
      <Workspace workspaceId={active.active.id} embedded />
    );
  const cards = [
    {
      id: "account",
      title: "Account & security",
      text: "Profile details, password recovery and sessions.",
      icon: UserCircle,
    },
    {
      id: "workspace",
      title: "Workspace & members",
      text: "General settings, audit defaults and team access.",
      icon: Users,
    },
    {
      id: "integrations",
      title: "Connected services",
      text: "Manage personal GitHub access and shared repositories.",
      icon: GithubLogo,
    },
    {
      id: "privacy",
      title: "Privacy & data",
      text: "Draft privacy and usage notices, processing and retention.",
      icon: ShieldCheck,
    },
    {
      id: "pricing",
      title: "Plan & pricing",
      text: "Proposed Individual and Team plans. Billing is not enabled.",
      icon: CreditCard,
    },
    {
      id: "help",
      title: "Help & documentation",
      text: "Getting started, common questions and about Archon.",
      icon: BookOpen,
    },
  ] as const;
  return (
    <AppShell title="Settings" subtitle="Account & workspace">
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Make Archon work for you</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Manage your preferences, workspace, privacy and plan.
          </p>
        </header>
        <label className="block text-sm font-medium md:hidden">
          Settings section
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 text-foreground"
            value={section}
            onChange={(e) =>
              void navigate({
                to: "/settings",
                search: { section: e.target.value as SettingsSection },
              })
            }
          >
            {settingsSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <nav
          aria-label="Settings sections"
          className="hidden flex-wrap gap-1 border-b border-border md:flex"
        >
          {settingsSections.map((s) => (
            <Link
              key={s.id}
              to="/settings"
              search={{ section: s.id }}
              aria-current={section === s.id ? "page" : undefined}
              className={`min-h-11 border-b-2 px-3 py-3 text-sm focus-visible:shadow-ring ${section === s.id ? "border-accent font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <Suspense
          fallback={
            <p role="status" className="rounded-lg border border-border bg-card p-6">
              Loading settings…
            </p>
          }
        >
          <div key={`${scopeKey}/${section}`} className="min-w-0">
            {section === "overview" && (
              <div className="grid gap-5 lg:grid-cols-2">
                <Card
                  title="Account & security"
                  description={user?.email || "Your signed-in account"}
                >
                  <p className="text-sm leading-6 text-muted-foreground">
                    Manage your name, password recovery, connected sign-in methods and sessions.
                  </p>
                  <SectionLink section="account">Manage account</SectionLink>
                </Card>
                <Appearance />
                {cards
                  .filter((c) => c.id !== "account")
                  .map((card) => (
                    <Card key={card.id} title={card.title} description={card.text}>
                      <card.icon size={22} className="text-accent" />
                      <SectionLink section={card.id}>Open {card.title.toLowerCase()}</SectionLink>
                    </Card>
                  ))}
              </div>
            )}
            {section === "appearance" && <Appearance />}
            {section === "account" && (
              <div className="space-y-5">
                <Profile embedded accountForm={<DisplayName />} />
              </div>
            )}
            {(section === "workspace" || section === "integrations") && workspaceContent()}
            {section === "privacy" && <Privacy />}
            {section === "pricing" && <Pricing />}
            {section === "help" && <Help />}
          </div>
        </Suspense>
      </div>
    </AppShell>
  );
}
