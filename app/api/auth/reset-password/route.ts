import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { newPassword } = data;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // Update the password in Firebase Auth
    await adminAuth.updateUser(user.uid, {
      password: newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset password" },
      { status: 500 }
    );
  }
}
