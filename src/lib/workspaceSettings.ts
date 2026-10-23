import type { WorkspaceRole, WorkspaceSettings } from "./api/workspaces";

export const AUDIT_FRAMEWORKS = [
  { id: "gdpr", label: "GDPR" },
  { id: "soc2", label: "SOC 2" },
  { id: "iso27001", label: "ISO 27001" },
  { id: "pci_dss", label: "PCI DSS" },
  { id: "nist_csf", label: "NIST CSF" },
];
const aliases = new Map(
  AUDIT_FRAMEWORKS.flatMap(({ id, label }) => [
    [id.replace(/[^a-z0-9]/g, ""), id],
    [label.toLowerCase().replace(/[^a-z0-9]/g, ""), id],
  ]),
);
export const DEFAULT_AUDIT_FRAMEWORKS = ["gdpr", "soc2", "iso27001"];
export function normalizeAuditFrameworks(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values.flatMap((value) => {
        const id =
          typeof value === "string"
            ? aliases.get(value.toLowerCase().replace(/[^a-z0-9]/g, ""))
            : undefined;
        return id ? [id] : [];
      }),
    ),
  ];
}
export function auditDefaults(settings?: WorkspaceSettings): string[] {
  const supported = normalizeAuditFrameworks(settings?.default_frameworks);
  return supported.length ? supported : [...DEFAULT_AUDIT_FRAMEWORKS];
}
export function mergeAuditDefaults(
  settings: WorkspaceSettings | undefined,
  ids: string[],
): WorkspaceSettings {
  const selected = normalizeAuditFrameworks(ids);
  if (!selected.length) throw new Error("Select at least one supported framework.");
  return { retention_days: 90, ...settings, default_frameworks: selected };
}
export function canManageWorkspace(role?: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}
export function canManageMember(
  role: WorkspaceRole | undefined,
  ownerId: string,
  actorId: string,
  member: { user_id: string; role: string },
): boolean {
  return (
    canManageWorkspace(role) &&
    member.user_id !== ownerId &&
    member.role !== "owner" &&
    member.user_id !== actorId
  );
}
export function validateWorkspaceDetails(name: string, slug: string): string | null {
  if (!name.trim() || name.trim().length > 120)
    return "Enter a workspace name between 1 and 120 characters.";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/.test(slug.trim().toLowerCase()))
    return "Use a 2–63 character URL slug with lowercase letters, numbers and internal hyphens.";
  return null;
}
export function validInviteEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
