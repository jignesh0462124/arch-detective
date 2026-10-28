import { accountStorage } from "./authState";

export type AuditResume = { id: string; name: string; created: string };
const key = (workspace: string) => `archon-workbench-job:${workspace}`;
export function readAuditResume(workspace: string): AuditResume | null {
  try {
    const item = JSON.parse(accountStorage.getItem(key(workspace)) || "null");
    return item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.created === "string"
      ? item
      : null;
  } catch {
    return null;
  }
}
export function rememberAudit(workspace: string, scan: AuditResume) {
  try {
    accountStorage.setItem(key(workspace), JSON.stringify(scan));
  } catch {
    /* Server evidence remains authoritative. */
  }
}
export function forgetAudit(workspace: string) {
  try {
    accountStorage.removeItem(key(workspace));
  } catch {
    /* Optional navigation reference. */
  }
}
