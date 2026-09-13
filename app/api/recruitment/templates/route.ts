import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, normaliseFieldTemplate } from "@/lib/recruitment";
import { requireAdmin } from "@/lib/auth";
import type { FieldType } from "@/lib/types/recruitment";

export const dynamic = "force-dynamic";

const FIELD_TYPE_SET = new Set<FieldType>([
  "text",
  "email",
  "tel",
  "url",
  "number",
  "select",
  "file",
  "checkbox",
  "info",
]);

function scopedPayload(body: Record<string, unknown>) {
  const type: FieldType = FIELD_TYPE_SET.has(body.type as FieldType)
    ? (body.type as FieldType)
    : "text";
  const payload: Record<string, unknown> = {
    name: typeof body.name === "string" ? body.name.trim() : "",
    label: typeof body.label === "string" ? body.label.trim() : "",
    type,
    required: body.required === true,
  };
  for (const key of [
    "placeholder",
    "helpText",
    "accept",
    "checkboxLabel",
    "pattern",
    "patternMessage",
    "content",
  ]) {
    if (typeof body[key] === "string" && body[key] !== "") {
      payload[key] = body[key];
    }
  }
  if (Array.isArray(body.links)) {
    payload.links = body.links.filter(
      (l) =>
        l &&
        typeof l === "object" &&
        typeof (l as { label?: unknown }).label === "string" &&
        typeof (l as { url?: unknown }).url === "string",
    );
  }
  if (type === "select" && Array.isArray(body.options)) {
    payload.options = body.options;
  }
  if (type === "file") {
    if (typeof body.maxSizeMB === "number" && body.maxSizeMB > 0) {
      payload.maxSizeMB = body.maxSizeMB;
    }
    if (Array.isArray(body.allowedExtensions)) {
      payload.allowedExtensions = body.allowedExtensions;
    }
  }
  for (const key of ["minLength", "maxLength"]) {
    if (typeof body[key] === "number" && body[key] >= 0) {
      payload[key] = body[key];
    }
  }
  return payload;
}

/**
 * GET /api/recruitment/templates — List saved field templates (admin only).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const snapshot = await db
      .collection(COLLECTIONS.fieldTemplates)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    const templates = snapshot.docs.map((doc) =>
      normaliseFieldTemplate({ id: doc.id, ...doc.data() }),
    );
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch recruitment field templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch recruitment field templates" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/recruitment/templates — Create a saved field template (admin only).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const payload = scopedPayload(body);

    if (!payload.name || !payload.label) {
      return NextResponse.json(
        { error: "name and label are required" },
        { status: 400 },
      );
    }

    const data = {
      ...payload,
      createdBy: admin.email || admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection(COLLECTIONS.fieldTemplates).add(data);
    const created = await docRef.get();
    return NextResponse.json(
      normaliseFieldTemplate({ id: docRef.id, ...created.data() }),
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create recruitment field template:", error);
    return NextResponse.json(
      { error: "Failed to create recruitment field template" },
      { status: 500 },
    );
  }
}