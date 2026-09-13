import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, normaliseRole, ROLE_STATUSES } from "@/lib/recruitment";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLE_STATUS_SET = new Set<string>(ROLE_STATUSES);

function fieldsError(fields: unknown, status: string): string | null {
  if (status === "draft") return null;
  if (!Array.isArray(fields)) return null;
  for (const f of fields) {
    const field = f as { type?: string; name?: string; driveFolderId?: string };
    if (field.type === "file" && !field.driveFolderId?.trim()) {
      return `Field "${field.name ?? "(unnamed)"}" is a file upload and needs a Drive folder link`;
    }
  }
  return null;
}

const ALLOWED_FIELDS = [
  "title",
  "description",
  "icon",
  "color",
  "status",
  "maxApplications",
  "applicationStart",
  "applicationEnd",
  "sections",
  "fields",
  "createdBy",
];

/**
 * GET /api/recruitment/roles/[id] — Single role + application count.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const doc = await db.collection(COLLECTIONS.roles).doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const countSnap = await db
      .collection(COLLECTIONS.applications)
      .where("roleId", "==", id)
      .count()
      .get();

    return NextResponse.json({
      ...normaliseRole({ id: doc.id, ...doc.data() }),
      applicationCount: countSnap.data().count,
    });
  } catch (error) {
    console.error("Failed to fetch recruitment role:", error);
    return NextResponse.json(
      { error: "Failed to fetch recruitment role" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/recruitment/roles/[id] — Update a role (whitelisted fields).
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

    const docRef = db.collection(COLLECTIONS.roles).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const currentStatus = body.status !== undefined ? body.status : doc.data()?.status;

    if (body.fields !== undefined) {
      const missingFolder = fieldsError(body.fields, currentStatus);
      if (missingFolder) {
        return NextResponse.json({ error: missingFolder }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        data[field] = body[field];
        if (field === "status" && !ROLE_STATUS_SET.has(body.status)) {
          return NextResponse.json(
            { error: "Invalid role status" },
            { status: 400 },
          );
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    data.updatedAt = FieldValue.serverTimestamp();

    await docRef.update(data);
    const updated = await docRef.get();
    return NextResponse.json(
      normaliseRole({ id: updated.id, ...updated.data() }),
    );
  } catch (error) {
    console.error("Failed to update recruitment role:", error);
    return NextResponse.json(
      { error: "Failed to update recruitment role" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/recruitment/roles/[id] — Delete a role and all its applications
 * (including each application's reviews + status_history subcollections).
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
    const docRef = db.collection(COLLECTIONS.roles).doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const appSnap = await db
      .collection(COLLECTIONS.applications)
      .where("roleId", "==", id)
      .limit(500)
      .get();

    const roleBatch = db.batch();

    for (const appDoc of appSnap.docs) {
      for (const sub of ["reviews", "status_history"]) {
        const subSnap = await appDoc.ref.collection(sub).get();
        for (const subDoc of subSnap.docs) {
          roleBatch.delete(subDoc.ref);
        }
      }
      roleBatch.delete(appDoc.ref);
    }

    roleBatch.delete(docRef);
    await roleBatch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recruitment role:", error);
    return NextResponse.json(
      { error: "Failed to delete recruitment role" },
      { status: 500 },
    );
  }
}