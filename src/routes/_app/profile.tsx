import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  User,
  EnvelopeSimple,
  ShieldCheck,
  SignOut,
  ImagesSquare,
  X,
  CheckCircle,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { GitHubAccounts } from "@/components/github/GitHubRepositories";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { fetchAuditEvents } from "@/lib/api/auditEvents";
import { authErrorMessage, hasUnownedHistory } from "@/lib/authState";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile · Archon" }] }),
  component: ProfilePage,
});

function date(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
const covers = ["Grid", "Terrain", "Bauhaus", "Noir", "Circuit"];
const coverKey = "archon-profile-cover";
function ProfilePage() {
  const { user, signOut, resetPassword } = useAuth();
  const { active: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const canReadActivity = workspace?.role === "owner" || workspace?.role === "admin";
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
  const [imageFailed, setImageFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [picker, setPicker] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (picker) dialog.current?.showModal();
    else dialog.current?.close();
  }, [picker]);
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
  const rawName = user?.user_metadata?.full_name || user?.user_metadata?.display_name;
  const name = typeof rawName === "string" && rawName.trim() ? rawName : "Your account";
  const avatar =
    typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;
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
    <AppShell title="Your profile" subtitle="Account">
      <div className="mx-auto max-w-5xl space-y-5">
        <GitHubAccounts />
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative h-28 bg-secondary sm:h-36">
            {!imageFailed && (
              <img
                src={`/covers/cover-${cover}.jpg`}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            )}
            <div className="absolute inset-0 bg-black/40" />
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-2 rounded border border-white/50 bg-black/80 px-3 text-xs font-medium text-white"
            >
              <ImagesSquare size={16} /> Change cover
            </button>
          </div>
          <div className="flex items-center gap-4 p-5">
            {avatar && !avatarFailed ? (
              <img
                src={avatar}
                alt=""
                onError={() => setAvatarFailed(true)}
                className="size-14 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-accent">
                <User size={28} />
              </div>
            )}
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
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-5">
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
          <section className="rounded-lg border border-border bg-card p-5">
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
          <section className="rounded-lg border border-border bg-card p-5">
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
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Your sessions</h2>
            <p className="my-3 text-sm leading-6 text-muted-foreground">
              Sign out of this browser and its open tabs. Your saved audits remain available when
              you return.
            </p>
            <div className="flex flex-wrap gap-2">
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
      <dialog
        ref={dialog}
        onClose={() => setPicker(false)}
        className="m-auto w-[min(94vw,580px)] rounded-lg border border-border bg-card p-5 text-foreground backdrop:bg-black/60"
        aria-labelledby="cover-title"
      >
        <div className="flex items-center justify-between">
          <h2 id="cover-title" className="font-semibold">
            Choose your profile cover
          </h2>
          <button
            type="button"
            aria-label="Close cover picker"
            onClick={() => setPicker(false)}
            className="rounded p-2"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {covers.map((label, index) => (
            <button
              type="button"
              key={label}
              aria-pressed={cover === index + 1}
              onClick={() => {
                setCover(index + 1);
                setImageFailed(false);
                try {
                  localStorage.setItem(coverKey, String(index + 1));
                } catch {
                  /* Appearance still updates. */
                }
                setPicker(false);
              }}
              className="overflow-hidden rounded border border-border bg-secondary text-left"
            >
              <img
                src={`/covers/cover-${index + 1}.jpg`}
                alt=""
                loading="lazy"
                className="h-20 w-full object-cover"
              />
              <span className="block p-2 text-sm">
                {label}
                {cover === index + 1 ? " · Selected" : ""}
              </span>
            </button>
          ))}
        </div>
      </dialog>
    </AppShell>
  );
}
