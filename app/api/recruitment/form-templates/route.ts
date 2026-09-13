import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, normaliseFormTemplate } from "@/lib/recruitment";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FIELD_TYPE_SET = new Set([
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

/**
 * Scope a form template payload. `driveFolderId` links are intentionally
 * dropped — Drive folders are decided per-role, never baked into a template.
 */
function scopedPayload(body: Record<string, unknown>): {
  name: string;
  description: string;
  sections: Record<string, unknown>[];
  fields: Record<string, unknown>[];
} {
  const sections: Record<string, unknown>[] = Array.isArray(body.sections)
    ? body.sections
        .map((s) => {
          const section = s as Record<string, unknown>;
          return {
            number:
              typeof section.number === "number" ? section.number : null,
            title: typeof section.title === "string" ? section.title.trim() : "",
            description:
              typeof section.description === "string" ? section.description : "",
            borderColor:
              typeof section.borderColor === "string"
                ? section.borderColor
                : "#4285F4",
          };
        })
        .filter((s) => s.number !== null)
    : [];

  const fields: Record<string, unknown>[] = Array.isArray(body.fields)
    ? body.fields
        .map((f) => {
          const field = f as Record<string, unknown>;
          const type = FIELD_TYPE_SET.has(field.type as string)
            ? (field.type as string)
            : null;
          if (!type) return null;
          const name =
            typeof field.name === "string" ? field.name.trim() : "";
          if (!name) return null;
          const scoped: Record<string, unknown> = {
            name,
            label: typeof field.label === "string" ? field.label.trim() : "",
            type,
            section:
              typeof field.section === "number" ? field.section : null,
            required: field.required === true,
            order:
              typeof field.order === "number" ? field.order : 0,
          };
          for (const key of [
            "placeholder",
            "helpText",
            "options",
            "accept",
            "checkboxLabel",
            "pattern",
            "patternMessage",
            "content",
          ]) {
            if (field[key] !== undefined) scoped[key] = field[key];
          }
          if (Array.isArray(field.links)) scoped.links = field.links;
          const maxSizeMB = field.maxSizeMB;
          if (typeof maxSizeMB === "number" && maxSizeMB > 0) {
            scoped.maxSizeMB = maxSizeMB;
          }
          const allowedExtensions = field.allowedExtensions;
          if (Array.isArray(allowedExtensions)) {
            scoped.allowedExtensions = allowedExtensions;
          }
          for (const key of ["minLength", "maxLength"]) {
            if (typeof field[key] === "number" && (field[key] as number) >= 0) {
              scoped[key] = field[key];
            }
          }
          return scoped;
        })
        .filter((f): f is Record<string, unknown> => f !== null)
    : [];

  return {
    name: typeof body.name === "string" ? body.name.trim() : "",
    description: typeof body.description === "string" ? body.description.trim() : "",
    sections,
    fields,
  };
}

/**
 * GET /api/recruitment/form-templates — List saved form templates (admin only).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const snapshot = await db
      .collection(COLLECTIONS.formTemplates)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    const templates = snapshot.docs.map((doc) =>
      normaliseFormTemplate({ id: doc.id, ...doc.data() }),
    );
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch recruitment form templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch recruitment form templates" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/recruitment/form-templates — Create a saved form template (admin only).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const payload = scopedPayload(body);

    if (!payload.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (payload.sections.length === 0 || payload.fields.length === 0) {
      return NextResponse.json(
        { error: "A form template needs at least one section and one field" },
        { status: 400 },
      );
    }

    const data = {
      ...payload,
      createdBy: admin.email || admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection(COLLECTIONS.formTemplates).add(data);
    const created = await docRef.get();
    return NextResponse.json(
      normaliseFormTemplate({ id: docRef.id, ...created.data() }),
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create recruitment form template:", error);
    return NextResponse.json(
      { error: "Failed to create recruitment form template" },
      { status: 500 },
    );
  }
}