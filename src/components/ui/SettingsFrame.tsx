import type { ReactNode } from "react";

/** Allows existing settings sections to share one application shell. */
export function SettingsFrame({
  children,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return <div className="min-w-0">{children}</div>;
}
