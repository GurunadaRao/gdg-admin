import "dotenv/config";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth(app);
const db = getFirestore(app);

const ALL_MODULES = [
  "dashboard",
  "events",
  "form-builder",
  "forms",
  "gallery",
  "gdg-team",
  "image-to-url",
  "managed-events",
  "members",
  "recruitment",
  "settings",
  "users"
];

const ROLES = [
  {
    id: "L0",
    name: "Super Admin",
    level: 0,
    canManageRoles: true,
    modules: ALL_MODULES,
  },
  {
    id: "L1",
    name: "Executive Board",
    level: 1,
    canManageRoles: false,
    modules: ALL_MODULES.filter(m => m !== "settings"),
  },
  {
    id: "L2",
    name: "Dev Team",
    level: 2,
    canManageRoles: false,
    modules: ["members", "events", "managed-events", "image-to-url", "gallery", "gdg-team"],
  },
  {
    id: "L3",
    name: "PR Team",
    level: 3,
    canManageRoles: false,
    modules: ["members", "users", "recruitment"],
  },
  {
    id: "L4",
    name: "Videography",
    level: 4,
    canManageRoles: false,
    modules: ["gallery", "image-to-url"],
  }
];

async function setupRBAC() {
  console.log("Seeding roles...");
  for (const role of ROLES) {
    await db.collection("roles").doc(role.id).set({
      ...role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`Created role: ${role.name} (${role.id})`);
  }

  console.log("\nMigrating users...");
  const devAdminEmail = "devadmin@gdgvitb.in";
  const organizerEmail = "organizer@gdgvitb.in";
  const adminEmail = "admin@gdgvitb.in";

  // L0 - devadmin
  try {
    const devAdmin = await auth.getUserByEmail(devAdminEmail);
    const role = ROLES.find(r => r.id === "L0")!;
    await auth.setCustomUserClaims(devAdmin.uid, { admin: true, roleId: "L0", modules: role.modules });
    await db.collection("users").doc(devAdmin.uid).set({
      email: devAdmin.email,
      name: devAdmin.displayName || "Dev Admin",
      isAdmin: true,
      roleId: "L0",
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`Migrated ${devAdminEmail} to L0.`);
  } catch (e) {
    console.log(`Could not migrate ${devAdminEmail}:`, e);
  }

  // L1 - organizer
  try {
    const organizer = await auth.getUserByEmail(organizerEmail);
    const role = ROLES.find(r => r.id === "L1")!;
    await auth.setCustomUserClaims(organizer.uid, { admin: true, roleId: "L1", modules: role.modules });
    await db.collection("users").doc(organizer.uid).set({
      email: organizer.email,
      name: organizer.displayName || "Organizer",
      isAdmin: true,
      roleId: "L1",
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`Migrated ${organizerEmail} to L1.`);
  } catch (e) {
    console.log(`Could not migrate ${organizerEmail}:`, e);
  }

  // Remove admin@gdgvitb.in
  try {
    const admin = await auth.getUserByEmail(adminEmail);
    await auth.setCustomUserClaims(admin.uid, { admin: false });
    // Also remove from users collection
    await db.collection("users").doc(admin.uid).delete();
    console.log(`Revoked access for ${adminEmail}.`);
  } catch (e) {
    console.log(`Could not revoke ${adminEmail}:`, e);
  }

  console.log("RBAC Setup complete!");
}

setupRBAC().catch(console.error);
