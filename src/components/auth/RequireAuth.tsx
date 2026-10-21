import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { safeAuthDestination } from "@/lib/authState";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user, retry, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (status === "signed-out")
      void navigate({
        to: "/login",
        search: { next: safeAuthDestination(location.href) },
        replace: true,
      });
    if (status === "recovery") void navigate({ to: "/reset-password", replace: true });
  }, [status, location.href, navigate]);
  if (status !== "authenticated")
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div role="status" className="max-w-md rounded-sm border border-border bg-card p-6">
          <p>{status === "error" ? error : "Checking your session…"}</p>
          {status === "error" && (
            <button
              className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => void retry()}
            >
              Retry session check
            </button>
          )}
        </div>
      </main>
    );
  return (
    <div key={user!.id} className="contents">
      {children}
    </div>
  );
}
