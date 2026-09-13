import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { COLLECTIONS, normaliseApplication } from "@/lib/recruitment";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replaceAll('"', '""')}"`;
}

/**
 * GET /api/recruitment/export — CSV export of applications (admin only).
 * Supports the same filters as the list endpoint: ?roleId=, ?status=, ?search=.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");
    const status = searchParams.get("status");
    const search = (searchParams.get("search") ?? "").trim().toLowerCase();

    const [appsSnap, rolesSnap] = await Promise.all([
      db.collection(COLLECTIONS.applications).orderBy("submittedAt", "desc").limit(1000).get(),
      db.collection(COLLECTIONS.roles).limit(1000).get(),
    ]);

    const roleTitleById = new Map<string, string>();
    for (const doc of rolesSnap.docs) {
      roleTitleById.set(doc.id, asTitle(doc.data()));
    }

    const apps = appsSnap.docs
      .map((doc) => normaliseApplication({ id: doc.id, ...doc.data() }))
      .filter((app) => {
        if (roleId && app.roleId !== roleId) return false;
        if (status && app.status !== status) return false;
        if (search) {
          const name = (app.applicant.fullName ?? "").toLowerCase();
          const email = (app.userEmail ?? "").toLowerCase();
          if (!name.includes(search) && !email.includes(search)) return false;
        }
        return true;
      });

    const header = [
      "id",
      "role",
      "title",
      "fullName",
      "email",
      "phone",
      "branch",
      "yearOfStudy",
      "status",
      "submittedAt",
      "linkedin",
      "github",
      "portfolio",
      "gitRepoLink",
      "resumeUrl",
      "resumeFileId",
      "taskUrl",
      "taskFileId",
      "answersJson",
    ];

    const rows = apps.map((a) => [
      a.id,
      a.roleId,
      roleTitleById.get(a.roleId) ?? "",
      a.applicant.fullName ?? "",
      a.userEmail ?? "",
      a.applicant.phone ?? "",
      a.applicant.branch ?? "",
      a.applicant.yearOfStudy ?? "",
      a.status,
      a.submittedAt ?? "",
      a.socialLinks?.linkedin ?? "",
      a.socialLinks?.github ?? "",
      a.socialLinks?.portfolio ?? "",
      a.socialLinks?.gitRepoLink ?? "",
      a.files?.resume?.url ?? "",
      a.files?.resume?.driveFileId ?? "",
      a.files?.taskSubmission?.url ?? "",
      a.files?.taskSubmission?.driveFileId ?? "",
      JSON.stringify(a.answers ?? {}),
    ]);

    const csv = [
      header.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ].join("\n");

    const filename = `recruitment-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export recruitment applications:", error);
    return NextResponse.json(
      { error: "Failed to export recruitment applications" },
      { status: 500 },
    );
  }
}

function asTitle(raw: Record<string, unknown> | undefined): string {
  return raw && typeof raw.title === "string" ? raw.title : "";
}