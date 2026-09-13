import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, SETTINGS_DOC_ID, normaliseSettings } from "@/lib/recruitment";
import { db } from "@/lib/firebase";
import { postToScript } from "@/lib/recruitment-webhooks";
import { publicCorsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

function meta(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(body, { status, headers: publicCorsHeaders(origin) });
}

/**
 * POST /api/recruitment/upload — Public file upload for recruitment
 * applications. Not matched by proxy.ts, so it is reachable without an admin
 * session cookie (required for the public application form).
 *
 * Multipart fields: `file`, `roleId`, `fieldName`.
 * The target Drive folder is resolved server-side from the role's field
 * definition (driveFolderId) — never trusted from the client. The actual
 * upload is delegated to the Google Apps Script web app configured in
 * recruitment settings (driveUploadScriptUrl), which stores the file in the
 * requested Google Drive folder and returns {fileUrl, fileId, fileName}.
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: publicCorsHeaders(origin),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const roleId = String(formData.get("roleId") ?? "").trim();
    const fieldName = String(formData.get("fieldName") ?? "").trim();

    if (!file) return meta(origin, 400, { error: "No file provided" });
    if (!roleId || !fieldName) {
      return meta(origin, 400, {
        error: "roleId and fieldName are required",
      });
    }

    // Resolve the target Drive folder from the role definition.
    const roleDoc = await db.collection(COLLECTIONS.roles).doc(roleId).get();
    if (!roleDoc.exists) return meta(origin, 404, { error: "Role not found" });
    const fields = Array.isArray(roleDoc.data()?.fields)
      ? (roleDoc.data()!.fields as {
          name: string;
          type?: string;
          driveFolderId?: string;
        }[])
      : [];
    const field = fields.find((f) => f.name === fieldName);
    const folderId = field?.driveFolderId?.trim() || "1aDm5XSzrbnLRnwOxTEn2F23R6IIkzppr";
    if (field?.type !== "file" || !folderId) {
      return meta(origin, 400, {
        error: `No Drive folder configured for field "${fieldName}"`,
      });
    }

    const settingsDoc = await db
      .collection(COLLECTIONS.settings)
      .doc(SETTINGS_DOC_ID)
      .get();
    const settings = normaliseSettings(
      settingsDoc.exists ? settingsDoc.data() : undefined,
    );
    const scriptUrl = settings.driveUploadScriptUrl;
    if (!scriptUrl) {
      return meta(origin, 500, {
        error: "Drive upload script is not configured in recruitment settings",
      });
    }

    // Base64 the file and hand it off to the Apps Script that writes into Drive.
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength > 50 * 1024 * 1024) {
      return meta(origin, 413, { error: "File exceeds the 50 MB limit" });
    }

    const result = await postToScript(scriptUrl, {
      fileName: file.name,
      mimeType: file.type,
      base64: bytes.toString("base64"),
      folderId,
    });

    if (result?.error) {
      throw new Error(String(result.error));
    }

    const fileUrl = result?.fileUrl ?? result?.url ?? "";
    const fileId = result?.fileId ?? "";
    if (!fileUrl || !fileId) {
      throw new Error(
        `Drive script returned an invalid response (${JSON.stringify(result)})`,
      );
    }

    return meta(origin, 200, {
      success: true,
      url: fileUrl,
      driveFileId: fileId,
      originalName: result?.fileName ?? file.name,
      mimeType: file.type,
      sizeBytes: bytes.byteLength,
    });
  } catch (error) {
    console.error("Recruitment upload error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
    return meta(origin, 502, { error: message });
  }
}