import "dotenv/config";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth(app);

async function listAdmins() {
  const result = await auth.listUsers(1000);
  const admins = result.users.filter(u => u.customClaims?.admin === true);
  console.log("Admins:");
  admins.forEach(a => {
    console.log(`- ${a.email} (UID: ${a.uid}) Claims: ${JSON.stringify(a.customClaims)}`);
  });
}

listAdmins().catch(console.error);
