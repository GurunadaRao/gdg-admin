import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db as adminDb } from "@/lib/firebase";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userRoleSnapshot = await adminDb.collection("roles").doc(user.roleId || "").get();
    const canManageRoles = userRoleSnapshot.exists && userRoleSnapshot.data()?.canManageRoles === true;
    if (!canManageRoles) {
      return NextResponse.json({ error: "Forbidden: Not enough permissions to manage roles" }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json();
    const roleRef = adminDb.collection("roles").doc(id);

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    
    // Remove fields we don't want to accidentally overwrite completely like id if it's there
    delete updateData.id;

    await roleRef.update(updateData);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userRoleSnapshot = await adminDb.collection("roles").doc(user.roleId || "").get();
    const canManageRoles = userRoleSnapshot.exists && userRoleSnapshot.data()?.canManageRoles === true;
    if (!canManageRoles) {
      return NextResponse.json({ error: "Forbidden: Not enough permissions to manage roles" }, { status: 403 });
    }

    const { id } = await params;
    
    // Prevent deleting L0 and L1 to be safe
    if (id === "L0" || id === "L1") {
      return NextResponse.json({ error: "Cannot delete core roles" }, { status: 400 });
    }

    await adminDb.collection("roles").doc(id).delete();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
