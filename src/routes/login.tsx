import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, GithubLogo, EnvelopeSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";
import { useAuth } from "@/hooks/useAuth";
import { resendConfirmation, signInWithGitHub } from "@/lib/api/auth";
import { authErrorMessage, safeAuthDestination } from "@/lib/authState";
import { authCallbackFailed } from "@/lib/supabase";
import "@/components/auth/auth-page.css";

type Mode = "signin" | "signup" | "forgot";
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { mode?: Mode; next?: string } => ({
    mode: search.mode === "signup" || search.mode === "forgot" ? search.mode : undefined,
    next: typeof search.next === "string" ? safeAuthDestination(search.next) : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in · Archon" }] }),
  component: AuthPage,
});
const inputClass =
  "auth-input h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:border-accent focus:shadow-ring disabled:opacity-60";
export function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuth();
  const mode = search.mode ?? "signin";
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (authCallbackFailed && auth.status === "signed-out")
      setError(
        "This email link is invalid, expired or already used. Sign in, or request a new confirmation or reset link.",
      );
  }, [auth.status]);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [until, setUntil] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const task = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (auth.status === "authenticated")
      void navigate({ to: safeAuthDestination(search.next), replace: true });
    if (auth.status === "recovery") void navigate({ to: "/reset-password", replace: true });
  }, [auth.status, navigate, search.next]);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  const switchMode = (next: Mode) => {
    if (task.current) return;
    setError("");
    setMessage("");
    setConfirmation(false);
    setShow(false);
    setCaps(false);
    void navigate({
      to: "/login",
      search: { mode: next === "signin" ? undefined : next, next: search.next },
      replace: true,
    });
  };
  const emailSent =
    "If this address is eligible, an email will arrive shortly. Check your inbox and spam folder. Use the newest link.";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (task.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const address = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirm = form.elements.namedItem("confirm") as HTMLInputElement | null;
    if (confirm && confirm.value !== password) {
      confirm.setCustomValidity("Passwords do not match.");
      confirm.reportValidity();
      return;
    }
    if (mode === "forgot" && seconds > 0) return;
    task.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setEmail(address);
    try {
      if (mode === "forgot") {
        await auth.resetPassword(address);
        if (mounted.current) {
          setUntil(Date.now() + 60_000);
          setMessage(emailSent);
        }
      } else if (mode === "signup") {
        const result = await auth.signUp(address, password, String(data.get("name") ?? "").trim());
        if (mounted.current && !result.session) {
          setUntil(Date.now() + 60_000);
          setMessage(emailSent + " Verify your email, then sign in to create or join a workspace.");
          setConfirmation(true);
        }
      } else await auth.signIn(address, password);
    } catch (failure) {
      if (mounted.current) {
        setError(authErrorMessage(failure));
        setConfirmation(
          !!failure &&
            typeof failure === "object" &&
            "code" in failure &&
            failure.code === "email_not_confirmed",
        );
      }
    } finally {
      task.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function resend() {
    if (task.current || seconds || !email) return;
    task.current = true;
    setBusy(true);
    setError("");
    try {
      await resendConfirmation(email);
      if (mounted.current) {
        setUntil(Date.now() + 60_000);
        setMessage(emailSent);
      }
    } catch (failure) {
      if (mounted.current) setError(authErrorMessage(failure));
    } finally {
      task.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <main className="auth-page text-foreground antialiased selection:bg-accent/20">
      <section className="auth-shell" aria-labelledby="auth-title">
        <header className="auth-header">
          <div className="auth-brand">
            <Link
              to="/"
              aria-label="Archon home"
              className="auth-focus inline-flex min-h-11 items-center rounded-sm"
            >
              <ArchonWordmark size="md" hideTagline />
            </Link>
          </div>
          <div className="auth-navigation">
            <Link
              to="/"
              aria-label="Back to site"
              className="auth-focus flex min-h-11 items-center gap-2 rounded-sm px-2 text-sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Back to site</span>
            </Link>
            <ThemeToggle className="size-11 lg:border-white/25 lg:bg-transparent lg:text-[#f5f1ec] lg:hover:bg-white/10" />
          </div>
        </header>
        <div className="auth-form-area" data-mode={mode}>
          <div className="auth-form-content">
            <div className="auth-introduction">
              <h1 id="auth-title" className="auth-title">
                {mode === "signup"
                  ? "Create your account"
                  : mode === "forgot"
                    ? "Forgot your password?"
                    : "Welcome back"}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {mode === "signup"
                  ? "Save your audits and review findings in one workspace."
                  : mode === "forgot"
                    ? "Enter your account email. We’ll send instructions to reset your password."
                    : "Sign in to review your scans, findings and audit reports."}
              </p>
            </div>
            {auth.status === "error" && (
              <div role="alert" className="mb-4 text-sm">
                {auth.error}{" "}
                <button className="underline" onClick={() => void auth.retry()}>
                  Retry session check
                </button>
              </div>
            )}
            {error && (
              <p
                id="auth-error"
                role="alert"
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm"
              >
                {error}
              </p>
            )}
            {message && (
              <div
                role="status"
                className="mb-4 rounded-md border border-accent/30 bg-accent/10 p-3 text-sm leading-relaxed"
              >
                <EnvelopeSimple size={18} className="mb-2 text-accent" />
                {message}
              </div>
            )}
            <form
              onInput={(event) => {
                const confirm = event.currentTarget.elements.namedItem("confirm");
                if (confirm instanceof HTMLInputElement) confirm.setCustomValidity("");
              }}
              onSubmit={(event) => void submit(event)}
              aria-describedby={error ? "auth-error" : undefined}
              aria-busy={busy || auth.isLoading}
            >
              <fieldset disabled={busy || auth.isLoading} className="auth-fields">
                {mode === "signup" && (
                  <label className="block text-sm font-medium">
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={100}
                      placeholder="Your full name"
                      className={inputClass + " mt-1.5"}
                    />
                  </label>
                )}
                <label className="block text-sm font-medium">
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete={mode === "signin" ? "username" : "email"}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass + " mt-1.5"}
                  />
                </label>
                {mode !== "forgot" && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label htmlFor="auth-password" className="text-sm font-medium">
                        Password
                      </label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="auth-focus min-h-11 rounded-sm text-sm text-accent hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="auth-password"
                        name="password"
                        type={show ? "text" : "password"}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        required
                        minLength={mode === "signup" ? 8 : undefined}
                        onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                        onBlur={() => setCaps(false)}
                        aria-describedby="password-help"
                        placeholder={mode === "signup" ? "Create a password" : undefined}
                        className={inputClass + " pr-16"}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((v) => !v)}
                        aria-label={show ? "Hide password" : "Show password"}
                        aria-pressed={show}
                        aria-controls="auth-password"
                        className="auth-focus absolute right-0.5 top-0.5 flex h-11 w-14 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <span className="text-xs">{show ? "Hide" : "Show"}</span>
                      </button>
                    </div>
                    <p
                      id="password-help"
                      className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
                    >
                      {caps ? "Caps Lock is on. " : ""}
                      {mode === "signup"
                        ? "At least 8 characters. A longer, unique password is recommended."
                        : ""}
                    </p>
                  </div>
                )}
                {mode === "signup" && (
                  <>
                    <label className="block text-sm font-medium">
                      Confirm password
                      <input
                        name="confirm"
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        placeholder="Re-enter your password"
                        onInput={(e) => e.currentTarget.setCustomValidity("")}
                        className={inputClass + " mt-1.5"}
                      />
                    </label>
                  </>
                )}
                <button
                  type="submit"
                  disabled={busy || (mode === "forgot" && seconds > 0)}
                  className="auth-focus inline-flex h-12 w-full items-center justify-center gap-3 rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy
                    ? mode === "forgot"
                      ? "Sending instructions…"
                      : mode === "signup"
                        ? "Creating account…"
                        : "Signing in…"
                    : mode === "forgot"
                      ? seconds
                        ? `Resend in ${seconds}s`
                        : "Send reset link"
                      : mode === "signup"
                        ? "Create account"
                        : "Sign in"}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </fieldset>
            </form>
            {mode !== "forgot" && (
              <>
                <div className="auth-divider flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  disabled={busy || auth.isLoading}
                  className="auth-focus flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-input bg-transparent text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                  onClick={() => {
                    if (task.current) return;
                    task.current = true;
                    setBusy(true);
                    setError("");
                    void signInWithGitHub(search.next).catch(() => {
                      if (mounted.current) {
                        setError("GitHub sign-in could not start. Please retry.");
                        setBusy(false);
                      }
                      task.current = false;
                    });
                  }}
                >
                  <GithubLogo size={22} weight="fill" aria-hidden="true" /> Continue with GitHub
                </button>
                <p className="auth-switch text-center text-sm text-muted-foreground">
                  {mode === "signin" ? "New to Archon? " : "Already have an account? "}
                  <button
                    type="button"
                    disabled={busy || auth.isLoading}
                    onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                    className="auth-focus min-h-11 rounded-sm font-medium text-accent underline underline-offset-4 disabled:opacity-60"
                  >
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              </>
            )}
            {confirmation && (
              <button
                type="button"
                disabled={busy || seconds > 0}
                onClick={() => void resend()}
                className="auth-focus mt-3 min-h-11 w-full rounded-md border border-input px-3 text-sm disabled:opacity-60"
              >
                {seconds ? `Resend confirmation in ${seconds}s` : "Resend confirmation email"}
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => switchMode("signin")}
                className="auth-focus mt-3 min-h-11 rounded-sm text-sm text-muted-foreground hover:underline"
              >
                Back to sign in
              </button>
            )}
            {message && (
              <p className="mt-3 text-xs text-muted-foreground">
                Wrong address? Edit the email above. Resend is available after 60 seconds.
              </p>
            )}
          </div>
        </div>
        <aside className="auth-artwork" aria-label="Archon audit workspace illustration">
          <picture>
            <source media="(min-width: 1024px)" srcSet="/assets/archon-auth-gateway.webp" />
            <img
              alt=""
              width={1024}
              height={1280}
              loading="eager"
              fetchPriority="high"
              src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
              decoding="async"
              className="auth-gateway"
            />
          </picture>
          <div className="auth-artwork-caption">
            <p>
              Review the evidence.
              <br />
              Understand the next step.
            </p>
          </div>
        </aside>
        <footer className="auth-footer text-xs text-muted-foreground sm:text-sm">
          <p>
            {mode === "signup"
              ? "Verify your email if requested, then create or join a workspace."
              : "Personal and work email addresses are welcome."}
          </p>
          <div className="flex items-center gap-5">
            <Link
              to="/privacy"
              className="auth-focus inline-flex min-h-11 items-center rounded-sm text-accent underline underline-offset-4"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="auth-focus inline-flex min-h-11 items-center rounded-sm text-accent underline underline-offset-4"
            >
              Terms
            </Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
