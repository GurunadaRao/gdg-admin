import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/recruitment/notify — fire the confirmation-email webhook.
 * Verifies the caller's Firebase ID token, then only confirms an application
 * that belongs to that user and is still "submitted" (prevents spraying the
 * webhook with arbitrary application ids).
 */
export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email ?? "").toLowerCase();

    const body = await request.json();
    const roleId = String(body?.roleId ?? "").trim();
    const applicationId = String(body?.applicationId ?? "").trim();
    if (!roleId || !applicationId) {
      return NextResponse.json(
        { error: "roleId and applicationId are required" },
        { status: 400 },
      );
    }

    const appSnap = await adminDb
      .collection("recruitment_applications")
      .doc(applicationId)
      .get();
    if (!appSnap.exists) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    const app = appSnap.data()!;
    if (app.status !== "submitted" || app.userEmail !== email || app.roleId !== roleId) {
      return NextResponse.json({ error: "Invalid application" }, { status: 403 });
    }

    const roleSnap = await adminDb.collection("recruitment_roles").doc(roleId).get();
    const roleTitle = (roleSnap.data()?.title ?? "") as string;

    const settingsSnap = await adminDb
      .collection("recruitment_settings")
      .doc("global")
      .get();
    const settings = settingsSnap.data() ?? {};
    const scriptUrl = settings.emailScriptUrl as string | undefined;
    if (!scriptUrl) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const payload: Record<string, unknown> = {
      to: email,
      fullName: app.applicant?.fullName ?? "",
      roleTitle,
      applicationId,
      subject: `Application received — ${roleTitle}`,
      submittedAtIso: new Date().toISOString(),
    };
    if (
      settings.notifyOnApplication &&
      Array.isArray(settings.notificationEmails) &&
      settings.notificationEmails.length > 0
    ) {
      payload.ccEmails = settings.notificationEmails;
    }

    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });

    // Apps Script returns HTTP 200 even on failure — inspect the body.
    const result = await res.json().catch(() => null);
    if (result?.error) {
      return NextResponse.json({ error: String(result.error) }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to send notification";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}