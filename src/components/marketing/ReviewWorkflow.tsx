import "./public-pages.css";

const stages = [
  {
    title: "Project ZIP / authorized GitHub",
    detail: "Choose a source you have permission to review.",
  },
  { title: "FastAPI intake", detail: "Validate the request and prepare supported source files." },
  {
    title: "Static checks + model review",
    detail: "Analyze available evidence and normalize findings.",
  },
  {
    title: "Saved workspace evidence",
    detail: "Retain authorized results and private source previews.",
  },
  { title: "Workbench + Reports", detail: "Inspect evidence, review remedies and export results." },
] as const;

export function ReviewWorkflow() {
  return (
    <section
      className="review-workflow"
      aria-labelledby="review-workflow-title"
      id="review-workflow"
    >
      <p className="public-eyebrow">How Archon works</p>
      <h2 id="review-workflow-title" className="public-section-title">
        From source code to a clearer next step.
      </h2>
      <p className="public-intro">
        Upload a project, inspect the recorded evidence, and review what to fix next.
      </p>
      <img
        src="/assets/marketing/archon-review-workflow-v1.webp"
        alt=""
        width={1536}
        height={512}
        className="review-workflow-art"
        loading="lazy"
        decoding="async"
      />
      <ol className="review-workflow-stages">
        {stages.map((stage, index) => (
          <li key={stage.title}>
            <span className="text-xs font-mono text-accent" aria-hidden="true">
              0{index + 1}
            </span>
            <h3>{stage.title}</h3>
            <p>{stage.detail}</p>
          </li>
        ))}
      </ol>
      <p className="review-workflow-note">
        React interface · Supabase Auth, Postgres and private Storage. Optional providers,
        repository access and worker services depend on deployment configuration.
      </p>
      <p className="review-workflow-disclosure">
        Findings, framework mappings and suggested fixes require human review and testing. A report
        is not proof of compliance.
      </p>
    </section>
  );
}
