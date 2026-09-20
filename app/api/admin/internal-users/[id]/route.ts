import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db as adminDb, adminAuth } from "@/lib/firebase";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only L0 can manage internal admins
    if (user.roleId !== "L0") {
      return NextResponse.json({ error: "Forbidden: Only L0 can manage internal admins" }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json();
    const userRef = adminDb.collection("users").doc(id);

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name) updateData.name = data.name;
    if (data.roleId) updateData.roleId = data.roleId;

    await userRef.update(updateData);

    // If role changed, update claims
    if (data.roleId) {
      const roleDoc = await adminDb.collection("roles").doc(data.roleId).get();
      if (roleDoc.exists) {
        const roleData = roleDoc.data();
        await adminAuth.setCustomUserClaims(id, { 
          admin: true, 
          roleId: data.roleId, 
          modules: roleData?.modules || [] 
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating internal user:", error);
    return NextResponse.json({ error: "Failed to update internal user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only L0 can manage internal admins
    if (user.roleId !== "L0") {
      return NextResponse.json({ error: "Forbidden: Only L0 can manage internal admins" }, { status: 403 });
    }

    const { id } = await params;
    
    // Prevent self-deletion
    if (id === user.uid) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    // Revoke admin claim
    await adminAuth.setCustomUserClaims(id, { admin: false });
    
    // Delete from Firestore
    await adminDb.collection("users").doc(id).delete();
    
    // Optionally delete from Auth or just disable
    // await adminAuth.deleteUser(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting internal user:", error);
    return NextResponse.json({ error: "Failed to delete internal user" }, { status: 500 });
  }
}
