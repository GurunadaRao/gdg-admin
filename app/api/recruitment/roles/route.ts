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
    const field = f as {
      type?: string;
      name?: string;
      driveFolderId?: string;
    };
    if (field.type === "file" && !field.driveFolderId?.trim()) {
      return `Field "${field.name ?? "(unnamed)"}" is a file upload and needs a Drive folder link`;
    }
  }
  return null;
}

/**
 * GET /api/recruitment/roles — List recruitment roles.
 * Optional ?status= filter. Ordered by createdAt desc.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const snapshot = await db
      .collection(COLLECTIONS.roles)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const roles = snapshot.docs
      .filter((doc) => !status || doc.data().status === status)
      .map((doc) => normaliseRole({ id: doc.id, ...doc.data() }));

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Failed to fetch recruitment roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch recruitment roles" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/recruitment/roles — Create a new recruitment role.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const status = ROLE_STATUS_SET.has(body.status) ? body.status : "draft";

    const missingFolder = fieldsError(body.fields, status);
    if (missingFolder) {
      return NextResponse.json({ error: missingFolder }, { status: 400 });
    }

    const data = {
      title: body.title,
      description: body.description ?? "",
      icon: body.icon ?? "",
      color: body.color ?? "#4285F4",
      status,
      maxApplications:
        typeof body.maxApplications === "number" ? body.maxApplications : null,
      applicationStart: body.applicationStart ?? null,
      applicationEnd: body.applicationEnd ?? null,
      sections: Array.isArray(body.sections) ? body.sections : [],
      fields: Array.isArray(body.fields) ? body.fields : [],
      createdBy: admin.email || admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTIONS.roles).add(data);
    const created = await docRef.get();

    return NextResponse.json(
      normaliseRole({ id: docRef.id, ...created.data() }),
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create recruitment role:", error);
    return NextResponse.json(
      { error: "Failed to create recruitment role" },
      { status: 500 },
    );
  }
}