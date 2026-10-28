import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { settingsSection } from "@/lib/settings";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings · Archon" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    section: settingsSection(search.section),
  }),
  component: SettingsRoute,
});
function SettingsRoute() {
  const { section } = Route.useSearch();
  return <SettingsPage section={section} />;
}
