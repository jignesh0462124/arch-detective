export const profileAvatars = [
  { id: "sentinel", name: "Sentinel" },
  { id: "scout", name: "Scout" },
  { id: "relay", name: "Relay" },
  { id: "rover", name: "Rover" },
  { id: "keeper", name: "Keeper" },
].map((item) => ({ ...item, src: `/profile-art/avatar-${item.id}.jpg` }));

export const profileCovers = [
  { id: "contour", name: "Contour" },
  { id: "workshop", name: "Workshop" },
  { id: "relay", name: "Relay" },
  { id: "paper", name: "Paper" },
  { id: "foundry", name: "Foundry" },
].map((item) => ({ ...item, src: `/profile-art/cover-${item.id}.jpg` }));

export type AppearanceKind = "avatar" | "cover";
export const appearanceKey = (kind: AppearanceKind) => `archon_${kind}_preset`;

export function validAppearance(kind: AppearanceKind, value: unknown): value is string {
  return (
    (kind === "avatar" || kind === "cover") &&
    typeof value === "string" &&
    (value === "original" ||
      (kind === "avatar" && value === "initials") ||
      (kind === "avatar" ? profileAvatars : profileCovers).some((item) => item.id === value))
  );
}

export function accountPhoto(metadata?: Record<string, unknown> | null): string | null {
  if (typeof metadata?.avatar_url !== "string") return null;
  try {
    const url = new URL(metadata.avatar_url);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function profileAvatar(metadata?: Record<string, unknown> | null): string | null {
  const id = metadata?.[appearanceKey("avatar")];
  if (id === "initials") return null;
  return profileAvatars.find((item) => item.id === id)?.src || accountPhoto(metadata);
}

export function profileCover(metadata?: Record<string, unknown> | null, legacy = 1): string {
  return (
    profileCovers.find((item) => item.id === metadata?.[appearanceKey("cover")])?.src ||
    `/covers/cover-${Number.isInteger(legacy) && legacy >= 1 && legacy <= 5 ? legacy : 1}.jpg`
  );
}

export function profileInitials(metadata?: Record<string, unknown> | null, email?: string | null) {
  const value = metadata?.full_name || metadata?.display_name;
  const parts = typeof value === "string" ? value.trim().split(/\s+/).filter(Boolean) : [];
  return (
    parts.length > 1
      ? parts[0][0] + parts.at(-1)![0]
      : parts[0]?.slice(0, 2) || email?.slice(0, 2) || "?"
  ).toUpperCase();
}
