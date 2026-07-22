import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in to Archon" },
      {
        name: "description",
        content: "Access your Archon compliance and threat-modeling workspace.",
      },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "signin" | "signup" | "forgot";

const fieldClass =
  "h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/25 focus:border-accent focus:shadow-ring";

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
    setShowPassword(false);
  };

  const handlePreviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(
      mode === "forgot"
        ? "Password recovery preview complete. No email was sent."
        : "Authentication preview complete. No account or session was created.",
    );
  };

  const heading =
    mode === "signup"
      ? "Create your workspace"
      : mode === "forgot"
        ? "Reset your password"
        : "Welcome back";

  const description =
    mode === "signup"
      ? "Set up a private workspace for your first security review."
      : mode === "forgot"
        ? "Enter your work email and we will prepare a secure reset link."
        : "Sign in to review scans, findings, and audit reports.";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 bg-ink" aria-hidden>
        <img
          src="/assets/archon-infrastructure-backdrop.webp"
          alt=""
          className="h-full w-full object-cover opacity-30 dark:opacity-40"
          width={1672}
          height={941}
        />
      </div>

      <div className="relative z-10 min-h-screen">
        <header className="border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex min-h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link to="/" aria-label="Archon home" className="flex min-h-10 min-w-0 items-center">
              <ArchonWordmark size="sm" />
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/"
                aria-label="Back to site"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:shadow-ring"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Back to site</span>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1280px] px-4 py-4 sm:px-6 sm:py-6">
          <section className="grid w-full overflow-hidden rounded-sm border border-border bg-card lg:min-h-[600px] lg:grid-cols-12 xl:min-h-[700px]">
            <div className="order-2 flex min-w-0 items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:order-1 lg:col-span-5 lg:px-10 xl:px-14">
              <div className="w-full max-w-[420px]">
                {mode !== "forgot" ? (
                  <div
                    className="grid h-11 grid-cols-2 rounded-lg bg-secondary p-1"
                    role="tablist"
                    aria-label="Authentication mode"
                  >
                    {(
                      [
                        ["signin", "Sign in"],
                        ["signup", "Create account"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={mode === value}
                        onClick={() => switchMode(value)}
                        className={cn(
                          "rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-ring",
                          mode === value
                            ? "border border-border bg-card text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:shadow-ring"
                  >
                    <ArrowLeft size={14} /> Back to sign in
                  </button>
                )}

                <div className="mt-7">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    {mode === "signup" ? (
                      <UserRound size={18} />
                    ) : mode === "forgot" ? (
                      <KeyRound size={18} />
                    ) : (
                      <LockKeyhole size={18} />
                    )}
                  </div>
                  <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">
                    {heading}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>

                {message && (
                  <p
                    aria-live="polite"
                    className="mt-4 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-[12px] leading-relaxed text-foreground"
                  >
                    {message}
                  </p>
                )}

                {mode === "signin" && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setMessage("GitHub sign-in is shown for preview and is not connected yet.")
                      }
                      className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-input bg-card text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:shadow-ring"
                    >
                      <Github size={17} /> Continue with GitHub
                    </button>
                    <div className="my-5 flex items-center gap-3" aria-hidden>
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-medium text-muted-foreground">
                        or use work email
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}

                <form
                  onSubmit={handlePreviewSubmit}
                  className={cn(
                    mode === "signup" ? "mt-6 space-y-3" : "space-y-4",
                    mode === "forgot" && "mt-7",
                  )}
                >
                  {mode === "signup" && (
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium">Full name</span>
                      <span className="relative block">
                        <UserRound
                          size={16}
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                          name="name"
                          type="text"
                          autoComplete="name"
                          required
                          placeholder="Avery Morgan"
                          className={fieldClass}
                        />
                      </span>
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium">Work email</span>
                    <span className="relative block">
                      <Mail
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="you@company.com"
                        className={fieldClass}
                      />
                    </span>
                  </label>

                  {mode !== "forgot" && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label htmlFor="auth-password" className="text-[13px] font-medium">
                          Password
                        </label>
                        {mode === "signin" && (
                          <button
                            type="button"
                            onClick={() => switchMode("forgot")}
                            className="min-h-8 text-[12px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:shadow-ring"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <span className="relative block">
                        <LockKeyhole
                          size={16}
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                          id="auth-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          required
                          minLength={8}
                          placeholder={
                            mode === "signup" ? "At least 8 characters" : "Enter password"
                          }
                          className={`${fieldClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((visible) => !visible)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:shadow-ring"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </span>
                    </div>
                  )}

                  {mode === "signup" && (
                    <label className="flex cursor-pointer items-start gap-3 text-[12px] leading-relaxed text-muted-foreground">
                      <input
                        type="checkbox"
                        required
                        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span>
                        I agree to the{" "}
                        <a href="#terms" className="text-foreground underline">
                          Terms
                        </a>{" "}
                        and{" "}
                        <a href="#privacy" className="text-foreground underline">
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
                  )}

                  <button
                    type="submit"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:shadow-ring"
                  >
                    {mode === "signup"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Sign in"}
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </button>
                </form>
              </div>
            </div>

            <aside className="relative order-1 min-h-56 overflow-hidden border-b border-border bg-[#0d0d0d] lg:order-2 lg:col-span-7 lg:min-h-0 lg:border-b-0 lg:border-l">
              <img
                src="/assets/archon-auth-gateway.webp"
                alt="Physical security gateway protecting infrastructure and an audit document"
                className="absolute inset-0 h-full w-full object-cover object-[center_56%] sm:object-[center_52%] lg:object-contain lg:object-center"
                width={1024}
                height={1280}
                fetchPriority="high"
              />

              <div className="absolute left-4 top-4 max-w-[230px] border-l-2 border-[#ff5600] bg-black/85 px-3 py-2.5 text-white sm:left-7 sm:top-7 sm:max-w-[270px] sm:px-4 sm:py-3.5">
                <div className="flex items-center gap-2 font-mono text-[9px] text-white/70 sm:text-[10px]">
                  <span className="size-1.5 rounded-full bg-success" /> VERIFIED ACCESS
                </div>
                <p className="mt-1.5 text-[13px] font-semibold leading-snug sm:text-[15px]">
                  Identity checked before every audit action.
                </p>
              </div>

              <div className="absolute right-4 top-4 hidden items-center gap-2 text-white/70 sm:right-6 sm:top-6 sm:flex">
                <ShieldCheck size={16} className="text-[#ff5600]" />
                <span className="font-mono text-[10px]">ARCHON IDENTITY</span>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
