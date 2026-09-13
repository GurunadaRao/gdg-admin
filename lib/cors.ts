/**
 * CORS helpers for public recruitment endpoints the separately-hosted
 * gdgvitb public site calls cross-origin (file upload + application submit).
 *
 * Configure allowed origins with PUBLIC_SITE_ORIGIN (comma-separated). When it
 * is unset the endpoints are wide open (they are public anyway).
 */
const ALLOWED_ORIGINS = (process.env.PUBLIC_SITE_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function publicCorsHeaders(
  origin: string | null,
): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.length > 0) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      };
    }
    return {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
  }
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}