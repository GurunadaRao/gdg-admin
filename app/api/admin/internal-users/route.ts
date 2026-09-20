import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db as adminDb, adminAuth } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await adminDb.collection("users").get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching internal users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only L0 can create internal admins
    if (user.roleId !== "L0") {
      return NextResponse.json({ error: "Forbidden: Only L0 can manage internal admins" }, { status: 403 });
    }

    const data = await request.json();
    const { email, name, password, roleId, teamMemberId } = data;

    if (!email || !password || !roleId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if role exists to get its modules
    const roleDoc = await adminDb.collection("roles").doc(roleId).get();
    if (!roleDoc.exists) {
      return NextResponse.json({ error: "Invalid role ID" }, { status: 400 });
    }
    const roleData = roleDoc.data();

    let newUser;
    try {
      newUser = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });
    } catch (e: any) {
      if (e.code === 'auth/email-already-exists') {
        newUser = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(newUser.uid, { password, displayName: name });
      } else {
        throw e;
      }
    }

    // Set claims
    await adminAuth.setCustomUserClaims(newUser.uid, { 
      admin: true, 
      roleId, 
      modules: roleData?.modules || [] 
    });

    // Save to Firestore
    const userData = {
      email,
      name,
      isAdmin: true,
      roleId,
      teamMemberId: teamMemberId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("users").doc(newUser.uid).set(userData);

    return NextResponse.json({ id: newUser.uid, ...userData }, { status: 201 });
  } catch (error) {
    console.error("Error creating internal user:", error);
    return NextResponse.json({ error: "Failed to create internal user" }, { status: 500 });
  }
}
