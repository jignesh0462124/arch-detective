import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { authScope, isCurrentScope } from "@/lib/authState";
import { rememberAudit } from "@/lib/auditResume";
import { useUnsavedSettings } from "@/hooks/useUnsavedSettings";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { workbenchError } from "@/lib/api/workbench";
import {
  extensionCapabilities,
  startExtensionReview,
  type ExtensionDeclarations,
  type ExtensionStore,
} from "@/lib/api/extensionReview";

const field =
  "mt-1 w-full rounded-md border border-border bg-background p-3 text-sm text-foreground";
const blank = (): ExtensionDeclarations => ({
  purpose: "",
  permissions: "",
  browser_settings: "",
  data_use: "",
  advertising: "",
  paid_features: "",
  chrome: { description: "", screenshots_description: "", privacy_text: "", privacy_url: "" },
  edge: { description: "", screenshots_description: "", privacy_text: "", privacy_url: "" },
});

export function ExtensionUpload({ workspaceId, role }: { workspaceId: string; role: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const capabilities = useQuery({
    queryKey: ["extension-capabilities", user?.id, workspaceId],
    queryFn: ({ signal }) => extensionCapabilities(signal),
    staleTime: 60000,
    retry: false,
  });
  const [stores, setStores] = useState<ExtensionStore[]>(["chrome", "edge"]);
  const [declarations, setDeclarations] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<{ store: ExtensionStore; file: File }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const accepted = useRef(false);
  const key = useRef("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  useUnsavedSettings(
    () => busy && !accepted.current,
    "The extension upload has not been accepted yet. Leaving may stop the upload. Continue?",
  );
  const changed = () => {
    key.current = "";
    setError("");
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || request.current || !stores.length) return;
    const scope = authScope();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    key.current ||= crypto.randomUUID();
    try {
      const result = await startExtensionReview(
        workspaceId,
        file,
        stores,
        declarations,
        key.current,
        controller.signal,
        screenshots.filter((image) => stores.includes(image.store)),
      );
      if (!alive.current || !isCurrentScope(scope)) return;
      accepted.current = true;
      rememberAudit(workspaceId, {
        id: result.scan_id,
        name: file.name,
        created: new Date().toISOString(),
      });
      setBusy(false);
      await navigate({
        to: "/workspace/$workspaceId/scans/$scanId/workbench",
        params: { workspaceId, scanId: result.scan_id },
      });
    } catch (reason) {
      if (alive.current && isCurrentScope(scope) && !controller.signal.aborted)
        setError(workbenchError(reason));
    } finally {
      request.current = null;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="rounded-md border border-border bg-card p-5 sm:p-6">
      <h3 className="text-lg font-semibold">Browser extension review</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Review the exact ZIP you intend to submit. Store approval remains Google’s or Microsoft’s
        decision.
      </p>
      {capabilities.isPending ? (
        <p role="status" className="mt-4">
          Checking review availability…
        </p>
      ) : capabilities.isError ? (
        <div role="alert" className="mt-4">
          <p>{workbenchError(capabilities.error)}</p>
          <BrutalButton size="sm" onClick={() => void capabilities.refetch()}>
            Retry
          </BrutalButton>
        </div>
      ) : !capabilities.data.enabled ? (
        <p role="status" className="mt-4 rounded border border-border bg-secondary p-4 text-sm">
          {capabilities.data.reason}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
            <legend className="sr-only">Extension package and declarations</legend>
            <div className="flex flex-wrap gap-5">
              {(["chrome", "edge"] as const).map((store) => (
                <label className="flex items-center gap-2 text-sm" key={store}>
                  <input
                    type="checkbox"
                    checked={stores.includes(store)}
                    onChange={(e) => {
                      changed();
                      setStores((previous) =>
                        e.target.checked
                          ? [...previous, store]
                          : previous.filter((s) => s !== store),
                      );
                    }}
                  />
                  {store === "chrome" ? "Chrome Web Store" : "Microsoft Edge Add-ons"}
                </label>
              ))}
            </div>
            <label className="block text-sm font-medium">
              Built extension ZIP
              <input
                required
                type="file"
                accept=".zip,application/zip"
                className={field}
                onChange={(e) => {
                  changed();
                  setFile(e.target.files?.[0] || null);
                }}
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                manifest.json must be at the root. No scripts are run and no URLs are fetched.
              </span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ["purpose", "Single purpose"],
                  ["permissions", "Permission justifications"],
                  ["browser_settings", "Browser setting changes, consent and undo"],
                  ["data_use", "Data collected, shared and retained"],
                  ["advertising", "Advertising and affiliate disclosures"],
                  ["paid_features", "Paid features and subscriptions"],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="block text-sm font-medium">
                  {label}
                  <textarea
                    maxLength={3000}
                    rows={3}
                    value={declarations[name]}
                    placeholder="Not supplied — this will remain unassessed"
                    className={field}
                    onChange={(e) => {
                      changed();
                      setDeclarations((previous) => ({ ...previous, [name]: e.target.value }));
                    }}
                  />
                </label>
              ))}
            </div>
            {stores.map((store) => (
              <details key={store} className="rounded-md border border-border p-4" open>
                <summary className="cursor-pointer text-sm font-semibold">
                  {store === "chrome" ? "Chrome" : "Microsoft Edge"} listing and privacy
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {(
                    [
                      ["description", "Store description"],
                      ["privacy_text", "Privacy policy text"],
                      ["privacy_url", "Privacy URL (HTTPS, not fetched)"],
                      [
                        "screenshots_description",
                        "Screenshot evidence description (manual review)",
                      ],
                    ] as const
                  ).map(([name, label]) => (
                    <label key={name} className="text-sm font-medium">
                      {label}
                      <textarea
                        rows={name === "privacy_url" ? 1 : 3}
                        maxLength={name === "privacy_url" ? 2000 : 3000}
                        className={field}
                        value={declarations[store][name]}
                        onChange={(e) => {
                          changed();
                          setDeclarations((previous) => ({
                            ...previous,
                            [store]: { ...previous[store], [name]: e.target.value },
                          }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-4 block text-sm font-medium">
                  Listing screenshots · {store === "chrome" ? "Chrome" : "Edge"}
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg"
                    className={field}
                    onChange={(e) => {
                      changed();
                      const files = Array.from(e.target.files || []);
                      if (
                        files.length > 4 ||
                        files.some(
                          (image) =>
                            image.size > 512 * 1024 ||
                            !["image/png", "image/jpeg"].includes(image.type),
                        )
                      ) {
                        setError(
                          "Choose up to four PNG/JPEG screenshots per store, at most 512 KiB each.",
                        );
                        e.target.value = "";
                        setScreenshots((previous) =>
                          previous.filter((image) => image.store !== store),
                        );
                      } else
                        setScreenshots((previous) => [
                          ...previous.filter((image) => image.store !== store),
                          ...files.map((file) => ({ store, file })),
                        ]);
                    }}
                  />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Private review evidence. Accuracy needs human review; images expire with the
                    source window.
                  </span>
                </label>
              </details>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Missing declarations are not a pass. Runtime behaviour, publisher identity and
            screenshot accuracy need manual review. Supporting declarations expire with the source
            window.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <BrutalButton
            disabled={
              busy || !file || !stores.length || !["owner", "admin", "analyst"].includes(role)
            }
            type="submit"
          >
            {busy ? "Uploading extension…" : "Start extension review"}
          </BrutalButton>
          {role === "viewer" && (
            <p className="text-sm text-muted-foreground">
              Viewers can read saved reviews. Ask an analyst to start a review.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
