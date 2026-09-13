import { db } from "../lib/firebase";

async function main() {
  try {
    const docRef = db.collection("recruitment_settings").doc("global");
    await docRef.set({
      driveUploadScriptUrl: "https://script.google.com/macros/s/AKfycbwlUwNM7XWO2gaK7uXTzmfVvpPsR1zS99Ukh2Ixg7a372SYZfZZfdCiZJkJwBwlqD2p6w/exec",
      isRecruitmentActive: true, // Make sure recruitment is active
    }, { merge: true });

    console.log("Successfully updated recruitment settings with Drive upload URL.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating settings:", err);
    process.exit(1);
  }
}

main();
