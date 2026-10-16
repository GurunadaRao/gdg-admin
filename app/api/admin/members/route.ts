import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/auth";
import { normalizeRoles, sanitizeRole } from "@/lib/team-members";

// Disable caching so the response always reflects the latest Firestore data
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const snapshot = await db
      .collection("team_members")
      .orderBy("name", "asc")
      .get();

    const members = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Legacy documents have no roles[]: derive one from the flat fields.
      data.roles = normalizeRoles(doc.id, data);

      return {
        ...data,
        id: doc.id,
      };
    });

    return NextResponse.json(members);
  } catch (err) {
    console.error("Failed to fetch team members:", err);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    // Whitelist allowed fields to prevent injection of unexpected data
    const allowedFields = [
      "name",
      "designation",
      "position",
      "imageUrl",
      "linkedinUrl",
      "mail",
      "bgColor",
      "logo",
      "dept_logo",
      "rank",
      "dept_rank",
      "isAlumni",
      "roles",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        data[field] = body[field];
      }
    }

    // Validate roles and stamp when each one started.
    const now = new Date().toISOString();
    if (Array.isArray(body.roles)) {
      data.roles = body.roles.map((r: unknown) => {
        const role = sanitizeRole(r);
        if (!role.startedAt) role.startedAt = now;
        return role;
      });
    }
    data.createdAt = now;
    data.updatedAt = now;

    const docRef = await db.collection("team_members").add(data);
    const newDoc = await docRef.get();

    return NextResponse.json(
      { id: newDoc.id, ...newDoc.data() },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create member error:", err);
    return NextResponse.json(
      { error: "Failed to create team member" },
      { status: 500 },
    );
  }
}
