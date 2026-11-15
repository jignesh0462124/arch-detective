/** Only controlled interface messages may be displayed as Advisor errors. */
const messages = new Set([
  "The suggestion is incomplete. Regenerate before using the code.",
  "Security Advisor is unavailable. Retry its availability check.",
  "The response could not be saved. Copy any visible suggestion before retrying.",
  "This conversation expired, was deleted, or is no longer accessible.",
  "This conversation belongs to another workspace.",
  "Older messages could not load. Please retry.",
  "Source preview expired or unavailable. Rescan for a code solution.",
  "Source location is unverified. Review the evidence before requesting code.",
  "Sign in to use the Security Advisor.",
  "You are signed in, but the server could not verify this request. Retry shortly.",
  "Your session has ended. Sign in again.",
  "Could not check your session. Check your connection and retry.",
  "Advisor availability could not be checked. Retry shortly.",
  "This saved finding is no longer available to your workspace. Choose another finding.",
  "Security Advisor is temporarily unavailable. Retry shortly.",
  "Advisor request failed. Please try again.",
  "Advisor stream was interrupted. Please retry.",
  "Could not reach Security Advisor. Check the backend and retry.",
  "Security Advisor is unavailable right now. Retry its availability check.",
]);

export function advisorErrorMessage(error: unknown): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return messages.has(message)
    ? message
    : "Could not prepare a response. Check your connection and try again.";
}
