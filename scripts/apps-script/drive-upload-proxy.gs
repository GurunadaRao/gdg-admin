/**
 * Recruitment file upload proxy for GDG VitB admin portal.
 *
 * Route:  files are uploaded through the admin's Next.js API at
 *         /api/recruitment/upload, which forwards the base64 payload here.
 * Deploy: Extensions > Apps Script > paste this file.
 *         Authorize (the script needs Drive access).
 *         Deploy > New deployment > Type: Web app >
 *           Execute as: Me  |  Who has access: Anyone  |  Deploy.
 *         Copy the /exec URL into Recruitment > Settings > "Drive upload script".
 *
 * Responds only to POST. Enforces a single file and acceptable sizes.
 * Request JSON (from the Next.js route):
 *   {
 *     "action": "upload",
 *     "fileName": "resume.pdf",
 *     "mimeType": "application/pdf",
 *     "base64": "<base64>",
 *     "folderId": "<Drive folder ID>"
 *   }
 * Response JSON:
 *   { "fileUrl": "https://drive.google.com/file/d/<id>/view", "fileId": "<id>", "fileName": "resume.pdf" }
 *
 * Errors are returned in-band with HTTP 200 (Apps Script web apps cannot set
 * status codes):
 *   { "error": "Human readable failure reason" }
 *
 * A health-check action is also supported (used by the Settings "Test" button):
 *   { "action": "ping" }  ->  { "ok": true }
 */

const MAX_FILE_BYTES = 50 * 1024 * 1024; // keep in sync with the Next.js cap

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(400, { error: "Missing request body" });
    }

    const payload = JSON.parse(e.postData.contents);
    if (payload.action === "ping") {
      return jsonResponse(200, { ok: true });
    }
    if (payload.action !== "upload") {
      return jsonResponse(400, { error: 'Unknown action. Expected "upload" or "ping"' });
    }

    const fileName = String(payload.fileName || "").trim();
    const mimeType = String(payload.mimeType || "").trim();
    const base64 = String(payload.base64 || "");
    const folderId = String(payload.folderId || "").trim();

    if (!fileName || !base64 || !folderId) {
      return jsonResponse(400, { error: "fileName, base64 and folderId are required" });
    }

    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    if (blob.getBytes().length > MAX_FILE_BYTES) {
      return jsonResponse(400, { error: "File exceeds the 50 MB limit" });
    }

    const file = folder.createFile(blob);
    return jsonResponse(200, {
      fileUrl: "https://drive.google.com/file/d/" + file.getId() + "/view",
      fileId: file.getId(),
      fileName: file.getName(),
    });
  } catch (err) {
    return jsonResponse(500, { error: "Upload failed: " + err.message });
  }
}

function jsonResponse(status, body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// for local testing only — gets replaced by the deployment version
function testUpload() {
  const res = doPost({ postData: { contents: JSON.stringify({ action: "ping" }) } });
  Logger.log(res.getContent());
}