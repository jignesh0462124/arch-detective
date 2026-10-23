import { Link } from "@tanstack/react-router";
import { ArrowRight, List } from "@phosphor-icons/react";

import { ThemeToggle } from "@/components/brutal/ThemeToggle";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";

type MarketingPage = "home" | "about";

const productLinks = [
  { href: "/#product", label: "Product" },
  { href: "/#pipeline", label: "Workflow" },
  { href: "/#frameworks", label: "Frameworks" },
];

export function MarketingBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink" aria-hidden>
      <img
        src="/assets/archon-infrastructure-backdrop.webp"
        alt=""
        className="h-full w-full object-cover object-[18%_center] opacity-45 sm:object-center dark:opacity-55"
        width={1672}
        height={941}
      />
    </div>
  );
}

export function MarketingHeader({ current }: { current: MarketingPage }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-18 w-full max-w-[1280px] items-center justify-between gap-2 px-5 sm:gap-3 sm:px-8 lg:px-10">
        <Link to="/" aria-label="Archon home" className="flex min-h-10 min-w-0 items-center">
          <ArchonWordmark
            size="sm"
            hideTagline={current === "home"}
            taglineClassName="hidden sm:block"
            className="[&>img]:w-[128px] sm:[&>img]:w-[168px]"
          />
        </Link>

        <nav
          className="hidden h-16 items-center text-[13px] font-medium lg:flex"
          aria-label="Marketing"
        >
          {productLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex h-16 items-center border-b-2 border-transparent px-3 text-foreground/70 transition-colors hover:border-accent hover:bg-secondary/50 hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none lg:px-4"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/about"
            aria-current={current === "about" ? "page" : undefined}
            className="flex h-16 items-center border-b-2 border-transparent px-3 text-foreground/70 transition-colors hover:border-accent hover:bg-secondary/50 hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none aria-[current=page]:border-accent aria-[current=page]:text-foreground lg:px-4"
          >
            About
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative lg:hidden">
            <details
              className="group"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary
                role="button"
                aria-label="Open navigation"
                className="inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
              >
                <List size={18} weight="bold" />
              </summary>
              <nav
                aria-label="Mobile marketing"
                className="absolute right-0 top-12 z-50 w-52 rounded-sm border border-border bg-card p-1.5 text-card-foreground"
              >
                {productLinks.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(event) =>
                      event.currentTarget.closest("details")?.removeAttribute("open")
                    }
                    className="flex min-h-10 items-center rounded-sm px-3 text-sm transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                  >
                    {item.label}
                  </a>
                ))}
                <Link
                  to="/about"
                  onClick={(event) =>
                    event.currentTarget.closest("details")?.removeAttribute("open")
                  }
                  className="flex min-h-10 items-center rounded-sm px-3 text-sm transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                >
                  About
                </Link>
              </nav>
            </details>
          </div>
          <Link
            to="/login"
            className="hidden min-h-11 items-center px-2 text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:inline-flex"
          >
            Sign in
          </Link>
          <ThemeToggle className="size-10 sm:size-11" />
          <Link
            to="/login"
            aria-label="Launch console"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-11 sm:px-4"
          >
            <span className="hidden sm:inline">Launch console</span>
            <ArrowRight size={13} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col justify-between gap-3 px-5 py-6 text-xs sm:flex-row sm:items-center sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to="/"
              aria-label="Archon home"
              className="inline-flex min-h-11 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArchonWordmark size="sm" hideTagline />
            </Link>
            <span className="text-muted-foreground sm:border-l sm:border-border sm:pl-5">
              Security audits &amp; threat modeling
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <Link
              to="/about"
              className="inline-flex min-h-11 items-center hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              About
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
            <span>© 2026 Archon</span>
          </div>
        </div>
      </footer>
    );
  }
  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-3 px-4 py-4 text-xs sm:min-h-16 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-0">
        <Link
          to="/"
          aria-label="Archon home"
          className="flex min-h-10 items-center gap-2.5 font-medium"
        >
          <ArchonWordmark size="sm" hideTagline />
          <span aria-hidden="true" className="text-muted-foreground">
            / 2026
          </span>
        </Link>
        <div className="flex flex-wrap items-center text-muted-foreground">
          <Link
            to="/about"
            className="flex min-h-10 items-center border-b-2 border-transparent px-2 transition-colors hover:border-accent hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none"
          >
            About
          </Link>
          {["Security", "Docs", "Changelog", "Contact"].map((label) => (
            <a
              key={label}
              href="#"
              className="flex min-h-10 items-center border-b-2 border-transparent px-2 transition-colors hover:border-accent hover:text-foreground focus-visible:border-accent focus-visible:text-foreground focus-visible:outline-none"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
