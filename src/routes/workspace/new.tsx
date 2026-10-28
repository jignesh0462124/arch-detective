import { RequireAuth } from "@/components/auth/RequireAuth";
import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";
import { Buildings, ArrowRight, CircleNotch, ShieldWarning } from "@phosphor-icons/react";
import { useCreateWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/workspace/new")({
  head: () => ({
    meta: [
      { title: "Create Workspace · Archon" },
      {
        name: "description",
        content: "Create your Archon workspace to run security scans and manage review findings.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <NewWorkspacePage />
    </RequireAuth>
  ),
});

/** Slug-safe character filter — allows lowercase letters, digits, and hyphens. */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/^-+|-+$/g, "");
}

function NewWorkspacePage() {
  const navigate = useNavigate();
  const create = useCreateWorkspace();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  /** Auto-derive slug from name when user hasn't manually edited it. */
  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(toSlug(value));
    }
    setFieldError(null);
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(toSlug(value));
    setFieldError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFieldError("Workspace name is required.");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{0,46}[a-z0-9]$/.test(slug)) {
      setFieldError("Slug must be 2–48 characters and start and end with a letter or number.");
      return;
    }

    try {
      await create.mutateAsync({ name: name.trim(), slug });
      // Navigate to dashboard with the newly active workspace
      void navigate({
        to: "/dashboard",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create workspace in database.";
      setFieldError(msg);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <Link to="/dashboard" aria-label="Back to dashboard">
          <ArchonWordmark size="sm" />
        </Link>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <ShieldWarning size={26} weight="duotone" className="text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          A workspace groups scans, findings, and reports for your team. Keep your project scans,
          findings and team in one workspace.
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-8 shadow-sm"
      >
        {/* Name field */}
        <div className="space-y-1.5">
          <label htmlFor="ws-name" className="block text-sm font-medium">
            Workspace name
          </label>
          <input
            id="ws-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Fintech Core API"
            maxLength={64}
            autoFocus
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
          />
        </div>

        {/* Slug field */}
        <div className="space-y-1.5">
          <label htmlFor="ws-slug" className="block text-sm font-medium">
            Project URL slug
          </label>
          <div className="flex items-center gap-0 rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-shadow overflow-hidden">
            <span className="flex h-full items-center border-r border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground select-none">
              workspace/
            </span>
            <input
              id="ws-slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="fintech-core-api"
              maxLength={48}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        {/* Error message */}
        {fieldError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <Buildings size={16} weight="duotone" className="shrink-0" />
            {fieldError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={create.isPending || !name.trim() || !slug}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {create.isPending ? (
            <>
              <CircleNotch size={16} className="animate-spin" />
              Creating workspace in database…
            </>
          ) : (
            <>
              Create workspace
              <ArrowRight size={15} weight="bold" />
            </>
          )}
        </button>
      </form>
      <Link to="/dashboard" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
        Cancel and return to dashboard
      </Link>

      {/* Info footer */}
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Workspaces are scoped project-wise and support multi-tenant security scans.
      </p>
    </div>
  );
}
