let owner: string | null = null;
let epoch = 0;
let requests = new AbortController();
export function setAuthOwner(next: string | null) {
  if (owner !== next) {
    requests.abort();
    requests = new AbortController();
    owner = next;
    epoch++;
  }
}
export function authRequestSignal() {
  return requests.signal;
}
export function authScope() {
  return { owner, epoch };
}
export function isCurrentScope(scope: ReturnType<typeof authScope>) {
  return scope.owner === owner && scope.epoch === epoch;
}
// Account isolation, not encryption. Never adopt unowned legacy keys.
export function privateStorage(scope = authScope()): Storage {
  const prefix = scope.owner ? `archon:account:${scope.owner}:` : null;
  const available = () => typeof window !== "undefined" && !!prefix;
  const keys = () => {
    if (!available()) return [];
    const storage = window.localStorage;
    return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
      (k): k is string => !!k && k.startsWith(prefix!),
    );
  };
  return {
    get length() {
      return keys().length;
    },
    key: (i) => keys()[i]?.slice(prefix!.length) ?? null,
    getItem: (key) => (available() ? window.localStorage.getItem(prefix + key) : null),
    setItem: (key, value) => {
      if (available() && isCurrentScope(scope)) window.localStorage.setItem(prefix + key, value);
    },
    removeItem: (key) => {
      if (available() && isCurrentScope(scope)) window.localStorage.removeItem(prefix + key);
    },
    clear: () => {},
  };
}
export const accountStorage: Storage = {
  get length() {
    return privateStorage().length;
  },
  key: (i) => privateStorage().key(i),
  getItem: (key) => privateStorage().getItem(key),
  setItem: (key, value) => privateStorage().setItem(key, value),
  removeItem: (key) => privateStorage().removeItem(key),
  clear: () => {},
};
export function hasUnownedHistory() {
  try {
    return (
      typeof window !== "undefined" &&
      Object.keys(window.localStorage).some((k) =>
        /^(threatlens_codebase_audit|threatlens_reports_registry|threatlens_attack_graphs)/.test(k),
      )
    );
  } catch {
    return false;
  }
}
export function safeAuthDestination(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    /[\\\s]/.test(value) ||
    Array.from(value).some((c) => c.charCodeAt(0) < 32) ||
    value.startsWith("//")
  )
    return "/dashboard";
  try {
    const url = new URL(value, "https://archon.invalid");
    const path = decodeURIComponent(url.pathname);
    if (
      url.origin !== "https://archon.invalid" ||
      /[\\\s]/.test(path) ||
      Array.from(path).some((c) => c.charCodeAt(0) < 32) ||
      path.split("/").some((part) => part === "." || part === "..")
    )
      return "/dashboard";
    return /^\/(dashboard|code-audit|attack-graph|findings|fix-verification|reports|profile|compliance|settings|workspace)(\/|$)/.test(
      path,
    )
      ? url.pathname + url.search + url.hash
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
export function authErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "invalid_credentials")
    return "Email or password is incorrect. Check both and try again.";
  if (code === "email_not_confirmed")
    return "Verify your email before signing in. You can request another confirmation below.";
  if (code.includes("rate_limit")) return "Too many requests. Wait a moment before trying again.";
  if (code === "weak_password")
    return "Choose a stronger password. Use at least 8 characters and avoid common passwords.";
  if (code === "same_password") return "Choose a password different from your current password.";
  if (code === "otp_expired" || code === "session_not_found")
    return "This link or session is no longer valid. Request a new link or sign in again.";
  return "We couldn’t complete that request. Check your connection and try again.";
}
export function clearAuthCallbackUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!["/login", "/reset-password"].includes(url.pathname)) return;
  const callbackFields = [
    "code",
    "error",
    "error_code",
    "error_description",
    "access_token",
    "refresh_token",
    "token_type",
    "expires_in",
    "expires_at",
    "provider_token",
    "provider_refresh_token",
    "type",
  ];
  const hash = new URLSearchParams(url.hash.slice(1));
  let changed = false;
  for (const field of callbackFields) {
    if (url.searchParams.has(field) || hash.has(field)) changed = true;
    url.searchParams.delete(field);
    hash.delete(field);
  }
  if (changed) {
    url.hash = hash.toString();
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
}
