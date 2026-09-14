import "dotenv/config";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/firebase";
import type { RecruitmentRoleField } from "../lib/types/recruitment";

/**
 * One-off: give every role's `resume` file field the same Drive folder ID
 * (copied from the web-dev role) and flip all roles to status "open".
 */
async function main() {
  const snap = await db.collection("recruitment_roles").get();
  const docs = snap.docs;
  if (docs.length === 0) {
    console.error("No roles found.");
    process.exit(1);
  }

  // Source folder ID from web-dev's resume field.
  const webDev = docs.find((d) => d.id === "web-dev");
  const fields0 = (webDev?.data()?.fields ?? []) as RecruitmentRoleField[];
  const folderId =
    fields0.find((f) => f.name === "resume")?.driveFolderId?.trim() ?? "";
  if (!folderId) {
    console.error("web-dev has no resume driveFolderId to copy from.");
    process.exit(1);
  }
  console.log(`Using folder ID: ${folderId}`);

  let updated = 0;
  for (const doc of docs) {
    const data = doc.data();
    const fields = (data.fields ?? []) as RecruitmentRoleField[];
    const nextFields = fields.map((f) =>
      f.type === "file" && f.name === "resume" && !f.driveFolderId?.trim()
        ? { ...f, driveFolderId: folderId }
        : f,
    );
    await db.collection("recruitment_roles").doc(doc.id).set(
      {
        fields: nextFields,
        status: "open",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    updated++;
    console.log(`Updated: ${doc.id} (${data.title}) → open, resume folder set`);
  }
  console.log(`Done. ${updated}/${docs.length} roles updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});