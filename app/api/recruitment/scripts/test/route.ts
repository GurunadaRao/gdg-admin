import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { postToScript } from "@/lib/recruitment-webhooks";

export const dynamic = "force-dynamic";

/**
 * POST /api/recruitment/scripts/test — Ping an Apps Script web app from the
 * server side (avoids browser CORS) and report connectivity. Admin only.
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const result = await postToScript(url, { action: "ping" });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Script ping failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Script test failed",
      },
      { status: 502 },
    );
  }
}