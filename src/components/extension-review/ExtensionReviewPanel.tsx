import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { CodeSolution } from "@/components/audit-workbench/CodeSolution";
import { workbenchError } from "@/lib/api/workbench";
import { apiClient } from "@/lib/api/client";
import { authScope, isCurrentScope } from "@/lib/authState";
import {
  compareExtensionReviews,
  getExtensionReview,
  getPolicyDetail,
  getPolicyResults,
  outcomeLabels,
  savePolicyNote,
  type PolicyDetail,
} from "@/lib/api/extensionReview";

const ExtensionUpload = lazy(() =>
  import("./ExtensionUpload").then((module) => ({ default: module.ExtensionUpload })),
);
const control =
  "min-h-10 min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground";

function PrivateScreenshot({
  workspaceId,
  scanId,
  id,
  store,
}: {
  workspaceId: string;
  scanId: string;
  id: string;
  store: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const image = useQuery({
    queryKey: ["extension-screenshot", user?.id, workspaceId, scanId, id],
    queryFn: ({ signal }) =>
      apiClient<{ data_url: string }>(
        `/api/v1/workspaces/${workspaceId}/extension-reviews/${scanId}/assets/${id}`,
        { signal, cache: "no-store" },
      ),
    enabled: open,
    retry: false,
    gcTime: 0,
  });
  return (
    <figure className="rounded border border-border p-3">
      <button
        type="button"
        className={control}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide" : "View"} {store === "chrome" ? "Chrome" : "Edge"} screenshot
      </button>
      {open &&
        (image.isPending ? (
          <p role="status">Loading private screenshot…</p>
        ) : image.isError ? (
          <div role="alert">
            <p>{workbenchError(image.error)}</p>
            <BrutalButton size="sm" onClick={() => void image.refetch()}>
              Retry screenshot
            </BrutalButton>
          </div>
        ) : (
          <img
            src={image.data.data_url}
            alt={`${store === "chrome" ? "Chrome" : "Edge"} listing screenshot supplied for manual review`}
            className="mt-3 max-h-96 w-full rounded object-contain"
          />
        ))}
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Developer-supplied evidence; listing accuracy has not been verified.
      </figcaption>
    </figure>
  );
}

export function NoticeDialog({ finding, onClose }: { finding: PolicyDetail; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="extension-notice-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/60 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {finding.store === "chrome" ? "Chrome Web Store" : "Microsoft Edge Add-ons"}
          </p>
          <h2 id="extension-notice-title" className="mt-1 text-xl font-semibold">
            Policy notice example
          </h2>
        </div>
        <button type="button" autoFocus onClick={onClose} className={control}>
          Close
        </button>
      </div>
      <p className="my-4 rounded border border-border bg-secondary p-3 text-sm font-medium">
        {finding.notice.label}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="space-y-3 rounded border border-border p-4">
          <h3 className="font-semibold">Example notice</h3>
          <p className="text-sm">{finding.notice.message}</p>
          {finding.notice.notification_id && (
            <p className="text-sm">Documented category: {finding.notice.notification_id}</p>
          )}
          <h4 className="text-sm font-semibold">Possible concern</h4>
          <p className="text-sm">{finding.title}</p>
          <h4 className="text-sm font-semibold">How to rectify</h4>
          <p className="text-sm">{finding.notice.remedy}</p>
        </section>
        <section className="space-y-3 rounded border border-border p-4">
          <h3 className="font-semibold">Your recorded finding</h3>
          <p className="text-sm">
            {outcomeLabels[finding.outcome]} · {finding.title}
          </p>
          <p className="break-words text-sm">{finding.details.explanation}</p>
          <p className="break-all font-mono text-xs">
            {finding.details.path || "Declaration / manual review"}
            {finding.details.line ? `:${finding.details.line}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            This is an Archon assessment, not an actual store decision. No email has been sent.
          </p>
        </section>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <a className="underline" target="_blank" rel="noreferrer" href={finding.details.policy_url}>
          Official policy
        </a>
        <a className="underline" target="_blank" rel="noreferrer" href={finding.notice.help_url}>
          Store guidance
        </a>
      </div>
      {finding.notice.reference_available && (
        <details className="mt-5 rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Redacted reference supplied by a user
          </summary>
          <p className="my-3 text-xs text-muted-foreground">
            Cropped excerpts of a supplied Blue Argon notice. Identifying details are omitted. This
            historical example is not a decision about your extension. Use the current official
            guidance for appeal instructions.
          </p>
          <img
            src="/notice-examples/chrome-blue-argon-reference-1.png"
            alt="Supplied notice excerpt: Blue Argon, remotely hosted code in a Manifest V3 package; bundle extension logic locally."
            loading="lazy"
            className="w-full rounded border border-border bg-white"
          />
          <img
            src="/notice-examples/chrome-blue-argon-reference-2.png"
            alt="Supplied notice continuation: Manifest V3 functionality must be discernible; the developer can review the store dashboard and appeal if the decision is mistaken."
            loading="lazy"
            className="mt-3 w-full rounded border border-border bg-white"
          />
        </details>
      )}
    </dialog>
  );
}

function ResultDetails({
  result,
  workspaceId,
  scanId,
  role,
  sourceAvailable,
  onOpenSource,
}: {
  result: PolicyDetail;
  workspaceId: string;
  scanId: string;
  role: string;
  sourceAvailable: boolean;
  onOpenSource: (path: string, line: number | null) => void;
}) {
  const [showNotice, setShowNotice] = useState(false);
  const [note, setNote] = useState(result.annotation?.note || "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const d = result.details;
  async function save() {
    if (saving) return;
    const scope = authScope();
    setSaving(true);
    setFeedback("");
    try {
      await savePolicyNote(workspaceId, scanId, result.id, note);
      if (alive.current && isCurrentScope(scope))
        setFeedback("Review note saved. Automated outcome is unchanged.");
    } catch (error) {
      if (alive.current && isCurrentScope(scope)) setFeedback(workbenchError(error));
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  return (
    <aside className="min-w-0 space-y-4 rounded-md border border-border bg-card p-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">
          {outcomeLabels[result.outcome]} · {result.store === "chrome" ? "Chrome" : "Edge"}
        </p>
        <h3 className="mt-1 text-lg font-semibold">{result.title}</h3>
      </div>
      <p className="break-all font-mono text-xs">
        {d.path || "Listing / policy checklist"}
        {d.line ? `:${d.line}` : ""}
      </p>
      {d.path && (
        <BrutalButton
          size="sm"
          variant="secondary"
          disabled={!sourceAvailable}
          onClick={() => onOpenSource(d.path!, d.line)}
        >
          Open recorded source
        </BrutalButton>
      )}
      <p className="text-sm">{d.explanation}</p>
      <div className="flex flex-col items-start gap-3">
        <a href={d.policy_url} className="text-sm underline" target="_blank" rel="noreferrer">
          View official policy
        </a>
        <BrutalButton size="sm" variant="secondary" onClick={() => setShowNotice(true)}>
          View violation notice example
        </BrutalButton>
      </div>
      {d.evidence && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Recorded evidence</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre rounded bg-secondary p-3 font-mono text-xs">
            {d.evidence}
          </pre>
        </details>
      )}
      <div>
        <h4 className="text-sm font-semibold">Remedy</h4>
        <p className="mt-1 text-sm text-muted-foreground">{d.remedy}</p>
      </div>
      <div>
        <h4 className="text-sm font-semibold">How to verify</h4>
        <p className="mt-1 text-sm text-muted-foreground">{d.verification}</p>
      </div>
      <CodeSolution
        workspaceId={workspaceId}
        scanId={scanId}
        policyResultId={result.id}
        finding={{
          id: result.id,
          title: result.title,
          file_path: d.path,
          line_number: d.line,
          remediation: d.remedy,
          location: {
            file_id: null,
            line_number: d.line,
            match_status: result.source_available ? "verified" : "unlocated",
          },
        }}
        available={sourceAvailable && role !== "viewer" && !!result.source_available}
        unavailableReason={
          role === "viewer"
            ? "Viewers can read remedies. Ask an analyst to request a code suggestion."
            : !d.path || !d.line
              ? "This policy check has no verified code location. Review its listing, declarations and written remedy."
              : undefined
        }
      />
      <details>
        <summary className="cursor-pointer text-sm">Assumptions and policy version</summary>
        <p className="mt-2 text-xs text-muted-foreground">{d.exceptions}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {d.method} · Pack {d.policy_version} · Reviewed {d.reviewed_at}
        </p>
      </details>
      <label className="block text-sm font-medium">
        Reviewer note
        <textarea
          maxLength={2000}
          rows={3}
          value={note}
          disabled={role === "viewer"}
          onChange={(e) => {
            setNote(e.target.value);
            setFeedback("");
          }}
          className={`${control} mt-2 w-full py-2`}
        />
      </label>
      {role !== "viewer" && (
        <BrutalButton size="sm" disabled={saving || !note.trim()} onClick={() => void save()}>
          {saving ? "Saving…" : "Save review note"}
        </BrutalButton>
      )}
      {feedback && (
        <p role="status" className="text-xs">
          {feedback}
        </p>
      )}
      {showNotice && <NoticeDialog finding={result} onClose={() => setShowNotice(false)} />}
    </aside>
  );
}

export function ExtensionReviewPanel({
  workspaceId,
  scanId,
  role,
  status,
  initialPolicyId,
  sourceAvailable,
  onOpenSource,
}: {
  workspaceId: string;
  scanId: string;
  role: string;
  status: string;
  initialPolicyId?: string;
  sourceAvailable: boolean;
  onOpenSource: (path: string, line: number | null) => void;
}) {
  const { user } = useAuth();
  const [store, setStore] = useState("");
  const [outcome, setOutcome] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(initialPolicyId || null);
  const followedPolicy = useRef<string | null>(null);
  const [tab, setTab] = useState("Findings");
  const [recheck, setRecheck] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [compareOffset, setCompareOffset] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const area = tab === "Permissions & browser settings" ? "permissions" : "";
  const scope = ["extension-review", user?.id, workspaceId, scanId];
  const review = useQuery({
    queryKey: [...scope, status, sourceAvailable],
    queryFn: ({ signal }) => getExtensionReview(workspaceId, scanId, signal),
    retry: false,
    gcTime: 0,
  });
  const page = useQuery({
    queryKey: [...scope, "results", offset, store, outcome, area],
    queryFn: ({ signal }) =>
      getPolicyResults(workspaceId, scanId, offset, store, outcome, signal, area),
    enabled: review.data?.status === "completed",
    retry: false,
    gcTime: 0,
  });
  const detail = useQuery({
    queryKey: [...scope, "detail", selected],
    queryFn: ({ signal }) => getPolicyDetail(workspaceId, scanId, selected!, signal),
    enabled: !!selected,
    retry: false,
    gcTime: 0,
  });
  useEffect(() => {
    if (
      initialPolicyId &&
      followedPolicy.current !== initialPolicyId &&
      detail.data?.id === initialPolicyId &&
      sourceAvailable &&
      detail.data.source_available &&
      detail.data.details.path
    ) {
      followedPolicy.current = initialPolicyId;
      onOpenSource(detail.data.details.path, detail.data.details.line);
    }
  }, [initialPolicyId, detail.data, sourceAvailable, onOpenSource]);
  const history = useQuery({
    queryKey: [...scope, "history", historyOffset],
    queryFn: ({ signal }) =>
      apiClient<{
        items: { scan_id: string; package_name: string; package_version: string }[];
        total: number;
      }>(`/api/v1/workspaces/${workspaceId}/extension-reviews?offset=${historyOffset}`, { signal }),
    enabled: compareOpen,
    retry: false,
    gcTime: 0,
  });
  const images = useQuery({
    queryKey: [...scope, "assets"],
    queryFn: ({ signal }) =>
      apiClient<{ items: { id: string; store: string }[] }>(
        `/api/v1/workspaces/${workspaceId}/extension-reviews/${scanId}/assets`,
        { signal },
      ),
    enabled: tab === "Listing & privacy" && sourceAvailable,
    retry: false,
    gcTime: 0,
  });
  const comparison = useQuery({
    queryKey: [...scope, "compare", baseline, compareOffset],
    queryFn: ({ signal }) =>
      compareExtensionReviews(workspaceId, scanId, baseline, compareOffset, signal),
    enabled: !!baseline && compareOpen,
    retry: false,
    gcTime: 0,
  });
  const reset = () => {
    setOffset(0);
    setSelected(null);
  };
  if (review.isPending) return <p role="status">Loading extension policy review…</p>;
  if (review.isError)
    return (
      <div role="alert">
        <p>{workbenchError(review.error)}</p>
        <BrutalButton size="sm" onClick={() => void review.refetch()}>
          Retry policy review
        </BrutalButton>
      </div>
    );
  const data = review.data;
  return (
    <section
      aria-label="Extension policy review"
      className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Extension review · {data.package_version}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manifest V{data.manifest_version} ·{" "}
            {data.stores.map((s) => (s === "chrome" ? "Chrome" : "Microsoft Edge")).join(" + ")} ·
            Policy pack {data.policy_version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BrutalButton
            size="sm"
            variant="secondary"
            onClick={() => setCompareOpen((value) => !value)}
          >
            Compare reviews
          </BrutalButton>
          <BrutalButton size="sm" variant="secondary" onClick={() => setRecheck((value) => !value)}>
            {recheck ? "Close recheck" : "Recheck package"}
          </BrutalButton>
        </div>
      </header>
      <p className="text-xs text-muted-foreground">
        Static review, not store approval. Use Export report above for saved security findings and
        policy results.
      </p>
      {data.status !== "completed" ? (
        <p role="status" className="rounded border border-border p-4">
          {data.status === "failed"
            ? "Review interrupted. Findings are not final; start a new review."
            : "Review in progress. Source may be readable before policy and security results finish saving."}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["violation", "needs_review", "not_assessed"] as const).map((value) => (
              <div key={value} className="rounded border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">{outcomeLabels[value]}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {data.coverage.outcomes?.[value] || 0}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {(data.coverage.outcomes?.passed || 0) + (data.coverage.outcomes?.violation || 0)} of{" "}
            {data.coverage.total || 0} check results have a decisive automated outcome. Manual
            checks remain visible; this is not an approval percentage.
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Review areas">
            {[
              "Findings",
              "Policy coverage",
              "Permissions & browser settings",
              "Listing & privacy",
            ].map((label) => (
              <button
                type="button"
                key={label}
                aria-pressed={tab === label}
                onClick={() => {
                  setTab(label);
                  reset();
                }}
                className={`${control} ${tab === label ? "bg-secondary font-semibold" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "Listing & privacy" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {!sourceAvailable ? (
                <p className="text-sm text-muted-foreground">
                  Supporting evidence is unavailable or outside the retained source window.
                </p>
              ) : images.isError ? (
                <p role="alert">{workbenchError(images.error)}</p>
              ) : (
                images.data?.items.map((image) => (
                  <PrivateScreenshot
                    key={image.id}
                    workspaceId={workspaceId}
                    scanId={scanId}
                    id={image.id}
                    store={image.store}
                  />
                ))
              )}
              {sourceAvailable && data.declarations ? (
                Object.entries(data.declarations).map(([key, value]) => (
                  <section className="min-w-0 rounded border border-border p-3" key={key}>
                    <h3 className="text-sm font-semibold capitalize">{key.replaceAll("_", " ")}</h3>
                    {typeof value === "string" ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                        {value || "Not supplied"}
                      </p>
                    ) : (
                      Object.entries(value).map(([label, text]) => (
                        <p key={label} className="mt-2 whitespace-pre-wrap break-words text-sm">
                          <strong>{label.replaceAll("_", " ")}: </strong>
                          {typeof text === "string" && text ? text : "Not supplied"}
                        </p>
                      ))
                    )}
                  </section>
                ))
              ) : (
                <p>
                  Supporting declarations have expired or are unavailable. Saved results remain;
                  upload a fresh package to recheck.
                </p>
              )}
            </div>
          ) : (
            <>
              {tab === "Permissions & browser settings" && (
                <p className="text-sm">
                  Select permission or browser-setting results below. We do not read or change your
                  browser’s actual settings.
                </p>
              )}
              {tab === "Policy coverage" && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {data.coverage.limitations?.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                  <li>
                    Security analysis input:{" "}
                    {data.coverage.security_analysis_files ?? "Not recorded"} files.{" "}
                    {data.coverage.analysis_exclusions?.length || 0} input limitations recorded.
                  </li>
                  {data.coverage.analysis_exclusions?.slice(0, 20).map((entry, index) => (
                    <li key={index} className="break-words">
                      {entry.path ? `${entry.path}: ` : ""}
                      {entry.reason}
                    </li>
                  ))}
                  {data.coverage.security_analysis_limitations?.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                <label className="text-xs">
                  Store
                  <select
                    aria-label="Filter policy store"
                    value={store}
                    onChange={(e) => {
                      setStore(e.target.value);
                      reset();
                    }}
                    className={`${control} ml-2`}
                  >
                    <option value="">Both stores</option>
                    <option value="chrome">Chrome</option>
                    <option value="edge">Microsoft Edge</option>
                  </select>
                </label>
                <label className="text-xs">
                  Outcome
                  <select
                    aria-label="Filter policy outcome"
                    value={outcome}
                    onChange={(e) => {
                      setOutcome(e.target.value);
                      reset();
                    }}
                    className={`${control} ml-2`}
                  >
                    <option value="">All outcomes</option>
                    {Object.entries(outcomeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <div className="min-w-0">
                  {page.isPending ? (
                    <p role="status">Loading policy checks…</p>
                  ) : page.isError ? (
                    <div role="alert">
                      <p>{workbenchError(page.error)}</p>
                      <BrutalButton size="sm" onClick={() => void page.refetch()}>
                        Retry checks
                      </BrutalButton>
                    </div>
                  ) : (
                    <>
                      <p className="mb-2 text-xs text-muted-foreground">
                        {page.data.total} matching results · {data.coverage.total} total checks
                      </p>
                      <ul className="max-h-[480px] space-y-2 overflow-y-auto">
                        {page.data.items.map((result) => (
                          <li key={result.id}>
                            <button
                              type="button"
                              aria-pressed={selected === result.id}
                              onClick={() => setSelected(result.id)}
                              className={`w-full rounded border p-3 text-left ${selected === result.id ? "border-accent bg-secondary" : "border-border bg-background hover:bg-secondary"}`}
                            >
                              <span className="block text-xs text-muted-foreground">
                                {result.store === "chrome" ? "Chrome" : "Edge"} ·{" "}
                                {outcomeLabels[result.outcome]} · {result.category}
                              </span>
                              <span className="mt-1 block text-sm font-medium">{result.title}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {!page.data.items.length && <p>No checks match these filters.</p>}
                      <div className="mt-3 flex items-center gap-3">
                        <BrutalButton
                          size="sm"
                          variant="secondary"
                          disabled={!offset}
                          onClick={() => {
                            setOffset(offset - 50);
                            setSelected(null);
                          }}
                        >
                          Previous
                        </BrutalButton>
                        <span className="text-xs">Page {offset / 50 + 1}</span>
                        <BrutalButton
                          size="sm"
                          variant="secondary"
                          disabled={offset + 50 >= page.data.total}
                          onClick={() => {
                            setOffset(offset + 50);
                            setSelected(null);
                          }}
                        >
                          Next
                        </BrutalButton>
                      </div>
                    </>
                  )}
                </div>
                {selected ? (
                  detail.isPending ? (
                    <p role="status">Loading policy evidence…</p>
                  ) : detail.isError ? (
                    <div role="alert">
                      <p>{workbenchError(detail.error)}</p>
                      <BrutalButton size="sm" onClick={() => void detail.refetch()}>
                        Retry evidence
                      </BrutalButton>
                    </div>
                  ) : (
                    <ResultDetails
                      key={`${user?.id}/${scanId}/${selected}`}
                      result={detail.data}
                      workspaceId={workspaceId}
                      scanId={scanId}
                      role={role}
                      sourceAvailable={sourceAvailable}
                      onOpenSource={onOpenSource}
                    />
                  )
                ) : (
                  <p className="rounded border border-dashed border-border p-5 text-sm text-muted-foreground">
                    Select a check to see the policy, evidence, remedy and notice example. Source
                    opens in the workbench below.
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
      {compareOpen && (
        <section className="space-y-3 rounded border border-border p-4">
          <h3 className="font-semibold">Compare with a previous review</h3>
          <p className="text-xs text-muted-foreground">
            Choose a completed review of this same extension. Outcomes never change triage
            automatically.
          </p>
          {history.isError ? (
            <p role="alert">{workbenchError(history.error)}</p>
          ) : (
            <select
              aria-label="Previous extension review"
              className={`${control} w-full`}
              value={baseline}
              onChange={(e) => {
                setBaseline(e.target.value);
                setCompareOffset(0);
              }}
            >
              <option value="">Select previous review</option>
              {history.data?.items
                .filter((item) => item.scan_id !== scanId)
                .map((item) => (
                  <option key={item.scan_id} value={item.scan_id}>
                    {item.package_name} · {item.package_version} · {item.scan_id.slice(0, 8)}
                  </option>
                ))}
            </select>
          )}
          <div className="flex gap-2">
            <BrutalButton
              size="sm"
              variant="secondary"
              disabled={!historyOffset}
              onClick={() => setHistoryOffset(historyOffset - 20)}
            >
              Newer reviews
            </BrutalButton>
            <BrutalButton
              size="sm"
              variant="secondary"
              disabled={!history.data || historyOffset + 20 >= history.data.total}
              onClick={() => setHistoryOffset(historyOffset + 20)}
            >
              Older reviews
            </BrutalButton>
          </div>
          {baseline &&
            (comparison.isPending ? (
              <p role="status">Comparing reviews…</p>
            ) : comparison.isError ? (
              <p role="alert">{workbenchError(comparison.error)}</p>
            ) : (
              <>
                <p className="text-xs">{comparison.data.limitation}</p>
                <ul className="space-y-2">
                  {comparison.data.items.map((item, index) => (
                    <li className="break-words text-sm" key={index}>
                      {item.category.replaceAll("_", " ")} — {item.title}
                      {item.path ? ` · ${item.path}` : ""}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <BrutalButton
                    size="sm"
                    variant="secondary"
                    disabled={!compareOffset}
                    onClick={() => setCompareOffset(compareOffset - 50)}
                  >
                    Previous comparison page
                  </BrutalButton>
                  <BrutalButton
                    size="sm"
                    variant="secondary"
                    disabled={compareOffset + 50 >= comparison.data.total}
                    onClick={() => setCompareOffset(compareOffset + 50)}
                  >
                    Next comparison page
                  </BrutalButton>
                </div>
              </>
            ))}
        </section>
      )}
      {recheck && (
        <Suspense fallback={<p role="status">Opening package upload…</p>}>
          <ExtensionUpload workspaceId={workspaceId} role={role} />
        </Suspense>
      )}
    </section>
  );
}
