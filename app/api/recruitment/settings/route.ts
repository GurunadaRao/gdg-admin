import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, SETTINGS_DOC_ID, normaliseSettings } from "@/lib/recruitment";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SETTINGS_REF = () => db.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID);

/**
 * GET /api/recruitment/settings — Singleton recruitment settings with defaults.
 */
export async function GET() {
  try {
    const doc = await SETTINGS_REF().get();
    return NextResponse.json(
      normaliseSettings(doc.exists ? doc.data() : undefined),
    );
  } catch (error) {
    console.error("Failed to fetch recruitment settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recruitment settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/recruitment/settings — Update singleton settings (admin only).
 */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const toArray = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.map(String).filter(Boolean)
        : typeof v === "string"
          ? v.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

    const data: Record<string, unknown> = {
      isRecruitmentActive: body.isRecruitmentActive ?? false,
      globalMessage: body.globalMessage ?? "",
      allowedEmailDomain: body.allowedEmailDomain ?? "@vishnu.edu.in",
      maxResumeSizeMB:
        typeof body.maxResumeSizeMB === "number" ? body.maxResumeSizeMB : 5,
      maxTaskFileSizeMB:
        typeof body.maxTaskFileSizeMB === "number" ? body.maxTaskFileSizeMB : 10,
      allowedResumeTypes: toArray(body.allowedResumeTypes),
      allowedTaskTypes: toArray(body.allowedTaskTypes),
      notifyOnApplication: body.notifyOnApplication ?? false,
      notificationEmails: toArray(body.notificationEmails),
      driveUploadScriptUrl: body.driveUploadScriptUrl ?? null,
      emailScriptUrl: body.emailScriptUrl ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await SETTINGS_REF().set(data, { merge: true });

    const updated = await SETTINGS_REF().get();
    return NextResponse.json(normaliseSettings(updated.data()));
  } catch (error) {
    console.error("Failed to update recruitment settings:", error);
    return NextResponse.json(
      { error: "Failed to update recruitment settings" },
      { status: 500 },
    );
  }
}