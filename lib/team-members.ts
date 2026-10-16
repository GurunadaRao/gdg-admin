/**
 * Team member role operations for the "team_members" collection.
 *
 * A member's assignments live in `roles[]`. Every change goes through
 * `applyRoleOperation`, a pure function that takes a snapshot of all members and
 * returns the documents to write plus the history entries to record. Keeping it
 * pure lets the API run it inside a Firestore transaction and lets us test it
 * without Firestore.
 */

export interface TeamMemberRole {
  id: string;
  position: string; // department
  designation: string;
  rank: number; // order of the person within the department
  dept_rank: number; // order of the department on the page
  dept_logo?: string;
  isActive: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  note?: string;
  previousRoleId?: string | null;
}

export interface MemberDoc {
  id: string;
  name: string;
  isAlumni?: boolean;
  roles: TeamMemberRole[];
}

export type HistoryType =
  | "joined"
  | "transferred"
  | "position_changed"
  | "edited"
  | "ended"
  | "reactivated"
  | "removed"
  | "alumni_changed";

export interface HistoryEntry {
  type: HistoryType;
  at: string; // when the change was made
  effectiveDate: string; // when it takes effect
  memberId: string;
  memberName: string;
  from: TeamMemberRole | null;
  to: TeamMemberRole | null;
  note: string;
}

export type RoleOperation =
  | {
      action: "add";
      position: string;
      designation?: string;
      rank?: number;
      deptRank?: number;
      deptLogo?: string;
      effectiveDate?: string;
      note?: string;
      shiftOthers?: boolean;
    }
  | {
      action: "transfer";
      roleId: string;
      toPosition: string;
      designation?: string;
      rank: number;
      deptRank?: number;
      deptLogo?: string;
      effectiveDate?: string;
      note?: string;
      shiftOthers?: boolean;
    }
  | {
      action: "change-position";
      roleId: string;
      designation: string;
      rank?: number;
      effectiveDate?: string;
      note?: string;
      shiftOthers?: boolean;
    }
  | {
      action: "update";
      roleId: string;
      position?: string;
      designation?: string;
      rank?: number;
      deptRank?: number;
      deptLogo?: string;
      startedAt?: string | null;
      endedAt?: string | null;
      note?: string;
      shiftOthers?: boolean;
    }
  | { action: "end"; roleId: string; effectiveDate?: string; note?: string }
  | { action: "reactivate"; roleId: string; note?: string }
  | { action: "remove"; roleId: string; note?: string }
  | { action: "set-alumni"; isAlumni: boolean; note?: string };

export class TeamOperationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_TEXT = 100;
const MAX_NOTE = 500;
const MAX_NUMBER = 9999;

// ── Field helpers ───────────────────────────────────────────────────────────

function text(
  value: unknown,
  label: string,
  opts: { required?: boolean; max?: number } = {},
): string | undefined {
  if (value === undefined || value === null) {
    if (opts.required) throw new TeamOperationError(`${label} is required`);
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TeamOperationError(`${label} must be text`);
  }
  const trimmed = value.trim();
  if (!trimmed && opts.required) {
    throw new TeamOperationError(`${label} is required`);
  }
  if (trimmed.length > (opts.max ?? MAX_TEXT)) {
    throw new TeamOperationError(`${label} is too long`);
  }
  return trimmed;
}

function int(
  value: unknown,
  label: string,
  opts: { required?: boolean } = {},
): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.required) throw new TeamOperationError(`${label} is required`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) {
    throw new TeamOperationError(
      `${label} must be a whole number between 0 and ${MAX_NUMBER}`,
    );
  }
  return n;
}

function isoDate(value: unknown, label: string, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new TeamOperationError(`${label} is not a valid date`);
  }
  return new Date(value).toISOString();
}

export const deptKey = (name: string) => name.trim().toLowerCase();

function newRoleId() {
  return `role-${crypto.randomUUID()}`;
}

// ── Reading roles ───────────────────────────────────────────────────────────

/** Coerce one stored role into a valid shape (tolerates old/partial data). */
export function sanitizeRole(raw: unknown, fallbackId?: string): TeamMemberRole {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const date = (v: unknown) =>
    typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;
  const role: TeamMemberRole = {
    id: str(r.id) || fallbackId || newRoleId(),
    position: str(r.position).slice(0, MAX_TEXT),
    designation: str(r.designation).slice(0, MAX_TEXT),
    rank: num(r.rank),
    dept_rank: num(r.dept_rank),
    isActive: r.isActive === undefined ? true : r.isActive === true,
    startedAt: date(r.startedAt),
    endedAt: date(r.endedAt),
    previousRoleId: str(r.previousRoleId) || null,
  };
  const logo = str(r.dept_logo);
  if (logo) role.dept_logo = logo;
  const note = str(r.note).slice(0, MAX_NOTE);
  if (note) role.note = note;
  return role;
}

