import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";

/**
 * Writes the application with the signed-in user's client SDK (security rules
 * enforce userEmail == token email, dedupeKey format, status), seeds the
 * status_history subcollection, then fires the confirmation-email webhook via
 * this app's notification route (non-blocking on failure).
 */
export async function submitApplication(payload: {
  roleId: string;
  applicant: Record<string, string | boolean>;
  files: Record<string, unknown>;
  answers: Record<string, unknown>;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required");

  const email = user.email as string; // EXACT token email (do not lowercase)

  const appData = {
    roleId: payload.roleId,
    userId: user.uid,
    userEmail: email,
    applicant: payload.applicant,
    socialLinks: {},
    files: payload.files,
    answers: payload.answers,
    status: "submitted",
    currentReviewer: null,
    shortlistedAt: null,
    reviewedAt: null,
    acceptedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    dedupeKey: `${payload.roleId}_${email}`,
    agreeToTerms: true,
    confirmInfo: true,
    isRead: false,
    isStarred: false,
    notes: "",
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "recruitment_applications"), appData);

  await addDoc(collection(ref, "status_history"), {
    fromStatus: "none",
    toStatus: "submitted",
    changedBy: "system",
    reason: "Application submitted",
    createdAt: serverTimestamp(),
  });

  // Fire the confirmation email webhook (fire-and-forget; never blocks the UI).
  void notifyReceived(payload.roleId, ref.id);
  return ref.id;
}

async function notifyReceived(roleId: string, applicationId: string) {
  try {
    const token = await auth.currentUser?.getIdToken();
    await fetch("/api/recruitment/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ roleId, applicationId }),
    });
  } catch {
    // Email is best-effort; the application itself already succeeded.
  }
}

/** Pre-checks a potential duplicate before showing the form (informational only). */
export async function hasAppliedFor(roleId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user?.email) return false;
  const key = `${roleId}_${user.email}`;
  const snap = await getDocs(
    query(
      collection(db, "recruitment_applications"),
      where("dedupeKey", "==", key),
      limit(1),
    ),
  );
  return !snap.empty;
}