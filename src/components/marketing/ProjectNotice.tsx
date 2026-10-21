import { Link } from "@tanstack/react-router";
import { ArchonWordmark } from "@/components/ui/ArchonWordmark";
import type { ReactNode } from "react";

export function ProjectNotice({ title, children }: { title: string; children: ReactNode }) {
  return <main className="min-h-screen bg-background px-6 py-10 text-foreground">
    <div className="mx-auto max-w-2xl">
      <Link to="/" aria-label="Archon home"><ArchonWordmark size="sm" /></Link>
      <p className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Research prototype · product notice</p>
      <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
      <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">{children}</div>
      <Link to="/login" search={{ mode: "signup" }} className="mt-10 inline-block text-sm underline">Back to account creation</Link>
    </div>
  </main>;
}