/** Read `roles[]`, or build one from the legacy flat fields. */
export function normalizeRoles(
  docId: string,
  data: Record<string, unknown>,
): TeamMemberRole[] {
  if (Array.isArray(data.roles)) {
    return data.roles.map((r, i) => sanitizeRole(r, `role-${docId}-${i}`));
  }
  return [
    sanitizeRole(
      {
        id: `legacy-${docId}`,
        position: data.position,
        designation: data.designation,
        rank: data.rank,
        dept_rank: data.dept_rank,
        dept_logo: data.dept_logo,
        isActive: true,
      },
      `legacy-${docId}`,
    ),
  ];
}

// ── Department view ─────────────────────────────────────────────────────────

export interface DepartmentSummary {
  name: string;
  deptRank: number;
  logo: string;
  lineup: {
    memberId: string;
    name: string;
    designation: string;
    rank: number;
    roleId: string;
  }[];
}

/** Active departments with their current order, as shown on the members page. */
export function buildDepartments(members: MemberDoc[]): DepartmentSummary[] {
  const map = new Map<string, DepartmentSummary>();
  for (const m of members) {
    if (m.isAlumni) continue;
    for (const role of m.roles) {
      if (!role.isActive || !role.position) continue;
      const key = deptKey(role.position);
      let dept = map.get(key);
      if (!dept) {
        dept = {
          name: role.position,
          deptRank: role.dept_rank,
          logo: role.dept_logo ?? "",
          lineup: [],
        };
        map.set(key, dept);
      }
      if (!dept.logo && role.dept_logo) dept.logo = role.dept_logo;
      dept.lineup.push({
        memberId: m.id,
        name: m.name,
        designation: role.designation,
        rank: role.rank,
        roleId: role.id,
      });
    }
  }
  const departments = [...map.values()];
  for (const d of departments) {
    d.lineup.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }
  return departments.sort(
    (a, b) => a.deptRank - b.deptRank || a.name.localeCompare(b.name),
  );
}

// ── Applying an operation ───────────────────────────────────────────────────

export interface OperationResult {
  /** Documents to write, keyed by member id. */
  updates: Map<string, { roles: TeamMemberRole[]; isAlumni?: boolean }>;
  history: HistoryEntry[];
  /** True when the target member has no active role after the change. */
  noActiveRoles: boolean;
}

