import { Link, useNavigate } from "@tanstack/react-router";
import { UserCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function AccountMenu() {
  const { signOut, signingOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  async function leave() {
    setError("");
    try {
      await signOut();
      await navigate({ to: "/login", replace: true });
    } catch {
      setError("Couldn’t confirm sign out. Please retry.");
    }
  }
  return (
    <details
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label="Account menu"
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card focus-visible:shadow-ring"
      >
        <UserCircle size={19} />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-card p-3 text-sm shadow-xl">
        <Link to="/settings" className="flex min-h-10 items-center rounded px-2 hover:bg-secondary">
          Settings
        </Link>
        <Link to="/profile" className="flex min-h-10 items-center rounded px-2 hover:bg-secondary">
          Profile and sessions
        </Link>
        <p className="my-2 px-2 text-xs leading-relaxed text-muted-foreground">
          Sign out of this browser and its open tabs. Other devices stay signed in.
        </p>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void leave()}
          className="min-h-10 w-full rounded border border-border px-2 text-left hover:bg-secondary disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : error ? "Retry sign out" : "Sign out"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
