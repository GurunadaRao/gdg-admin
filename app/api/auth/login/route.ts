/**
 * POST /api/auth/login
 * Receives a Firebase ID token from the client (after signInWithEmailAndPassword),
 * verifies it, checks the admin custom claim, and issues a Firebase session cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase";
import { createSessionCookie, getSessionCookieConfig } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "ID token is required" },
        { status: 400 },
      );
    }


    // Verify the ID token and extract user info
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Require admin custom claim
    if (!decoded.admin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 },
      );
    }

    // Create a session cookie
    const sessionCookie = await createSessionCookie(idToken);
    const cookieConfig = getSessionCookieConfig(sessionCookie);

    const response = NextResponse.json({
      success: true,
      user: {
        id: decoded.uid,
        email: decoded.email || "",
        name: decoded.name || "",
        role: "admin",
        roleId: decoded.roleId,
        modules: decoded.modules || [],
      },
    });

    response.cookies.set(cookieConfig.name, cookieConfig.value, {
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.path,
      maxAge: cookieConfig.maxAge,
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);

    // Firebase-specific error messages
    if (error?.code === "auth/id-token-expired") {
      return NextResponse.json(
        { success: false, error: "Token expired. Please sign in again." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 },
    );
  }
}
