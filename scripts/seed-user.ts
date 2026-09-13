import "dotenv/config";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as crypto from "crypto";

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function main() {
  console.log("Checking Firebase credentials...");
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error("FIREBASE_PROJECT_ID is missing or empty!");
    process.exit(1);
  }
  console.log(`FIREBASE_PROJECT_ID found: ${process.env.FIREBASE_PROJECT_ID}`);

  const email = "devadmin@gdgvitb.in";
  const password = "admin_dev";
  const passwordHash = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  console.log(`Seeding user: ${email}...`);

  // Check if user exists
  const existingSnapshot = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    // Update existing user
    const existingDoc = existingSnapshot.docs[0];
    await existingDoc.ref.update({
      password: passwordHash,
      isAdmin: true,
      updatedAt: new Date().toISOString(),
    });
    console.log("User updated successfully:", {
      id: existingDoc.id,
      ...existingDoc.data(),
    });
  } else {
    // Create new user
    const docRef = await db.collection("users").add({
      email,
      name: "Dev User",
      password: passwordHash,
      isAdmin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const createdDoc = await docRef.get();
    console.log("User seeded successfully:", {
      id: createdDoc.id,
      ...createdDoc.data(),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
