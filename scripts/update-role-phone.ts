import "dotenv/config";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/firebase";
import type { RecruitmentRoleField } from "../lib/types/recruitment";

const PHONE_FIELD: RecruitmentRoleField = {
  name: "phone",
  label: "Mobile Number",
  type: "tel",
  section: 1,
  required: true,
  order: 2,
  placeholder: "Enter your mobile number",
  pattern: "^[6-9]\\d{9}$",
  patternMessage: "Enter a valid 10-digit mobile number",
};

/**
 * One-off: insert the `phone` mobile-number field into each role's
 * Personal Info (section 1), right after `email`. Section-1 fields are
 * renumbered 0..n in array order; section-2 fields are left untouched.
 */
async function main() {
  const snap = await db.collection("recruitment_roles").get();
  const docs = snap.docs;
  if (docs.length === 0) {
    console.error("No roles found.");
    process.exit(1);
  }

  let updated = 0;
  for (const doc of docs) {
    const data = doc.data();
    const fields = (data.fields ?? []) as RecruitmentRoleField[];
    if (fields.some((f) => f.name === "phone")) {
      console.log(`Skipped: ${doc.id} (already has phone)`);
      continue;
    }

    const nextFields: RecruitmentRoleField[] = [];
    let section1Order = 0;
    for (const f of fields) {
      if (f.section === 1) {
        if (f.name === "email") {
          nextFields.push({ ...f, order: section1Order++ });
          nextFields.push({ ...PHONE_FIELD, order: section1Order++ });
        } else {
          nextFields.push({ ...f, order: section1Order++ });
        }
      } else {
        nextFields.push(f);
      }
    }

    await db.collection("recruitment_roles").doc(doc.id).set(
      { fields: nextFields, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    updated++;
    console.log(`Updated: ${doc.id} (${data.title}) — phone added to Personal Info`);
  }
  console.log(`Done. ${updated}/${docs.length} roles updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});