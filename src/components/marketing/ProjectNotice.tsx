import { Link } from "@tanstack/react-router";
import { ArrowRight } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { privacySections, termsSections } from "@/components/settings/legalNotices";
import { MarketingFooter, MarketingHeader } from "./MarketingChrome";
import "./public-pages.css";

export function ProjectNotice({
  title,
  kind = "privacy",
  children,
}: {
  title: string;
  kind?: "privacy" | "terms";
  children: ReactNode;
}) {
  const sections = kind === "privacy" ? privacySections : termsSections;
  const [active, setActive] = useState(sections[0].id);
  const body = useRef<HTMLDivElement>(null);
  const contents = (
    <nav aria-label={`${kind === "privacy" ? "Privacy" : "Usage notes"} contents`}>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={active === section.id ? "location" : undefined}
          onClick={() => setActive(section.id)}
        >
          {section.title}
        </a>
      ))}
    </nav>
  );
  useEffect(() => {
    const initial = window.location.hash.slice(1);
    if (sections.some((section) => section.id === initial)) setActive(initial);
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-18% 0px -55% 0px" },
    );
    body.current
      ?.querySelectorAll("[data-notice-section]")
      .forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [sections]);
  return (
    <div className="public-page" data-public-page={kind}>
      <MarketingHeader current={kind} />
      <main>
        <section className="public-container legal-hero" aria-labelledby="notice-title">
          <div>
            <p className="public-eyebrow">{kind === "privacy" ? "Privacy" : "Usage notes"}</p>
            <h1 id="notice-title">
              {title === "Your data, explained." ? (
                <>
                  Your data,<span>explained.</span>
                </>
              ) : title === "For responsible code review." ? (
                <>
                  For responsible<span>code review.</span>
                </>
              ) : (
                title
              )}
            </h1>
            <p className="public-intro">
              {kind === "privacy"
                ? "What Archon processes, where it goes, and what you can control."
                : "Understand the limits, review the evidence, and stay in control of your changes."}
            </p>
            <p className="legal-notice-label">
              Research prototype ·{" "}
              {kind === "privacy" ? "product notice" : "not production service terms"}
            </p>
          </div>
          <img
            src={`/assets/marketing/archon-${kind}-hero-v1.webp`}
            alt={
              kind === "privacy"
                ? "A folder, private storage cabinet and laptop connected by an orange route"
                : "An open reference book and documents on a charcoal desk tray"
            }
            width={1536}
            height={1024}
            fetchPriority="high"
            decoding="async"
          />
        </section>
        {kind === "terms" && (
          <div className="legal-horizontal-contents">
            <div className="public-container">{contents}</div>
          </div>
        )}
        <div className="legal-reading-band">
          <div className="public-container legal-reading-layout">
            <aside className="legal-contents">
              {kind === "privacy" && (
                <>
                  <p className="public-eyebrow">On this page</p>
                  {contents}
                </>
              )}
              {kind === "terms" && (
                <div className="legal-review-note">
                  <strong>Human review remains essential.</strong>
                  <p>A suggestion is a starting point—not a verified fix.</p>
                </div>
              )}
            </aside>
            <div className="legal-body" ref={body}>
              {children}
              <div className="legal-related-links">
                {kind === "privacy" ? (
                  <Link
                    to="/login"
                    search={{ next: "/settings?section=privacy" }}
                    className="public-text-link"
                  >
                    Manage privacy & data <ArrowRight size={18} />
                  </Link>
                ) : (
                  <Link to="/privacy" className="public-text-link">
                    Read the data-handling notice <ArrowRight size={18} />
                  </Link>
                )}
                <Link to="/login" search={{ mode: "signup" }} className="public-text-link">
                  Back to account creation <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter current={kind} />
    </div>
  );
}
