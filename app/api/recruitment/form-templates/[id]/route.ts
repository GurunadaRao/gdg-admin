import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, normaliseFormTemplate } from "@/lib/recruitment";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/recruitment/form-templates/[id] — Update a saved form template
 * (admin only). Keeps transform helper out of scope; updates are applied with
 * the same scoping rules as create.
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

    // Light-weight scoping: only allow name/description/sections/fields and
    // drop anything unexpected (including driveFolderId).
    const sections: Record<string, unknown>[] | undefined = Array.isArray(
      body.sections,
    )
      ? (body.sections as unknown[]).filter(
          (s): s is Record<string, unknown> =>
            !!s &&
            typeof s === "object" &&
            typeof (s as Record<string, unknown>).number === "number",
        )
      : body.sections === undefined
        ? undefined
        : [];
    const fields: Record<string, unknown>[] | undefined = Array.isArray(
      body.fields,
    )
      ? (body.fields as unknown[])
          .map((f): Record<string, unknown> | null => {
            const field = f as Record<string, unknown> | null;
            if (
              !field ||
              typeof field.name !== "string" ||
              !field.name.trim()
            ) {
              return null;
            }
            const rest = { ...field };
            delete rest.driveFolderId;
            return rest;
          })
          .filter((f): f is Record<string, unknown> => f !== null)
      : body.fields === undefined
        ? undefined
        : [];

    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim() !== "") {
      updates.name = body.name.trim();
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim();
    }
    if (sections !== undefined) updates.sections = sections;
    if (fields !== undefined) updates.fields = fields;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    updates.updatedAt = FieldValue.serverTimestamp();

    const docRef = db.collection(COLLECTIONS.formTemplates).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await docRef.update(updates);
    const updated = await docRef.get();
    return NextResponse.json(normaliseFormTemplate({ id, ...updated.data() }));
  } catch (error) {
    console.error("Failed to update recruitment form template:", error);
    return NextResponse.json(
      { error: "Failed to update recruitment form template" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/recruitment/form-templates/[id] — Delete a saved form template
 * (admin only). Existing roles keep their own copies.
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
    const docRef = db.collection(COLLECTIONS.formTemplates).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recruitment form template:", error);
    return NextResponse.json(
      { error: "Failed to delete recruitment form template" },
      { status: 500 },
    );
  }
}