export function applyRoleOperation(
  members: MemberDoc[],
  targetId: string,
  op: RoleOperation,
  now: string,
): OperationResult {
  const target = members.find((m) => m.id === targetId);
  if (!target) throw new TeamOperationError("Member not found", 404);

  // Copy-on-write: only members we touch end up in `updates`.
  const work = new Map<string, MemberDoc>();
  const edit = (id: string): MemberDoc => {
    let doc = work.get(id);
    if (!doc) {
      const src = members.find((m) => m.id === id)!;
      doc = { ...src, roles: src.roles.map((r) => ({ ...r })) };
      work.set(id, doc);
    }
    return doc;
  };

  const me = edit(targetId);
  const history: HistoryEntry[] = [];
  const record = (
    type: HistoryType,
    from: TeamMemberRole | null,
    to: TeamMemberRole | null,
    effectiveDate: string,
    note: string,
  ) =>
    history.push({
      type,
      at: now,
      effectiveDate,
      memberId: target.id,
      memberName: target.name,
      from: from ? { ...from } : null,
      to: to ? { ...to } : null,
      note,
    });

  const findRole = (roleId: unknown): TeamMemberRole => {
    const id = text(roleId, "roleId", { required: true })!;
    const role = me.roles.find((r) => r.id === id);
    if (!role) throw new TeamOperationError("Role not found", 404);
    return role;
  };

  /** Active role entries of a department, across everyone (live view of `work`). */
  const deptRoles = (key: string) => {
    const out: { member: MemberDoc; role: TeamMemberRole }[] = [];
    for (const m of members) {
      const doc = work.get(m.id) ?? m;
      for (const role of doc.roles) {
        if (role.isActive && deptKey(role.position) === key) {
          out.push({ member: doc, role });
        }
      }
    }
    return out;
  };

  /** Existing spelling, order and logo of a department, if it already exists. */
  const existingDept = (name: string) => {
    const roles = deptRoles(deptKey(name));
    if (roles.length === 0) return null;
    const first = roles[0].role;
    return {
      name: first.position,
      deptRank: first.dept_rank,
      logo: roles.find((r) => r.role.dept_logo)?.role.dept_logo ?? "",
    };
  };

  /** Give every active role in a department the same department order. */
  const setDeptRank = (key: string, deptRank: number) => {
    for (const { member, role } of deptRoles(key)) {
      if (role.dept_rank !== deptRank) {
        edit(member.id);
        const live = work.get(member.id)!.roles.find((r) => r.id === role.id)!;
        live.dept_rank = deptRank;
      }
    }
  };

  /**
   * Insert a role at `rank` in its department. If someone else already holds
   * that rank, everyone from that rank down moves one place.
   */
  const makeRoom = (key: string, rank: number, skipRoleId: string) => {
    const others = deptRoles(key).filter(({ role }) => role.id !== skipRoleId);
    if (!others.some(({ role }) => role.rank === rank)) return;
    for (const { member, role } of others) {
      if (role.rank >= rank) {
        edit(member.id);
        work.get(member.id)!.roles.find((r) => r.id === role.id)!.rank += 1;
      }
    }
  };

  const nextRank = (key: string) =>
    deptRoles(key).reduce((max, { role }) => Math.max(max, role.rank), 0) + 1;
  const nextDeptRank = () =>
    members.reduce(
      (max, m) =>
        Math.max(
          max,
          ...(work.get(m.id) ?? m).roles
            .filter((r) => r.isActive)
            .map((r) => r.dept_rank),
          0,
        ),
      0,
    ) + 1;

  const note = (v: unknown) => text(v, "Note", { max: MAX_NOTE }) ?? "";

  switch (op.action) {
    case "add": {
      const position = text(op.position, "Department", { required: true })!;
      const designation = text(op.designation, "Designation") || "Member";
      const effective = isoDate(op.effectiveDate, "Effective date", now);
      const existing = existingDept(position);
      const name = existing?.name ?? position;
      const key = deptKey(name);
      const deptRank =
        int(op.deptRank, "Department order") ??
        existing?.deptRank ??
        nextDeptRank();
      const rank = int(op.rank, "Order") ?? nextRank(key);
      const role: TeamMemberRole = {
        id: newRoleId(),
        position: name,
        designation,
        rank,
        dept_rank: deptRank,
        isActive: true,
        startedAt: effective,
        endedAt: null,
        previousRoleId: null,
      };
      const logo = text(op.deptLogo, "Department logo") || existing?.logo;
      if (logo) role.dept_logo = logo;
      const n = note(op.note);
      if (n) role.note = n;
      if (op.shiftOthers !== false) makeRoom(key, rank, role.id);
      me.roles.push(role);
      if (existing && deptRank !== existing.deptRank) setDeptRank(key, deptRank);
      record("joined", null, role, effective, n);
      break;
    }

    case "transfer": {
      const old = findRole(op.roleId);
      if (!old.isActive) {
        throw new TeamOperationError("Only an active role can be transferred");
      }
      const toPosition = text(op.toPosition, "New department", { required: true })!;
      const existing = existingDept(toPosition);
      const name = existing?.name ?? toPosition;
      const key = deptKey(name);
      if (key === deptKey(old.position)) {
        throw new TeamOperationError(
          "That is the same department. Use “Change position” instead.",
        );
      }
      const rank = int(op.rank, "Order in the new department", { required: true })!;
      const deptRank = int(op.deptRank, "Department order", {
        required: !existing,
      });
      const effective = isoDate(op.effectiveDate, "Effective date", now);
      const designation = text(op.designation, "Designation") || old.designation;
      const n = note(op.note);

      const role: TeamMemberRole = {
        id: newRoleId(),
        position: name,
        designation,
        rank,
        dept_rank: deptRank ?? existing!.deptRank,
        isActive: true,
        startedAt: effective,
        endedAt: null,
        previousRoleId: old.id,
      };
      const logo = text(op.deptLogo, "Department logo") || existing?.logo;
      if (logo) role.dept_logo = logo;
      if (n) role.note = n;

      const before = { ...old };
      old.isActive = false;
      old.endedAt = effective;
      if (op.shiftOthers !== false) makeRoom(key, rank, role.id);
      me.roles.push(role);
      if (existing && deptRank !== undefined && deptRank !== existing.deptRank) {
        setDeptRank(key, deptRank);
      }
      record("transferred", before, role, effective, n);
      break;
    }

    case "change-position": {
      const old = findRole(op.roleId);
      if (!old.isActive) {
        throw new TeamOperationError("Only an active role can be changed");
      }
      const designation = text(op.designation, "Designation", { required: true })!;
      const rank = int(op.rank, "Order") ?? old.rank;
      if (designation === old.designation && rank === old.rank) {
        throw new TeamOperationError("Nothing changed");
      }
      const effective = isoDate(op.effectiveDate, "Effective date", now);
      const n = note(op.note);
      const role: TeamMemberRole = {
        ...old,
        id: newRoleId(),
        designation,
        rank,
        startedAt: effective,
        endedAt: null,
        previousRoleId: old.id,
      };
      delete role.note;
      if (n) role.note = n;

      const before = { ...old };
      old.isActive = false;
      old.endedAt = effective;
      if (op.shiftOthers !== false) makeRoom(deptKey(role.position), rank, role.id);
      me.roles.push(role);
      record("position_changed", before, role, effective, n);
      break;
    }

    case "update": {
      const role = findRole(op.roleId);
      const before = { ...role };
      let changed = false;

      if (op.position !== undefined) {
        const position = text(op.position, "Department", { required: true })!;
        if (deptKey(position) !== deptKey(role.position)) {
          const existing = existingDept(position);
          role.position = existing?.name ?? position;
          if (existing) {
            role.dept_rank = existing.deptRank;
            if (existing.logo) role.dept_logo = existing.logo;
          }
        } else {
          role.position = position;
        }
        changed = true;
      }
      if (op.designation !== undefined) {
        role.designation = text(op.designation, "Designation") ?? "";
        changed = true;
      }
      if (op.rank !== undefined) {
        role.rank = int(op.rank, "Order", { required: true })!;
        if (role.isActive && op.shiftOthers !== false) {
          makeRoom(deptKey(role.position), role.rank, role.id);
        }
        changed = true;
      }
      if (op.deptRank !== undefined) {
        const deptRank = int(op.deptRank, "Department order", { required: true })!;
        role.dept_rank = deptRank;
        if (role.isActive) setDeptRank(deptKey(role.position), deptRank);
        changed = true;
      }
      if (op.deptLogo !== undefined) {
        const logo = text(op.deptLogo, "Department logo") ?? "";
        if (logo) role.dept_logo = logo;
        else delete role.dept_logo;
        changed = true;
      }
      if (op.startedAt !== undefined) {
        role.startedAt =
          op.startedAt === null ? null : isoDate(op.startedAt, "Start date", now);
        changed = true;
      }
      if (op.endedAt !== undefined) {
        role.endedAt =
          op.endedAt === null ? null : isoDate(op.endedAt, "End date", now);
        changed = true;
      }
      if (op.note !== undefined) {
        const n = note(op.note);
        if (n) role.note = n;
        else delete role.note;
        changed = true;
      }
      if (!changed) throw new TeamOperationError("Nothing to update");
      record("edited", before, role, now, "");
      break;
    }

    case "end": {
      const role = findRole(op.roleId);
      if (!role.isActive) throw new TeamOperationError("Role is already ended");
      const effective = isoDate(op.effectiveDate, "Effective date", now);
      const before = { ...role };
      role.isActive = false;
      role.endedAt = effective;
      record("ended", before, role, effective, note(op.note));
      break;
    }

    case "reactivate": {
      const role = findRole(op.roleId);
      if (role.isActive) throw new TeamOperationError("Role is already active");
      const before = { ...role };
      role.isActive = true;
      role.endedAt = null;
      record("reactivated", before, role, now, note(op.note));
      break;
    }

    case "remove": {
      const role = findRole(op.roleId);
      me.roles = me.roles.filter((r) => r.id !== role.id);
      record("removed", role, null, now, note(op.note));
      break;
    }

    case "set-alumni": {
      if (typeof op.isAlumni !== "boolean") {
        throw new TeamOperationError("isAlumni must be true or false");
      }
      if (!!target.isAlumni === op.isAlumni) {
        throw new TeamOperationError("Nothing changed");
      }
      me.isAlumni = op.isAlumni;
      record("alumni_changed", null, null, now, note(op.note));
      break;
    }

    default:
      throw new TeamOperationError("Unknown action");
  }

  const updates: OperationResult["updates"] = new Map();
  for (const [id, doc] of work) {
    updates.set(id, { roles: doc.roles, isAlumni: doc.isAlumni });
  }
  return {
    updates,
    history,
    noActiveRoles: !me.isAlumni && !me.roles.some((r) => r.isActive),
  };
}
