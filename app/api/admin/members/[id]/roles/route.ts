import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { requireAdmin } from "@/lib/auth";
import {
  applyRoleOperation,
  buildDepartments,
  normalizeRoles,
  TeamOperationError,
  type MemberDoc,
  type RoleOperation,
} from "@/lib/team-members";

export const dynamic = "force-dynamic";

const COLLECTION = "team_members";
const HISTORY = "role_history";

function toMember(id: string, data: FirebaseFirestore.DocumentData): MemberDoc {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    isAlumni: data.isAlumni === true,
    roles: normalizeRoles(id, data),
  };
}

/**
 * GET /api/admin/members/[id]/roles
 * Returns the member's roles, their change history, and the current department
 * line-ups (so the UI can show the existing order when asking for a new one).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const [snapshot, historySnap] = await Promise.all([
      db.collection(COLLECTION).get(),
      db
        .collection(COLLECTION)
        .doc(id)
        .collection(HISTORY)
        .orderBy("at", "desc")
        .limit(100)
        .get(),
    ]);

    const members = snapshot.docs.map((d) => toMember(d.id, d.data()));
    const member = members.find((m) => m.id === id);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({
      roles: member.roles,
      isAlumni: member.isAlumni === true,
      history: historySnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      departments: buildDepartments(members),
    });
  } catch (error) {
    console.error("Failed to load member roles:", error);
    return NextResponse.json(
      { error: "Failed to load member roles" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/members/[id]/roles
 * Body: a RoleOperation ({ action: "transfer" | "change-position" | "add" |
 * "update" | "end" | "reactivate" | "remove" | "set-alumni", ... }).
 * Runs in one transaction: the roles of everyone affected (rank shifts,
 * department order) and the history entry are written together or not at all.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as RoleOperation;
    const now = new Date().toISOString();

    const result = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(db.collection(COLLECTION));
      const members = snapshot.docs.map((d) => toMember(d.id, d.data()));

      const { updates, history, noActiveRoles } = applyRoleOperation(
        members,
        id,
        body,
        now,
      );

      for (const [memberId, update] of updates) {
        const fields: Record<string, unknown> = {
          roles: update.roles,
          updatedAt: now,
        };
        if (memberId === id && update.isAlumni !== undefined) {
          fields.isAlumni = update.isAlumni;
        }
        tx.update(db.collection(COLLECTION).doc(memberId), fields);
      }

      const by = { uid: admin.uid, email: admin.email, name: admin.name };
      for (const entry of history) {
        const ref = db
          .collection(COLLECTION)
          .doc(id)
          .collection(HISTORY)
          .doc();
        tx.set(ref, { ...entry, by });
      }

      const after = members.map((m) => {
        const u = updates.get(m.id);
        return u ? { ...m, roles: u.roles, isAlumni: u.isAlumni ?? m.isAlumni } : m;
      });
      return {
        roles: updates.get(id)?.roles ?? members.find((m) => m.id === id)!.roles,
        noActiveRoles,
        departments: buildDepartments(after),
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof TeamOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Role operation failed:", error);
    return NextResponse.json(
      { error: "Failed to update member roles" },
      { status: 500 },
    );
  }
}
