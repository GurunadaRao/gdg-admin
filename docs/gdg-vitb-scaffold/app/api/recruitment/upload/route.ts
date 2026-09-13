import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { RecruitmentRoleField } from "@/lib/recruitment/types";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * POST /api/recruitment/upload — server-side upload proxy.
 * Resolves the Drive folder from the role definition (never trusting the
 * client), reads driveUploadScriptUrl from settings, and forwards the file to
 * the Apps Script web app which stores it in Google Drive.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const roleId = String(formData.get("roleId") ?? "").trim();
    const fieldName = String(formData.get("fieldName") ?? "").trim();

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!roleId || !fieldName) {
      return NextResponse.json(
        { error: "roleId and fieldName are required" },
        { status: 400 },
      );
    }

    const roleDoc = await adminDb.collection("recruitment_roles").doc(roleId).get();
    if (!roleDoc.exists) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    const fields = (roleDoc.data()?.fields ?? []) as RecruitmentRoleField[];
    const field = fields.find((f) => f.name === fieldName);
    const folderId = field?.driveFolderId?.trim() ?? "";
    if (field?.type !== "file" || !folderId) {
      return NextResponse.json(
        { error: `No Drive folder configured for field "${fieldName}"` },
        { status: 400 },
      );
    }

    const settingsSnap = await adminDb
      .collection("recruitment_settings")
      .doc("global")
      .get();
    const scriptUrl = settingsSnap.data()?.driveUploadScriptUrl as string | undefined;
    if (!scriptUrl) {
      return NextResponse.json(
        { error: "Drive upload script is not configured" },
        { status: 500 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 50 MB limit" },
        { status: 413 },
      );
    }

    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        base64: bytes.toString("base64"),
        folderId,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    // Apps Script web apps return HTTP 200 even on failure — inspect the body.
    const result = await res.json().catch(() => null);
    if (result?.error) throw new Error(String(result.error));
    const fileUrl = typeof result?.fileUrl === "string" ? result.fileUrl : "";
    const fileId = typeof result?.fileId === "string" ? result.fileId : "";
    if (!fileUrl || !fileId) {
      throw new Error(`Drive script returned an invalid response (${JSON.stringify(result)})`);
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      driveFileId: fileId,
      originalName: result?.fileName ?? file.name,
      mimeType: file.type,
      sizeBytes: bytes.byteLength,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}