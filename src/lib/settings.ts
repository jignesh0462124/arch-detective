export const settingsSections = [
  { id: "overview", label: "Overview" },
  { id: "account", label: "Account & security" },
  { id: "appearance", label: "Appearance" },
  { id: "workspace", label: "Workspace" },
  { id: "integrations", label: "Integrations" },
  { id: "privacy", label: "Privacy & data" },
  { id: "pricing", label: "Plan & pricing" },
  { id: "help", label: "Help & about" },
] as const;
export type SettingsSection = (typeof settingsSections)[number]["id"];
export function settingsSection(value: unknown): SettingsSection {
  return settingsSections.some((section) => section.id === value)
    ? (value as SettingsSection)
    : "overview";
}
export function validateDisplayName(value: string): string | null {
  const length = value.trim().length;
  return length < 1 || length > 120 ? "Enter a name between 1 and 120 characters." : null;
}
