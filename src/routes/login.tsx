import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeSlash,
  LockKey,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { MarketingBackdrop } from "@/components/marketing/MarketingChrome";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";
import { useAuth } from "@/hooks/useAuth";
import { resendConfirmation, signInWithGitHub } from "@/lib/api/auth";
import { authErrorMessage, safeAuthDestination } from "@/lib/authState";
import { authCallbackFailed } from "@/lib/supabase";

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
  "h-12 w-full rounded-lg border border-input bg-background px-4 text-sm outline-none focus:border-accent focus:shadow-ring disabled:opacity-60";
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
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-accent/20">
      <MarketingBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
            <Link to="/" aria-label="Archon home">
              <ArchonWordmark size="sm" />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                aria-label="Back to site"
                className="flex min-h-10 items-center gap-2 px-3 text-sm text-muted-foreground"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Back to site</span>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10">
          <section className="grid overflow-hidden rounded-sm border border-border bg-card lg:min-h-[650px] lg:grid-cols-12">
            <div className="flex min-w-0 items-center justify-center px-5 py-8 sm:px-10 lg:col-span-5">
              <div className="w-full max-w-[420px]">
                <div
                  className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1"
                  aria-label="Account access"
                >
                  {(["signin", "signup"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      aria-pressed={mode === value}
                      onClick={() => switchMode(value)}
                      className={`h-10 rounded-md text-sm font-medium focus-visible:shadow-ring ${mode === value ? "border border-border bg-card" : "text-muted-foreground"}`}
                    >
                      {value === "signin" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>
                <div className="mb-6 mt-7">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <LockKey size={20} />
                  </div>
                  <h1 className="text-[28px] font-semibold leading-tight">
                    {mode === "signup"
                      ? "Create your account"
                      : mode === "forgot"
                        ? "Forgot your password?"
                        : "Welcome back"}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {mode === "signup"
                      ? "Create an account, verify your email if requested, then create or join a workspace."
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
                {mode !== "forgot" && (
                  <button
                    type="button"
                    disabled={busy || auth.isLoading}
                    className="mb-5 flex min-h-12 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium disabled:opacity-60"
                    onClick={() => {
                      if (task.current) return;
                      task.current = true;
                      setBusy(true);
                      setError("");
                      void signInWithGitHub(search.next).catch(() => {
                        setError("GitHub sign-in could not start. Please retry.");
                        task.current = false;
                        setBusy(false);
                      });
                    }}
                  >
                    Continue with GitHub
                  </button>
                )}
                <form
                  onInput={(event) => {
                    const confirm = event.currentTarget.elements.namedItem("confirm");
                    if (confirm instanceof HTMLInputElement) confirm.setCustomValidity("");
                  }}
                  onSubmit={(event) => void submit(event)}
                  aria-describedby={error ? "auth-error" : undefined}
                >
                  <fieldset disabled={busy || auth.isLoading} className="space-y-4">
                    {mode === "signup" && (
                      <label className="block text-sm font-medium">
                        Full name
                        <input
                          name="name"
                          autoComplete="name"
                          required
                          maxLength={100}
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
                              className="min-h-8 text-xs text-accent hover:underline"
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
                            className={inputClass + " pr-12"}
                          />
                          <button
                            type="button"
                            onClick={() => setShow((v) => !v)}
                            aria-label={show ? "Hide password" : "Show password"}
                            className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-md hover:bg-secondary"
                          >
                            {show ? <EyeSlash size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        <p id="password-help" className="mt-1.5 text-xs text-muted-foreground">
                          {caps ? "Caps Lock is on. " : ""}
                          {mode === "signup"
                            ? "At least 8 characters. A longer, unique password is recommended."
                            : "Use your existing account password."}
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
                            onInput={(e) => e.currentTarget.setCustomValidity("")}
                            className={inputClass + " mt-1.5"}
                          />
                        </label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Read our{" "}
                          <Link to="/terms" className="underline">
                            usage notes
                          </Link>{" "}
                          and{" "}
                          <Link to="/privacy" className="underline">
                            data handling notice
                          </Link>{" "}
                          before continuing.
                        </p>
                      </>
                    )}
                    <button
                      type="submit"
                      disabled={busy || (mode === "forgot" && seconds > 0)}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
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
                      <ArrowRight size={15} />
                    </button>
                  </fieldset>
                </form>
                {confirmation && (
                  <button
                    type="button"
                    disabled={busy || seconds > 0}
                    onClick={() => void resend()}
                    className="mt-3 min-h-10 w-full rounded-lg border border-border px-3 text-sm disabled:opacity-60"
                  >
                    {seconds ? `Resend confirmation in ${seconds}s` : "Resend confirmation email"}
                  </button>
                )}
                {mode === "forgot" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => switchMode("signin")}
                    className="mt-3 min-h-10 text-sm text-muted-foreground hover:underline"
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
            <aside className="relative hidden overflow-hidden border-l border-border bg-[#0d0d0d] lg:col-span-7 lg:block">
              <picture>
                <source media="(min-width: 1024px)" srcSet="/assets/archon-auth-gateway.webp" />
                <img
                  alt=""
                  width={1024}
                  height={1280}
                  loading="lazy"
                  src="/assets/archon-auth-gateway.webp"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </picture>
              <div className="absolute left-7 top-7 max-w-[270px] border-l-2 border-[#ff5600] bg-black/85 px-4 py-3 text-white">
                <p className="font-mono text-[10px] text-white/70">YOUR AUDIT WORKSPACE</p>
                <p className="mt-2 text-sm font-medium">
                  From source evidence to clearer security decisions.
                </p>
              </div>
            </aside>
          </section>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Use a personal or work email. Your saved audits stay with your account.
          </p>
        </main>
      </div>
    </div>
  );
}
