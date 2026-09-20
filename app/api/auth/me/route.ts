/**
 * GET /api/auth/me
 * Returns the currently authenticated user from the Firebase session cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie, COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = await verifySessionCookie(sessionCookie);

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let teamMemberId = null;
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        teamMemberId = userDoc.data()?.teamMemberId || null;
      }
    } catch (e) {
      console.error("Failed to fetch user doc for auth/me:", e);
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.uid,
        email: user.email,
        name: user.name,
        role: user.isAdmin ? "admin" : "user",
        roleId: user.roleId,
        modules: user.modules || [],
        teamMemberId,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
