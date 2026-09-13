/**
 * Standalone script to create an admin user in Firebase Authentication
 * and set the `admin` custom claim.
 * Run with: node scripts/addAdmin.js
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
require("dotenv/config");

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth(app);

async function addAdmin() {
  const email = "admin@gdgvitb.in";
  const password = "admin@1234";
  const displayName = "GDG DEVS";

  try {
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`User with email ${email} already exists (uid: ${user.uid}).`);
      await auth.updateUser(user.uid, { password, displayName });
      console.log("Existing admin password updated.");
    } catch {
      user = await auth.createUser({
        email,
        password,
        displayName,
      });
      console.log("Admin user created in Firebase Auth!");
    }

    // Set admin custom claim
    await auth.setCustomUserClaims(user.uid, { admin: true });

    console.log("-----------------------------------");
    console.log(`UID:   ${user.uid}`);
    console.log(`Name:  ${displayName}`);
    console.log(`Email: ${email}`);
    console.log("-----------------------------------");
    console.log("\nLogin Credentials:");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log("\nCustom claims: { admin: true }");
  } catch (error) {
    console.error("Error creating admin user:", error);
    throw error;
  }
}

addAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
