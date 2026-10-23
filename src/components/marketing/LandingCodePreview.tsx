import { CaretDown, CaretRight, FileCode, Folder } from "@phosphor-icons/react";

// A static, intentionally vulnerable example. Never executes or loads private audit data.
const EXAMPLE_LINES = [
  { number: 46, text: "const params = new URLSearchParams(location.search);" },
  { number: 47, text: "" },
  { number: 48, text: 'const target = params.get("next") ?? "/";' },
  { number: 49, text: "window.location.assign(target);", highlighted: true },
  { number: 50, text: "" },
  { number: 51, text: "// Validate the destination before redirecting." },
  { number: 52, text: "// Allow only trusted internal paths." },
];

export function LandingCodePreview() {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-card">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 text-sm sm:px-5">
        <span className="font-medium">Codebase audit</span>
        <span className="text-xs text-muted-foreground">Illustrative example</span>
      </figcaption>
      <div className="grid min-w-0 md:grid-cols-[160px_minmax(0,1fr)] lg:grid-cols-[180px_minmax(0,1fr)_240px]">
        <div
          className="hidden border-r border-border py-4 text-xs text-muted-foreground md:block"
          aria-label="Example project files"
        >
          <div className="flex items-center gap-2 px-4 py-2">
            <CaretDown aria-hidden="true" />
            <Folder size={16} aria-hidden="true" />
            project
          </div>
          <div className="flex items-center gap-2 py-2 pl-6">
            <CaretDown aria-hidden="true" />
            <Folder size={16} aria-hidden="true" />
            src
          </div>
          <div className="flex items-center gap-2 py-2 pl-9">
            <CaretDown aria-hidden="true" />
            <Folder size={16} aria-hidden="true" />
            auth
          </div>
          <ul>
            {["login.ts", "session.ts", "user.ts"].map((file, index) => (
              <li
                key={file}
                className={`flex items-center gap-2 py-2 pl-12 ${index === 0 ? "bg-accent/10 font-medium text-accent" : ""}`}
              >
                <FileCode size={15} aria-hidden="true" />
                {file}
              </li>
            ))}
          </ul>
          {["components", "lib", "tests"].map((folder) => (
            <div key={folder} className="flex items-center gap-2 py-2 pl-6">
              <CaretRight aria-hidden="true" />
              <Folder size={16} aria-hidden="true" />
              {folder}
            </div>
          ))}
        </div>
        <div className="min-w-0 bg-[#171717] text-[#e5e5e5]">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 font-mono text-xs">
            <span className="text-[#8dc9ed]" aria-hidden="true">
              TS
            </span>
            <span>login.ts</span>
            <span className="ml-auto text-[10px] text-[#b3b3b3]">Example source</span>
          </div>
          <div
            role="region"
            aria-label="Example source code; line 49 contains an unvalidated redirect. Scroll horizontally to read long lines."
            tabIndex={0}
            className="overflow-x-auto py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f09b68]"
          >
            <pre className="w-max min-w-full font-mono text-[11px] leading-7 sm:text-xs">
              <code>
                {EXAMPLE_LINES.map((line) => (
                  <span
                    key={line.number}
                    className={`block pr-5 ${line.highlighted ? "border-l-2 border-[#e8a64b] bg-[#e8a64b]/15 text-[#f5d49d]" : "border-l-2 border-transparent"}`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block w-12 select-none pl-4 text-[#aaa69f]"
                    >
                      {line.number}
                    </span>
                    <span className={line.text.startsWith("//") ? "text-[#b3b3b3]" : undefined}>
                      {line.text || " "}
                    </span>
                    {"\n"}
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </div>
        <div className="border-t border-border p-5 md:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0">
          <p className="text-xs font-medium text-severity-high">High · Open</p>
          <h3 className="mt-4 text-sm font-medium">Unvalidated redirect</h3>
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
            src/auth/login.ts:49
          </p>
          <div className="mt-6 border-t border-border pt-5">
            <h4 className="text-sm font-medium">Remediation</h4>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Allow only trusted internal destinations.
            </p>
          </div>
          <details className="group mt-5 text-xs">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Review finding{" "}
              <CaretDown
                size={14}
                className="transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              The next parameter controls the destination. An external URL could send a visitor to
              another site. Use an allowlist of internal routes, then test that external and
              protocol-relative URLs are rejected. This example is not a saved scan result.
            </p>
          </details>
        </div>
      </div>
    </figure>
  );
}
