import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeSlash, LockKey } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/authState";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password · Archon" }] }),
});
export function ResetPasswordPage() {
  const auth = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [caps, setCaps] = useState(false);
  const task = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function finish() {
    await auth.signOut("local");
    if (mounted.current) setFinished(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (task.current || auth.status !== "recovery") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirm = form.elements.namedItem("confirm") as HTMLInputElement;
    if (confirm.value !== password) {
      confirm.setCustomValidity("Passwords do not match.");
      confirm.reportValidity();
      return;
    }
    task.current = true;
    setBusy(true);
    setError("");
    let changed = false;
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      changed = true;
      if (mounted.current) setUpdated(true);
      await finish();
    } catch (failure) {
      if (mounted.current)
        setError(
          changed
            ? "Password updated, but sign out could not be confirmed. Retry sign out below; do not reset the password again."
            : authErrorMessage(failure),
        );
    } finally {
      task.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function retrySignOut() {
    if (task.current) return;
    task.current = true;
    setBusy(true);
    setError("");
    try {
      await finish();
    } catch {
      if (mounted.current)
        setError("Sign out could not be confirmed. Check your connection and retry.");
    } finally {
      task.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Archon home">
            <ArchonWordmark size="sm" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[480px] items-center px-4 py-10">
        <section className="w-full rounded-sm border border-border bg-card p-6 sm:p-8">
          <LockKey size={24} className="mb-4 text-accent" />
          {updated ? (
            <>
              <h1 className="text-2xl font-semibold">Password updated</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {finished
                  ? "Sign in with your new password to continue."
                  : "Finishing sign out in this browser…"}
              </p>
              {!finished && !busy && (
                <button
                  className="mt-5 min-h-12 rounded-lg bg-primary px-4 text-primary-foreground"
                  onClick={() => void retrySignOut()}
                >
                  Retry sign out
                </button>
              )}
              {finished && (
                <Link
                  to="/login"
                  className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-primary px-4 text-primary-foreground"
                >
                  Sign in
                </Link>
              )}
            </>
          ) : auth.isLoading ? (
            <p role="status">Verifying reset link…</p>
          ) : auth.status === "error" ? (
            <>
              <h1 className="text-2xl font-semibold">Couldn’t verify your link</h1>
              <p className="mt-3 text-sm">{auth.error}</p>
              <button className="mt-4 underline" onClick={() => void auth.retry()}>
                Retry
              </button>
            </>
          ) : auth.status !== "recovery" ? (
            <>
              <h1 className="text-2xl font-semibold">Reset link unavailable</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This link is invalid, expired or already used. Open the newest email link to set
                your password.
              </p>
              {auth.status === "authenticated" ? (
                <p className="mt-4 text-sm">
                  You’re already signed in. Request a new password email from{" "}
                  <Link to="/profile" className="underline">
                    Profile
                  </Link>
                  .
                </p>
              ) : (
                <Link
                  to="/login"
                  search={{ mode: "forgot" }}
                  className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-primary px-4 text-primary-foreground"
                >
                  Request new link
                </Link>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">Set your new password</h1>
              <p
                id="reset-help"
                className="mb-6 mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                At least 8 characters. A longer, unique password is recommended. Your account’s
                security policy may require more.
              </p>
              <form
                onSubmit={(event) => void submit(event)}
                onInput={(event) => {
                  const confirm = event.currentTarget.elements.namedItem("confirm");
                  if (confirm instanceof HTMLInputElement) confirm.setCustomValidity("");
                }}
              >
                <fieldset disabled={busy} className="space-y-4">
                  <label htmlFor="reset-password" className="block text-sm font-medium">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-password"
                      name="password"
                      required
                      minLength={8}
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      aria-describedby="reset-help"
                      onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                      onBlur={() => setCaps(false)}
                      className="h-12 w-full rounded-lg border border-input bg-background px-4 pr-12 outline-none focus:border-accent"
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
                  {caps && (
                    <p role="status" className="text-xs text-muted-foreground">
                      Caps Lock is on.
                    </p>
                  )}
                  <label className="block text-sm font-medium">
                    Confirm new password
                    <input
                      name="confirm"
                      required
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      onInput={(e) => e.currentTarget.setCustomValidity("")}
                      className="mt-1.5 h-12 w-full rounded-lg border border-input bg-background px-4 outline-none focus:border-accent"
                    />
                  </label>
                  <button
                    className="h-12 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    type="submit"
                  >
                    {busy ? "Updating password…" : "Update password"}
                  </button>
                </fieldset>
              </form>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm"
            >
              {error}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
