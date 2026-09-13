/**
 * Firebase Auth session cookie utilities.
 * Uses Firebase Admin SDK to create and verify session cookies,
 * replacing the previous jose-based JWT approach.
 */
import { adminAuth } from "@/lib/firebase";

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

const COOKIE_NAME = "gdg_session";
const SESSION_EXPIRY_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

/**
 * Create a Firebase session cookie from a client-side ID token.
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY_MS,
  });
}

/**
 * Verify a session cookie and return decoded claims, or null if invalid.
 */
export async function verifySessionCookie(
  sessionCookie: string,
): Promise<AuthUser | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    console.log("verifySessionCookie success. decoded:", decoded);
    return {
      uid: decoded.uid,
      email: decoded.email || "",
      name: decoded.name || "",
      isAdmin: decoded.admin === true,
    };
  } catch (error) {
    console.error("verifySessionCookie failed:", error);
    return null;
  }
}

/**
 * Resolve the session cookie from a request and verify it as an admin.
 * Used by API routes that are NOT covered by proxy.ts (e.g. /api/recruitment/*)
 * but must only be reachable by admins. Returns null when unauthenticated.
 */
export async function requireAdmin(
  request: Request,
): Promise<AuthUser | null> {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  const user = await verifySessionCookie(token);
  return user?.isAdmin ? user : null;
}

export function getSessionCookieConfig(sessionCookie: string) {
  return {
    name: COOKIE_NAME,
    value: sessionCookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_EXPIRY_MS / 1000, // in seconds
  };
}

export function getLogoutCookieConfig() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export { COOKIE_NAME };
