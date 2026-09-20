import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db as adminDb } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await adminDb.collection("roles").orderBy("level", "asc").get();
    const roles = snapshot.docs.map(doc => doc.data());

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only L0 or someone with canManageRoles can create roles
    const userRoleSnapshot = await adminDb.collection("roles").doc(user.roleId || "").get();
    const canManageRoles = userRoleSnapshot.exists && userRoleSnapshot.data()?.canManageRoles === true;
    if (!canManageRoles) {
      return NextResponse.json({ error: "Forbidden: Not enough permissions to manage roles" }, { status: 403 });
    }

    const data = await request.json();
    const id = data.id || `custom_${Date.now()}`;
    
    const roleRef = adminDb.collection("roles").doc(id);
    const roleDoc = await roleRef.get();
    if (roleDoc.exists) {
      return NextResponse.json({ error: "Role with this ID already exists" }, { status: 400 });
    }

    const roleData = {
      id,
      name: data.name,
      level: data.level || 99,
      modules: data.modules || [],
      canManageRoles: data.canManageRoles || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await roleRef.set(roleData);
    return NextResponse.json(roleData, { status: 201 });
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
