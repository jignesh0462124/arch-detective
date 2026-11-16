import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  EnvelopeSimple,
  ShieldCheck,
  SignOut,
  ImagesSquare,
  CheckCircle,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { SettingsFrame } from "@/components/ui/SettingsFrame";
import { GitHubAccounts } from "@/components/github/GitHubRepositories";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { fetchAuditEvents } from "@/lib/api/auditEvents";
import { authErrorMessage, hasUnownedHistory } from "@/lib/authState";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileArtworkPicker } from "@/components/profile/ProfileArtworkPicker";
import { profileCover, type AppearanceKind } from "@/lib/profileAppearance";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile · Archon" }] }),
  component: ProfilePage,
});

function date(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
const coverKey = "archon-profile-cover";
function ProfilePage() {
  return <ProfileContent />;
}
// Shared with the Settings account section.
export function ProfileContent({
  embedded = false,
  accountForm,
}: {
  embedded?: boolean;
  accountForm?: ReactNode;
}) {
  const Shell = embedded ? SettingsFrame : AppShell;
  const { user, signOut, resetPassword } = useAuth();
  const { active: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const canReadActivity = !embedded && (workspace?.role === "owner" || workspace?.role === "admin");
  const activity = useQuery({
    queryKey: ["profile-activity", user?.id, workspace?.id],
    queryFn: ({ signal }) => fetchAuditEvents({ workspace_id: workspace!.id, limit: 4, signal }),
    enabled: Boolean(user && workspace && canReadActivity),
    staleTime: 30_000,
    retry: false,
  });
  const [cover, setCover] = useState(1);
  useEffect(() => {
    try {
      const value = Number(localStorage.getItem(coverKey));
      if (value >= 1 && value <= 5) setCover(value);
    } catch {
      // Keep the default cover if appearance storage is unavailable.
    }
  }, []);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const [picker, setPicker] = useState<AppearanceKind | null>(null);
  const [appearanceNotice, setAppearanceNotice] = useState("");
  const coverSrc = profileCover(user?.user_metadata, cover);
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resetError, setResetError] = useState("");
  const [resetUntil, setResetUntil] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((resetUntil - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resetUntil]);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  useEffect(() => {
    setResetState("idle");
    setResetError("");
    setResetUntil(0);
    setSignOutError("");
    setSigningOut(false);
    setPicker(null);
    setAppearanceNotice("");
  }, [user?.id]);
  const rawName = user?.user_metadata?.full_name || user?.user_metadata?.display_name;
  const name = typeof rawName === "string" && rawName.trim() ? rawName : "Your account";
  const confirmed = Boolean(user?.email_confirmed_at);
  const sendReset = async () => {
    if (!user?.email || resetState === "sending" || resetUntil > Date.now()) return;
    setResetState("sending");
    setResetError("");
    try {
      await resetPassword(user.email);
      setResetUntil(Date.now() + 60_000);
      setResetState("sent");
    } catch (error) {
      setResetState("error");
      setResetError(authErrorMessage(error));
    }
  };
  const logout = async (scope: "local" | "global") => {
    if (signingOut) return;
    if (
      scope === "global" &&
      !window.confirm(
        "Sign out on all devices? Existing access tokens can remain valid until expiry.",
      )
    )
      return;
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut(scope);
      await navigate({ to: "/login", replace: true });
    } catch {
      setSignOutError("Sign out could not be confirmed. Please retry.");
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <Shell title="Your profile" subtitle="Account">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          {!embedded && (
            <div className="relative h-28 bg-secondary sm:h-36">
              {failedCover !== coverSrc && (
                <img
                  src={coverSrc}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setFailedCover(coverSrc)}
                  decoding="async"
                />
              )}
              <button
                type="button"
                onClick={() => setPicker("cover")}
                className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-2 rounded border border-white/50 bg-black/80 px-3 text-xs font-medium text-white"
              >
                <ImagesSquare size={16} /> Change cover
              </button>
            </div>
          )}
          <div className="flex items-center gap-4 p-5">
            <button
              type="button"
              onClick={() => setPicker("avatar")}
              aria-label="Change profile image"
              className="group flex shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 focus-visible:shadow-ring"
            >
              <ProfileAvatar
                metadata={user?.user_metadata}
                email={user?.email}
                className="size-16 rounded-xl border border-border text-lg group-hover:border-muted-foreground"
              />
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                Change image
              </span>
            </button>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold">{name}</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {user?.email || "Email unavailable"}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck size={15} />{" "}
                {confirmed ? "Email confirmed" : "Email confirmation not recorded"}
              </p>
            </div>
          </div>
        </section>
        {appearanceNotice && (
          <p role="status" className="text-sm text-muted-foreground">
            {appearanceNotice}
          </p>
        )}
        {accountForm}
        <div className={embedded ? "grid min-w-0 gap-5" : "grid min-w-0 gap-5 md:grid-cols-2"}>
          <section className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Account details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Email address</dt>
                <dd className="break-all">{user?.email || "Not available"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Member since</dt>
                <dd>{date(user?.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd>{date(user?.last_sign_in_at)}</dd>
              </div>
            </dl>
          </section>
          {!embedded && (
            <section className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6">
              <h2 className="text-base font-semibold">Workspace access</h2>
              {workspace ? (
                <>
                  <p className="mt-3 break-words font-medium">{workspace.name}</p>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    Your role: {workspace.role}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your role determines which workspace actions and records you can access.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No active workspace selected. Choose a workspace from navigation.
                </p>
              )}
            </section>
          )}
          <section className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Password recovery</h2>
            <p className="my-3 text-sm leading-6 text-muted-foreground">
              Send a reset link to your account email, then follow the link to choose a new
              password.
            </p>
            {resetState === "sent" && (
              <p role="status" className="mb-3 text-sm">
                <CheckCircle className="mr-1 inline text-success" size={16} /> If your address is
                eligible, reset instructions will arrive. Check your inbox and spam folder.
              </p>
            )}
            {resetError && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {resetError}
              </p>
            )}
            <BrutalButton
              variant="secondary"
              size="sm"
              onClick={() => void sendReset()}
              disabled={!user?.email || resetState === "sending" || seconds > 0}
            >
              <EnvelopeSimple size={16} />{" "}
              {resetState === "sending"
                ? "Sending link…"
                : seconds
                  ? `Resend in ${seconds}s`
                  : resetState === "sent"
                    ? "Send again"
                    : "Send reset link"}
            </BrutalButton>
          </section>
          <section className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Your sessions</h2>
            <p className="my-3 text-sm leading-6 text-muted-foreground">
              Sign out of this browser and its open tabs. Your saved audits remain available when
              you return.
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
              <BrutalButton size="sm" onClick={() => void logout("local")} disabled={signingOut}>
                <SignOut size={16} />
                {signingOut ? "Signing out…" : "Sign out of this browser"}
              </BrutalButton>
              <BrutalButton
                variant="secondary"
                size="sm"
                onClick={() => void logout("global")}
                disabled={signingOut}
              >
                Sign out on all devices…
              </BrutalButton>
            </div>
            {signOutError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {signOutError}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Other devices stay signed in after normal sign out. Existing access tokens can remain
              valid until expiry.
            </p>
          </section>
        </div>
        <GitHubAccounts />
        {canReadActivity && (
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Recent workspace activity</h2>
              <Link to="/audit-log" className="text-sm font-medium underline underline-offset-4">
                Open audit log
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Recorded events in the active workspace, including actions by other members.
            </p>
            {activity.isPending ? (
              <p role="status" className="mt-4 text-sm">
                Loading activity…
              </p>
            ) : activity.isError ? (
              <div role="alert" className="mt-4 text-sm">
                Workspace activity could not be loaded.{" "}
                <button type="button" className="underline" onClick={() => void activity.refetch()}>
                  Retry
                </button>
              </div>
            ) : activity.data?.items.length ? (
              <ul className="mt-3 divide-y divide-border">
                {activity.data.items.map((event) => (
                  <li key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span className="break-words">
                      {event.event_type.replaceAll(".", " · ").replaceAll("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">{date(event.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No activity has been recorded for this workspace yet.
              </p>
            )}
          </section>
        )}
        {hasUnownedHistory() && (
          <p className="text-xs text-muted-foreground">
            Older browser history without a verified account owner is preserved on this device and
            hidden from account views.
          </p>
        )}
      </div>
      {picker && user && (
        <ProfileArtworkPicker
          key={`${user.id}:${picker}`}
          kind={picker}
          legacyCover={cover}
          onClose={() => setPicker(null)}
          onSaved={() => {
            setAppearanceNotice(
              picker === "avatar" ? "Profile image saved." : "Profile cover saved.",
            );
            setPicker(null);
          }}
        />
      )}
    </Shell>
  );
}
