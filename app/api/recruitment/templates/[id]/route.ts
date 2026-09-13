import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, normaliseFieldTemplate } from "@/lib/recruitment";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EDITABLE_KEYS = [
  "name",
  "label",
  "type",
  "required",
  "placeholder",
  "helpText",
  "options",
  "accept",
  "maxSizeMB",
  "allowedExtensions",
  "checkboxLabel",
  "minLength",
  "maxLength",
  "pattern",
  "patternMessage",
  "content",
  "links",
] as const;

/**
 * PATCH /api/recruitment/templates/[id] — Update a saved field template
 * (admin only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    for (const key of EDITABLE_KEYS) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    updates.updatedAt = FieldValue.serverTimestamp();

    const docRef = db.collection(COLLECTIONS.fieldTemplates).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await docRef.update(updates);
    const updated = await docRef.get();
    return NextResponse.json(normaliseFieldTemplate({ id, ...updated.data() }));
  } catch (error) {
    console.error("Failed to update recruitment field template:", error);
    return NextResponse.json(
      { error: "Failed to update recruitment field template" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/recruitment/templates/[id] — Delete a saved field template
 * (admin only). Existing roles keep their copied fields.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const docRef = db.collection(COLLECTIONS.fieldTemplates).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recruitment field template:", error);
    return NextResponse.json(
      { error: "Failed to delete recruitment field template" },
      { status: 500 },
    );
  }
}