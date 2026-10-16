"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  DepartmentSummary,
  HistoryEntry,
  TeamMemberRole,
} from "@/lib/team-members";

type Action =
  | "transfer"
  | "change-position"
  | "add"
  | "update"
  | "end"
  | "reactivate"
  | "remove";

type HistoryItem = HistoryEntry & {
  id: string;
  by?: { name?: string; email?: string };
};

interface Panel {
  action: Action;
  role?: TeamMemberRole;
}

const EMPTY_FORM = {
  position: "",
  designation: "",
  rank: "",
  deptRank: "",
  deptLogo: "",
  effectiveDate: "",
  startedAt: "",
  endedAt: "",
  note: "",
  shiftOthers: true,
};

const TITLES: Record<Action, string> = {
  transfer: "Transfer to another department",
  "change-position": "Change position in this department",
  add: "Add a role",
  update: "Edit role details",
  end: "End this role",
  reactivate: "Reactivate this role",
  remove: "Remove this role entry",
};

const HISTORY_LABELS: Record<HistoryEntry["type"], string> = {
  joined: "Joined",
  transferred: "Transferred",
  position_changed: "Position changed",
  edited: "Edited",
  ended: "Role ended",
  reactivated: "Reactivated",
  removed: "Removed",
  alumni_changed: "Alumni status changed",
};

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
const describe = (r: TeamMemberRole | null) =>
  r ? `${r.designation || "Member"} · ${r.position || "No department"}` : "";

