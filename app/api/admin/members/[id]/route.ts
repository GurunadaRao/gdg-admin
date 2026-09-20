import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Whitelist of updatable fields — prevents clients from injecting
    // arbitrary fields (e.g., isAdmin) into the Firestore document.
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

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const docRef = db.collection("team_members").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 },
      );
    }

    await docRef.update(data);

    const updatedDoc = await docRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err: unknown) {
    console.error("Update member error:", err);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const docRef = db.collection("team_members").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 },
      );
    }

    await docRef.delete();

    return NextResponse.json({ message: "Member deleted successfully" });
  } catch (err: unknown) {
    console.error("Delete member error:", err);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 },
    );
  }
}
