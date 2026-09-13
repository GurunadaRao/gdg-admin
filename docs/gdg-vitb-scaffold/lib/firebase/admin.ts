import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function init() {
  const apps = getApps();
  if (apps.length) return apps[0];

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (sa) {
    return initializeApp({ credential: cert(JSON.parse(sa)) });
  }
  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const app = init();
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