export default function MemberRolesManager({
  memberId,
  onChanged,
}: {
  memberId: string;
  /** Called after any successful change so the page can refresh when the dialog closes. */
  onChanged?: () => void;
}) {
  const [roles, setRoles] = useState<TeamMemberRole[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerAlumni, setOfferAlumni] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/members/${memberId}/roles`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Failed to load roles");
        return;
      }
      setRoles(data.roles);
      setHistory(data.history);
      setDepartments(data.departments);
      setLoadError(null);
    } catch {
      setLoadError("Network error loading roles");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeRoles = roles.filter((r) => r.isActive);
  const pastRoles = roles.filter((r) => !r.isActive);

  const findDept = useCallback(
    (name: string) =>
      departments.find((d) => d.name.toLowerCase() === name.trim().toLowerCase()),
    [departments],
  );

  const targetName =
    panel?.action === "transfer" || panel?.action === "add" || panel?.action === "update"
      ? form.position
      : panel?.role?.position ?? "";
  const targetDept = useMemo(
    () => (targetName ? findDept(targetName) : undefined),
    [targetName, findDept],
  );

  function open(action: Action, role?: TeamMemberRole) {
    setError(null);
    setOfferAlumni(false);
    setPanel({ action, role });
    setForm({
      ...EMPTY_FORM,
      position: action === "update" ? role?.position ?? "" : "",
      designation:
        action === "transfer" || action === "change-position" || action === "update"
          ? role?.designation ?? ""
          : "",
      rank:
        action === "change-position" || action === "update"
          ? String(role?.rank ?? "")
          : "",
      deptRank: action === "update" ? String(role?.dept_rank ?? "") : "",
      deptLogo: action === "update" ? role?.dept_logo ?? "" : "",
      startedAt: action === "update" ? toDateInput(role?.startedAt) : "",
      endedAt: action === "update" ? toDateInput(role?.endedAt) : "",
      note: action === "update" ? role?.note ?? "" : "",
    });
  }

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Picking an existing department pre-fills its order and the next free place. */
  function pickDepartment(name: string) {
    const dept = findDept(name);
    setForm((f) => ({
      ...f,
      position: name,
      ...(dept
        ? {
            deptRank: String(dept.deptRank),
            deptLogo: f.deptLogo || dept.logo,
            rank:
              f.rank ||
              String(dept.lineup.reduce((m, l) => Math.max(m, l.rank), 0) + 1),
          }
        : {}),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!panel) return;
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const date = (v: string) => (v ? v : undefined);
    const role = panel.role;

    let body: Record<string, unknown>;
    switch (panel.action) {
      case "transfer":
        body = {
          action: "transfer",
          roleId: role!.id,
          toPosition: form.position,
          designation: form.designation,
          rank: num(form.rank),
          deptRank: num(form.deptRank),
          deptLogo: form.deptLogo,
          effectiveDate: date(form.effectiveDate),
          note: form.note,
          shiftOthers: form.shiftOthers,
        };
        break;
      case "change-position":
        body = {
          action: "change-position",
          roleId: role!.id,
          designation: form.designation,
          rank: num(form.rank),
          effectiveDate: date(form.effectiveDate),
          note: form.note,
          shiftOthers: form.shiftOthers,
        };
        break;
      case "add":
        body = {
          action: "add",
          position: form.position,
          designation: form.designation,
          rank: num(form.rank),
          deptRank: num(form.deptRank),
          deptLogo: form.deptLogo,
          effectiveDate: date(form.effectiveDate),
          note: form.note,
          shiftOthers: form.shiftOthers,
        };
        break;
      case "update":
        body = {
          action: "update",
          roleId: role!.id,
          position: form.position,
          designation: form.designation,
          rank: num(form.rank),
          deptRank: num(form.deptRank),
          deptLogo: form.deptLogo,
          startedAt: form.startedAt || null,
          endedAt: form.endedAt || null,
          note: form.note,
          shiftOthers: form.shiftOthers,
        };
        break;
      case "end":
        body = {
          action: "end",
          roleId: role!.id,
          effectiveDate: date(form.effectiveDate),
          note: form.note,
        };
        break;
      default:
        body = { action: panel.action, roleId: role!.id, note: form.note };
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }
      setRoles(data.roles);
      setDepartments(data.departments);
      setOfferAlumni(Boolean(data.noActiveRoles));
      setPanel(null);
      onChanged?.();
      load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function markAlumni() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-alumni", isAlumni: true }),
      });
      if (res.ok) {
        setOfferAlumni(false);
        onChanged?.();
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  const needsDeptOrder =
    (panel?.action === "transfer" || panel?.action === "add") &&
    form.position.trim() !== "" &&
    !targetDept;

  return (
    <div className="pt-2 pb-2 border-t border-b border-border mt-4 mb-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Roles &amp; history</h3>
        <button
          type="button"
          onClick={() => open("add")}
          disabled={loading}
          className="text-xs bg-muted hover:bg-stone-200 text-stone-700 px-2 py-1 rounded border border-border disabled:opacity-50"
        >
          + Add role
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading roles…
        </div>
      )}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {offerAlumni && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>This member has no active role now.</span>
          <button
            type="button"
            onClick={markAlumni}
            disabled={busy}
            className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Mark as alumni
          </button>
        </div>
      )}

      {!loading && activeRoles.length === 0 && !loadError && (
        <p className="text-xs text-muted-foreground">No active roles.</p>
      )}

      <div className="space-y-2">
        {activeRoles.map((role) => (
          <RoleRow key={role.id} role={role} active>
            <RoleButton onClick={() => open("transfer", role)}>Transfer</RoleButton>
            <RoleButton onClick={() => open("change-position", role)}>
              Change position
            </RoleButton>
            <RoleButton onClick={() => open("update", role)}>Edit</RoleButton>
            <RoleButton onClick={() => open("end", role)}>End</RoleButton>
          </RoleRow>
        ))}
      </div>

      {pastRoles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            Past roles
          </p>
          {pastRoles.map((role) => (
            <RoleRow key={role.id} role={role}>
              <RoleButton onClick={() => open("reactivate", role)}>Reactivate</RoleButton>
              <RoleButton onClick={() => open("update", role)}>Edit</RoleButton>
              <RoleButton danger onClick={() => open("remove", role)}>
                Remove
              </RoleButton>
            </RoleRow>
          ))}
        </div>
      )}

      {panel && (
        <form
          onSubmit={submit}
          className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-3"
        >
          <div>
            <h4 className="text-sm font-semibold text-foreground">{TITLES[panel.action]}</h4>
            {panel.role && (
              <p className="text-xs text-muted-foreground">
                Current: {describe(panel.role)} · order {panel.role.rank}
              </p>
            )}
          </div>

          {(panel.action === "transfer" ||
            panel.action === "add" ||
            panel.action === "update") && (
            <Input
              label={panel.action === "transfer" ? "New department" : "Department"}
              value={form.position}
              onChange={pickDepartment}
              list="member-departments"
              placeholder="e.g. Web Dev"
              required
            />
          )}
          <datalist id="member-departments">
            {departments.map((d) => (
              <option key={d.name} value={d.name} />
            ))}
          </datalist>

          {panel.action !== "end" &&
            panel.action !== "reactivate" &&
            panel.action !== "remove" && (
              <Input
                label="Designation"
                value={form.designation}
                onChange={(v) => set("designation", v)}
                placeholder="e.g. Lead"
                required={panel.action === "change-position"}
              />
            )}

          {(panel.action === "transfer" ||
            panel.action === "change-position" ||
            panel.action === "add" ||
            panel.action === "update") && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Show in position # (order)"
                type="number"
                min={0}
                value={form.rank}
                onChange={(v) => set("rank", v)}
                required={panel.action === "transfer"}
                hint="1 = shown first in the department"
              />
              {panel.action !== "change-position" && (
                <Input
                  label="Department order"
                  type="number"
                  min={0}
                  value={form.deptRank}
                  onChange={(v) => set("deptRank", v)}
                  required={needsDeptOrder}
                  hint={
                    targetDept
                      ? "Changing this re-orders the whole department"
                      : needsDeptOrder
                        ? "New department: where should it appear on the page?"
                        : "Order of the department on the page"
                  }
                />
              )}
            </div>
          )}

          {(panel.action === "transfer" ||
            panel.action === "change-position" ||
            panel.action === "add" ||
            panel.action === "update") && (
            <>
              {targetDept && targetDept.lineup.length > 0 && (
                <div className="text-xs rounded border border-border bg-background p-2">
                  <p className="font-medium text-foreground mb-1">
                    Current order in {targetDept.name}
                  </p>
                  <ol className="space-y-0.5 text-muted-foreground">
                    {targetDept.lineup.map((l) => (
                      <li key={l.roleId}>
                        {l.rank}. {l.name} — {l.designation || "Member"}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={form.shiftOthers}
                  onChange={(e) => set("shiftOthers", e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border"
                />
                If that place is taken, move the others down one
              </label>
            </>
          )}

          {panel.action === "update" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Started"
                type="date"
                value={form.startedAt}
                onChange={(v) => set("startedAt", v)}
              />
              <Input
                label="Ended"
                type="date"
                value={form.endedAt}
                onChange={(v) => set("endedAt", v)}
              />
            </div>
          )}

          {(panel.action === "transfer" ||
            panel.action === "change-position" ||
            panel.action === "add" ||
            panel.action === "end") && (
            <Input
              label="Effective date (optional, default today)"
              type="date"
              value={form.effectiveDate}
              onChange={(v) => set("effectiveDate", v)}
            />
          )}

          <Input
            label="Note (optional)"
            value={form.note}
            onChange={(v) => set("note", v)}
            placeholder="Reason, remarks…"
          />

          {panel.action === "update" && (
            <p className="text-[11px] text-muted-foreground">
              Use this to fix mistakes. To record a real move or promotion, use
              Transfer or Change position so the history keeps the old role.
            </p>
          )}
          {panel.action === "remove" && (
            <p className="text-[11px] text-red-700">
              This deletes the role entry. The removal is still recorded in the history.
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-xs font-medium"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              disabled={busy}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </form>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowHistory((s) => !s)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showHistory ? "Hide" : "Show"} history ({history.length})
        </button>
        {showHistory && (
          <ol className="mt-2 space-y-2 border-l border-border pl-3 max-h-[240px] overflow-y-auto">
            {history.length === 0 && (
              <li className="text-xs text-muted-foreground">No changes recorded yet.</li>
            )}
            {history.map((h) => (
              <li key={h.id} className="text-xs">
                <p className="font-medium text-foreground">
                  {HISTORY_LABELS[h.type] ?? h.type}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {day(h.effectiveDate)}
                  </span>
                </p>
                {(h.from || h.to) && (
                  <p className="text-muted-foreground">
                    {h.from && <>{describe(h.from)} (#{h.from.rank})</>}
                    {h.from && h.to && " → "}
                    {h.to && <>{describe(h.to)} (#{h.to.rank})</>}
                  </p>
                )}
                {h.note && <p className="text-muted-foreground italic">“{h.note}”</p>}
                {h.by && (h.by.name || h.by.email) && (
                  <p className="text-[10px] text-stone-500">
                    by {h.by.name || h.by.email} · {day(h.at)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function RoleRow({
  role,
  active,
  children,
}: {
  role: TeamMemberRole;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`p-2.5 rounded-md border ${
        active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30 opacity-80"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {role.designation || "Member"}
            <span className="text-muted-foreground font-normal">
              {" "}
              · {role.position || "No department"}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Order {role.rank} · Dept order {role.dept_rank} · {day(role.startedAt)}
            {role.endedAt ? ` → ${day(role.endedAt)}` : active ? " → present" : ""}
          </p>
          {role.note && (
            <p className="text-[11px] text-muted-foreground italic truncate">{role.note}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function RoleButton({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2 py-1 rounded border ${
        danger
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-border text-stone-700 hover:bg-stone-100"
      }`}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  hint,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type">) {
  return (
    <div>
      <label className="text-[10px] font-medium text-stone-500">{label}</label>
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {hint && <p className="mt-0.5 text-[10px] text-stone-500">{hint}</p>}
    </div>
  );
}
