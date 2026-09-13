import type { RecruitmentSettings } from "./types/recruitment";

const SCRIPT_TIMEOUT_MS = 45_000;

/**
 * POST a JSON payload to an Apps Script web app and return its parsed
 * JSON response. Throws on HTTP/transport/parse errors.
 */
export async function postToScript(
  url: string,
  payload: unknown,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Script responded with HTTP ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface ApplicationEmailPayload {
  to: string;
  fullName: string;
  roleTitle: string;
  applicationId: string;
  submittedAtIso?: string;
}

/**
 * Fire-and-forget notification of a successful application via the configured
 * Apps Script email webhook. Never throws — the caller awaits only when it
 * wants to surface failures (e.g. the Test button).
 */
export async function notifyApplicationReceived(
  settings: RecruitmentSettings,
  payload: ApplicationEmailPayload,
): Promise<void> {
  const url = settings.emailScriptUrl;
  if (!url) return;

  const body: Record<string, unknown> = {
    ...payload,
    subject: `Application received — ${payload.roleTitle}`,
  };
  if (
    settings.notifyOnApplication &&
    settings.notificationEmails.length > 0
  ) {
    body.ccEmails = settings.notificationEmails;
  }

  const result = await postToScript(url, body);
  if (result && result.error) {
    throw new Error(String(result.error));
  }
}