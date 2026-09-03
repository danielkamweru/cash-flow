/**
 * Translates raw API/network errors into user-friendly messages.
 * Never exposes stack traces, SQL errors, or HTTP status codes.
 */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  // PIN / auth errors
  if (lower.includes("incorrect password") || lower.includes("invalid password"))
    return "Incorrect password. Please try again.";
  if (lower.includes("pin") && (lower.includes("incorrect") || lower.includes("invalid") || lower.includes("wrong")))
    return "Incorrect transaction PIN. Please check your PIN and try again.";
  if (lower.includes("unauthorized") || lower.includes("401"))
    return "Your session has expired. Please sign in again.";

  // Duplicate / conflict
  if (lower.includes("already exists") || lower.includes("409") || lower.includes("duplicate"))
    return "This record already exists.";

  // Insufficient funds
  if (lower.includes("insufficient") || lower.includes("balance"))
    return "Insufficient balance to complete this transaction.";

  // Network / gateway
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch"))
    return "Network error. Please check your connection and try again.";
  if (lower.includes("timeout"))
    return "The request timed out. Please try again.";
  if (lower.includes("gateway") || lower.includes("loop") || lower.includes("502") || lower.includes("503"))
    return "The payment gateway is temporarily unavailable. Please try again shortly.";

  // Validation from backend
  if (lower.includes("required"))
    return "Please fill in all required fields.";
  if (lower.includes("not found") || lower.includes("404"))
    return "The requested record was not found.";

  // If the raw message is already short and human-readable, use it
  if (raw.length > 0 && raw.length < 120 && !raw.includes("{") && !raw.includes("Error:"))
    return raw;

  return fallback;
}
