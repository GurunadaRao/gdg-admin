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
    let dbRoleId = user.roleId;
    let dbModules = user.modules || [];
    let dbIsAdmin = user.isAdmin;
    
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        teamMemberId = userData?.teamMemberId || null;
        
        if (userData?.roleId) {
          dbRoleId = userData.roleId;
        }
        if (userData?.isAdmin !== undefined) {
          dbIsAdmin = userData.isAdmin;
        }
      }
      
      // If we have a roleId but no modules, or if we want to ensure modules are fresh, we can fetch from roles
      if (dbRoleId && (!dbModules || dbModules.length === 0)) {
        const roleDoc = await db.collection("roles").doc(dbRoleId).get();
        if (roleDoc.exists) {
          dbModules = roleDoc.data()?.modules || [];
        }
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
        role: dbIsAdmin ? "admin" : "user",
        roleId: dbRoleId,
        modules: dbModules,
        teamMemberId,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
