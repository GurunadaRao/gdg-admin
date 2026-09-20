import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

// Disable caching so the response always reflects the latest Firestore data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await db
      .collection("team_members")
      .orderBy("name", "asc")
      .get();

    const members = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Backwards compatibility: wrap legacy fields in a roles array if none exists
      if (!data.roles) {
        data.roles = [{
          id: `legacy-${doc.id}`,
          position: data.position || "",
          designation: data.designation || "",
          rank: data.rank || 0,
          dept_rank: data.dept_rank || 0,
          dept_logo: data.dept_logo || "",
          isActive: true
        }];
      }

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
