import "dotenv/config";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/firebase";

/**
 * One-off: set the application window + max applications on every role.
 * Merge-only — keeps existing status / driveFolderId intact.
 */
async function main() {
  const snap = await db.collection("recruitment_roles").get();
  const docs = snap.docs;
  if (docs.length === 0) {
    console.error("No roles found.");
    process.exit(1);
  }

  const update = {
    maxApplications: 100,
    applicationStart: "2026-09-14T08:30:00.000Z",
    applicationEnd: "2026-09-16T15:30:00.000Z",
    updatedAt: FieldValue.serverTimestamp(),
  };

  let updated = 0;
  for (const doc of docs) {
    await db.collection("recruitment_roles").doc(doc.id).set(update, { merge: true });
    updated++;
    console.log(`Updated: ${doc.id} (${doc.data().title})`);
  }
  console.log(`Done. ${updated}/${docs.length} roles updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});