"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Users,
  Trash2,
  UserPlus,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Download,
  ToggleLeft,
  ToggleRight,
  Filter,
  UserRound,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Phone,
  GraduationCap,
  Globe,
  Github,
  Linkedin,
  Twitter,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Briefcase,
  FileText,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import GoogleLoader from "@/components/GoogleLoader";
import type {
  ManagedEvent,
  RegisteredMember,
  RegistrationType,
} from "@/lib/types/managed-event";

/* ── Client User type (from client_users collection) ── */
interface ClientUser {
  id: string;
  name: string;
  email: string;
  profileUrl: string;
  resumeUrl: string;
  phoneNumber: string;
  branch: string;
  graduationYear: number | null;
  role: string;
  isBlocked: boolean;
  profileCompleted: boolean;
  participations: string[];
  socialMedia: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    [key: string]: string | undefined;
  };
  createdAt: string | null;
  updatedAt: string | null;
}

/* ── SVG Donut Ring Component ── */

function DonutRing({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  color,
  bgColor = "hsl(var(--muted))",
  label,
  sublabel,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  bgColor?: string;
  label: string;
  sublabel: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums leading-none">
            {max > 0 ? Math.round(pct * 100) : 0}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  try {
    const date = typeof d === "object" && (d as any)?._seconds
      ? new Date((d as any)._seconds * 1000)
      : new Date(d);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDate(d: string | null): string {
  const date = parseDate(d);
  if (!date) return "TBD";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/* ── Page ── */

export default function RegistrationsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  /* ── State ── */
  const [event, setEvent] = useState<ManagedEvent | null>(null);
  const [registrations, setRegistrations] = useState<
    (RegisteredMember & { regId: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [regLoading, setRegLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add registration dialog
  const [showAddReg, setShowAddReg] = useState(false);
  const [addingReg, setAddingReg] = useState(false);
  const [regForm, setRegForm] = useState({
    userId: "",
    name: "",
    email: "",
    phone: "",
    registrationType: "Individual" as RegistrationType,
  });

  // User search for manual registration
  const [allClientUsers, setAllClientUsers] = useState<
    { id: string; name: string; email: string; phoneNumber: string; branch: string; profileUrl: string }[]
  >([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: string; name: string; email: string; phoneNumber: string; branch: string; profileUrl: string;
  } | null>(null);

  // Search & filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "Individual" | "Team">("all");
  const [checkInFilter, setCheckInFilter] = useState<"all" | "checked-in" | "not-checked-in">("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Actions
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteRegId, setConfirmDeleteRegId] = useState<string | null>(null);
  const [deletingRegId, setDeletingRegId] = useState<string | null>(null);
  const [togglingRegOpen, setTogglingRegOpen] = useState(false);
  const [bulkChecking, setBulkChecking] = useState(false);

  // Detail dialog
  const [detailReg, setDetailReg] = useState<(RegisteredMember & { regId: string }) | null>(null);
  const [detailUser, setDetailUser] = useState<ClientUser | null>(null);
  const [detailUserLoading, setDetailUserLoading] = useState(false);
  const [detailUserError, setDetailUserError] = useState<string | null>(null);

  // Fetch full user details when detail dialog opens
  useEffect(() => {
    if (!detailReg?.userId) {
      setDetailUser(null);
      setDetailUserError(null);
      return;
    }
    let cancelled = false;
    setDetailUserLoading(true);
    setDetailUserError(null);
    setDetailUser(null);
    fetch(`/api/admin/users/${detailReg.userId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("User not found");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setDetailUser(data);
      })
      .catch((err) => {
        if (!cancelled) setDetailUserError(err.message || "Failed to fetch user");
      })
      .finally(() => {
        if (!cancelled) setDetailUserLoading(false);
      });
    return () => { cancelled = true; };
  }, [detailReg?.userId]);

  /* ── Data fetching ── */

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/managed-events/${eventId}`);
      const data = await res.json();
      if (res.ok) setEvent(data);
      else setError(data.error || "Event not found");
    } catch {
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/managed-events/${eventId}/registrations`);
      const data = await res.json();
      if (Array.isArray(data)) setRegistrations(data);
    } catch {
      console.error("Failed to load registrations");
    } finally {
      setRegLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
    fetchRegistrations();
  }, [fetchEvent, fetchRegistrations]);

  // Eagerly fetch client users on mount (needed for branch stats & add-reg dialog)
  useEffect(() => {
    if (allClientUsers.length > 0) return;
    setLoadingUsers(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllClientUsers(data); })
      .catch(() => console.error("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, [allClientUsers.length]);

  /* ── Derived state ── */

  const registeredEmails = new Set(registrations.map((r) => r.email.toLowerCase()));
  const filteredUsers = userSearchQuery.trim().length >= 2
    ? allClientUsers.filter(
        (u) =>
          !registeredEmails.has(u.email.toLowerCase()) &&
          (u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
      )
    : [];

  const filteredRegs = registrations.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search);
    const matchesType = typeFilter === "all" || r.registrationType === typeFilter;
    const matchesCheckIn =
      checkInFilter === "all" ||
      (checkInFilter === "checked-in" ? r.isCheckedIn : !r.isCheckedIn);
    return matchesSearch && matchesType && matchesCheckIn;
  });

  const checkedInCount = registrations.filter((r) => r.isCheckedIn).length;
  const individualCount = registrations.filter((r) => r.registrationType === "Individual").length;
  const teamCount = registrations.filter((r) => r.registrationType === "Team").length;
  const capacityPercent = event?.maxParticipants ? Math.round((registrations.length / event.maxParticipants) * 100) : 0;
  const checkInPercent = registrations.length > 0 ? Math.round((checkedInCount / registrations.length) * 100) : 0;

  // Registration timeline – group by date for mini bar chart
  const timeline = useMemo(() => {
    if (registrations.length === 0) return [];
    const counts: Record<string, number> = {};
    registrations.forEach((r) => {
      if (!r.registeredAt) return;
      try {
        const d = typeof r.registeredAt === "object" && (r.registeredAt as any)?._seconds
          ? new Date((r.registeredAt as any)._seconds * 1000)
          : new Date(r.registeredAt);
        const key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        counts[key] = (counts[key] || 0) + 1;
      } catch { /* skip bad dates */ }
    });
    return Object.entries(counts).map(([date, count]) => ({ date, count }));
  }, [registrations]);
  const maxTimelineCount = Math.max(...timeline.map((t) => t.count), 1);

  // Branch-wise registration breakdown
  const branchStats = useMemo(() => {
    if (registrations.length === 0 || allClientUsers.length === 0) return [];
    const userBranchMap = new Map<string, string>();
    allClientUsers.forEach((u) => {
      if (u.branch) userBranchMap.set(u.id, u.branch);
    });
    const counts: Record<string, number> = {};
    registrations.forEach((r) => {
      const branch = userBranchMap.get(r.userId) || "Unknown";
      counts[branch] = (counts[branch] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count);
  }, [registrations, allClientUsers]);
  const maxBranchCount = Math.max(...branchStats.map((b) => b.count), 1);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRegs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRegs = filteredRegs.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, typeFilter, checkInFilter]);

  /* ── Handlers ── */

  async function handleAddRegistration() {
    if (!selectedUser) return;
    setAddingReg(true);
    try {
      const res = await fetch(`/api/admin/managed-events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          name: selectedUser.name,
          email: selectedUser.email,
          phone: selectedUser.phoneNumber || "",
          registrationType: regForm.registrationType,
        }),
      });
      if (res.ok) {
        setShowAddReg(false);
        setSelectedUser(null);
        setUserSearchQuery("");
        setRegForm({ userId: "", name: "", email: "", phone: "", registrationType: "Individual" });
        fetchRegistrations();
      }
    } catch {
      console.error("Failed to add registration");
    } finally {
      setAddingReg(false);
    }
  }

  async function handleToggleCheckIn(regId: string, current: boolean) {
    setTogglingId(regId);
    try {
      await fetch(`/api/admin/managed-events/${eventId}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCheckedIn: !current }),
      });
      fetchRegistrations();
    } catch {
      console.error("Failed to toggle check-in");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteRegistration(regId: string) {
    setDeletingRegId(regId);
    try {
      await fetch(`/api/admin/managed-events/${eventId}/registrations/${regId}`, { method: "DELETE" });
      setRegistrations((prev) => prev.filter((r) => r.regId !== regId));
      setConfirmDeleteRegId(null);
    } catch {
      console.error("Failed to delete registration");
    } finally {
      setDeletingRegId(null);
    }
  }

  async function handleToggleRegistration() {
    if (!event) return;
    setTogglingRegOpen(true);
    try {
      const res = await fetch(`/api/admin/managed-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRegistrationOpen: !event.isRegistrationOpen }),
      });
      if (res.ok) fetchEvent();
    } catch {
      console.error("Failed to toggle registration");
    } finally {
      setTogglingRegOpen(false);
    }
  }

  async function handleBulkCheckIn() {
    const unchecked = filteredRegs.filter((r) => !r.isCheckedIn);
    if (unchecked.length === 0) return;
    setBulkChecking(true);
    try {
      await Promise.all(
        unchecked.map((r) =>
          fetch(`/api/admin/managed-events/${eventId}/registrations/${r.regId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isCheckedIn: true }),
          })
        )
      );
      fetchRegistrations();
    } catch {
      console.error("Failed to bulk check-in");
    } finally {
      setBulkChecking(false);
    }
  }

  function handleExportCSV() {
    if (registrations.length === 0) return;
    const userBranchMap = new Map<string, string>();
    allClientUsers.forEach((u) => {
      if (u.branch) userBranchMap.set(u.id, u.branch);
    });
    const headers = ["#", "User ID", "Name", "Email", "Phone", "Branch", "Type", "Registered At", "Checked In", "Checked In At"];
    const rows = registrations.map((r, i) => [
      String(i + 1),
      r.userId || "-",
      r.name,
      r.email,
      r.phone || "-",
      userBranchMap.get(r.userId) || "-",
      r.registrationType,
      r.registeredAt ? formatDate(r.registeredAt) : "-",
      r.isCheckedIn ? "Yes" : "No",
      r.checkedInAt ? formatDate(r.checkedInAt) : "-",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${event?.title?.replace(/\s+/g, "-").toLowerCase() || eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Loading / Error states ── */

  if (loading) return <GoogleLoader message="Loading event..." />;
  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-muted-foreground">{error || "Event not found"}</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/admin/managed-events")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="flex flex-col min-h-0">
      <PageHeader title="Registration Management" />

      <div className="flex-1 p-6 space-y-6">

        {/* ── Nav bar ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(`/admin/managed-events/${eventId}`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {event.title}
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleExportCSV}
              disabled={registrations.length === 0}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => setShowAddReg(true)}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add Registration
            </Button>
          </div>
        </div>

        {/* ── Registration Status & Toggle ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                event.isRegistrationOpen
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  : "bg-muted-foreground/30"
              }`} />
              <div>
                <p className="text-sm font-semibold">
                  Registration is {event.isRegistrationOpen ? "Open" : "Closed"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.registrationStart && event.registrationEnd
                    ? `${formatDate(event.registrationStart)} — ${formatDate(event.registrationEnd)}`
                    : event.registrationStart
                      ? `Opens ${formatDate(event.registrationStart)}`
                      : "No registration window configured"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={event.isRegistrationOpen ? "destructive" : "default"}
              onClick={handleToggleRegistration}
              disabled={togglingRegOpen}
              className="h-8 text-xs shrink-0"
            >
              {togglingRegOpen ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : event.isRegistrationOpen ? (
                <ToggleRight className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
              )}
              {event.isRegistrationOpen ? "Close Registration" : "Open Registration"}
            </Button>
          </div>
        </div>

        {/* ── Analytics Dashboard ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">Registration Analytics</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span><strong className="text-foreground">{registrations.length}</strong> registered</span>
              <span className="w-px h-3 bg-border" />
              <span><strong className="text-foreground">{checkedInCount}</strong> checked in</span>
              <span className="w-px h-3 bg-border" />
              <span><strong className="text-foreground">{individualCount}</strong> individual</span>
              <span className="w-px h-3 bg-border" />
              <span><strong className="text-foreground">{teamCount}</strong> team</span>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.5fr] gap-6">

            {/* ─ Left: Donut Rings ─ */}
            <div className="flex items-center justify-center gap-8">
              <DonutRing
                value={registrations.length}
                max={event.maxParticipants || registrations.length || 1}
                color={capacityPercent > 90 ? "#ef4444" : capacityPercent > 70 ? "#f59e0b" : "#10b981"}
                label="Capacity"
                sublabel={`${registrations.length}${event.maxParticipants > 0 ? ` / ${event.maxParticipants}` : ""} slots`}
              />
              <DonutRing
                value={checkedInCount}
                max={registrations.length || 1}
                color="#10b981"
                label="Check-in"
                sublabel={`${checkedInCount} of ${registrations.length}`}
              />
            </div>

            {/* ─ Center: Type Breakdown ─ */}
            <div className="flex flex-col justify-center gap-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Registration Type Split</p>

              {/* Stacked horizontal bar */}
              <div className="space-y-2">
                <div className="h-5 rounded-full overflow-hidden bg-muted flex">
                  {registrations.length > 0 && (
                    <>
                      <div
                        className="h-full bg-blue-500 transition-all duration-500 flex items-center justify-center"
                        style={{ width: `${(individualCount / registrations.length) * 100}%` }}
                      >
                        {individualCount > 0 && (
                          <span className="text-[9px] font-bold text-white px-1 truncate">{Math.round((individualCount / registrations.length) * 100)}%</span>
                        )}
                      </div>
                      <div
                        className="h-full bg-violet-500 transition-all duration-500 flex items-center justify-center"
                        style={{ width: `${(teamCount / registrations.length) * 100}%` }}
                      >
                        {teamCount > 0 && (
                          <span className="text-[9px] font-bold text-white px-1 truncate">{Math.round((teamCount / registrations.length) * 100)}%</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                    <span className="text-xs text-muted-foreground">Individual</span>
                    <span className="text-xs font-bold tabular-nums">{individualCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                    <span className="text-xs text-muted-foreground">Team</span>
                    <span className="text-xs font-bold tabular-nums">{teamCount}</span>
                  </div>
                </div>
              </div>

              {/* Check-in breakdown mini bars */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Check-in Status</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">Checked In</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${checkInPercent}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold tabular-nums w-8 text-right">{checkedInCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">Pending</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${registrations.length > 0 ? 100 - checkInPercent : 0}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold tabular-nums w-8 text-right">{registrations.length - checkedInCount}</span>
                </div>
              </div>
            </div>

            {/* ─ Right: Registration Timeline ─ */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Registration Timeline</p>
              {timeline.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/40">
                  No registrations yet
                </div>
              ) : (
                <div className="flex-1 flex items-end gap-1 min-h-[100px]">
                  {timeline.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
                      {/* Tooltip */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-foreground text-background text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {t.count} reg{t.count !== 1 ? "s" : ""}
                      </div>
                      {/* Bar */}
                      <div
                        className="w-full rounded-t-sm bg-primary/80 hover:bg-primary transition-all duration-300 min-h-[4px]"
                        style={{
                          height: `${Math.max(8, (t.count / maxTimelineCount) * 90)}%`,
                        }}
                      />
                      {/* Label */}
                      <span className="text-[8px] text-muted-foreground/60 leading-none truncate w-full text-center">{t.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Branch-wise Registration Breakdown ── */}
          <div className="px-5 pb-5">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Branch-wise Registrations</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{branchStats.length} branches</span>
              </div>
              {branchStats.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/40">
                  {loadingUsers ? "Loading branch data..." : registrations.length === 0 ? "No registrations yet" : "No branch data available"}
                </div>
              ) : (
                <div className="space-y-2">
                  {branchStats.map((b) => {
                    const pct = registrations.length > 0 ? Math.round((b.count / registrations.length) * 100) : 0;
                    return (
                      <div key={b.branch} className="flex items-center gap-3 group">
                        <span className="text-xs font-medium text-muted-foreground w-20 shrink-0 truncate" title={b.branch}>{b.branch}</span>
                        <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-md bg-primary/70 group-hover:bg-primary transition-all duration-500 flex items-center justify-end"
                            style={{ width: `${Math.max(8, (b.count / maxBranchCount) * 100)}%` }}
                          >
                            <span className="text-[9px] font-bold text-primary-foreground px-2 truncate">{b.count}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Registrations Table ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Filters bar */}
          <div className="px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-border bg-muted/20">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "Individual" | "Team")}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Team">Team</SelectItem>
                </SelectContent>
              </Select>
              <Select value={checkInFilter} onValueChange={(v) => setCheckInFilter(v as "all" | "checked-in" | "not-checked-in")}>
                <SelectTrigger className="h-8 text-xs w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="checked-in">Checked In</SelectItem>
                  <SelectItem value="not-checked-in">Not Checked In</SelectItem>
                </SelectContent>
              </Select>
              {filteredRegs.length > 0 && filteredRegs.some((r) => !r.isCheckedIn) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkCheckIn}
                  disabled={bulkChecking}
                  className="h-8 text-xs"
                >
                  {bulkChecking ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Check In All ({filteredRegs.filter((r) => !r.isCheckedIn).length})
                </Button>
              )}
            </div>
          </div>

          {/* Table content */}
          {regLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" /> Loading registrations…
            </div>
          ) : filteredRegs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-15" />
              <p className="text-sm font-medium">
                {search || typeFilter !== "all" || checkInFilter !== "all"
                  ? "No registrations match your filters."
                  : "No registrations yet."}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {search || typeFilter !== "all" || checkInFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : 'Click "Add Registration" to manually register a participant.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs w-10 text-center">#</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Phone</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Registered</TableHead>
                    <TableHead className="text-xs text-center">Check-in</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Checked In At</TableHead>
                    <TableHead className="text-xs text-right w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRegs.map((reg, idx) => (
                    <TableRow
                      key={reg.regId || `reg-${idx}`}
                      className="text-sm group cursor-pointer"
                      onClick={() => setDetailReg(reg)}
                    >
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums py-2.5">
                        {(safePage - 1) * pageSize + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {reg.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <span className="truncate max-w-[150px]">{reg.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-2.5 text-xs">{reg.email}</TableCell>
                      <TableCell className="text-muted-foreground py-2.5 font-mono text-xs hidden md:table-cell">
                        {reg.phone || "–"}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                          reg.registrationType === "Team"
                            ? "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400"
                            : "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
                        }`}>
                          {reg.registrationType}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2.5 hidden lg:table-cell">
                        {formatDate(reg.registeredAt)}
                      </TableCell>
                      <TableCell className="text-center py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleCheckIn(reg.regId, reg.isCheckedIn); }}
                          disabled={togglingId === reg.regId}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors"
                          title={reg.isCheckedIn ? "Mark as not checked in" : "Mark as checked in"}
                        >
                          {togglingId === reg.regId ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : reg.isCheckedIn ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground/30 hover:text-muted-foreground/60" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2.5 hidden lg:table-cell">
                        {reg.isCheckedIn && reg.checkedInAt ? formatDate(reg.checkedInAt) : "–"}
                      </TableCell>
                      <TableCell className="text-right py-2.5" onClick={(e) => e.stopPropagation()}>
                        {confirmDeleteRegId === reg.regId ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDeleteRegistration(reg.regId)}
                              disabled={deletingRegId === reg.regId}
                              className="px-2 py-0.5 bg-red-600 text-white rounded text-[11px] hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingRegId === reg.regId ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                            </button>
                            <button onClick={() => setConfirmDeleteRegId(null)} className="px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteRegId(reg.regId)}
                            className="p-1 rounded text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Table footer with pagination */}
          {!regLoading && (
            <div className="px-5 py-3 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Showing {filteredRegs.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRegs.length)} of {filteredRegs.length}
                  {filteredRegs.length !== registrations.length && (
                    <span className="text-muted-foreground/50"> (filtered from {registrations.length})</span>
                  )}
                </span>
                {(typeFilter !== "all" || checkInFilter !== "all" || search) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => { setSearch(""); setTypeFilter("all"); setCheckInFilter("all"); }}
                  >
                    <Filter className="mr-1 h-2.5 w-2.5" /> Clear Filters
                  </Button>
                )}
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-2">
                  <span className="text-[10px] text-muted-foreground">Rows:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-7 w-[60px] text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <span className="text-[11px] text-muted-foreground tabular-nums mr-1">
                  Page {safePage} of {totalPages}
                </span>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage <= 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="First page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Page number buttons */}
                  {(() => {
                    const pages: number[] = [];
                    const start = Math.max(1, safePage - 2);
                    const end = Math.min(totalPages, safePage + 2);
                    for (let i = start; i <= end; i++) pages.push(i);
                    return pages.map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${
                          p === safePage
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ));
                  })()}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage >= totalPages}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Last page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Registration Detail Dialog ── */}
      <Dialog open={!!detailReg} onOpenChange={(open) => { if (!open) setDetailReg(null); }}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Registration Details</DialogTitle>
          {detailReg && (
            <>
              {/* ── Header ── */}
              <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-border">
                {/* Avatar */}
                {detailUser?.profileUrl ? (
                  <img
                    src={detailUser.profileUrl}
                    alt={detailReg.name}
                    className="w-14 h-14 rounded-full object-cover ring-1 ring-border shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground ring-1 ring-border shrink-0">
                    {detailReg.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}

                {/* Name + badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold truncate">{detailReg.name}</h3>
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${
                      detailReg.registrationType === "Team"
                        ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20"
                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                    }`}>
                      {detailReg.registrationType}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border ${
                      detailReg.isCheckedIn
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {detailReg.isCheckedIn ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {detailReg.isCheckedIn ? "Checked In" : "Not Checked In"}
                    </span>
                    {detailUser?.isBlocked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                        <ShieldAlert className="w-3 h-3" /> Blocked
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{detailReg.email}</p>
                  {detailUser && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{detailUser.role}</Badge>
                      {detailUser.profileCompleted && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-500/20">Profile Complete</Badge>
                      )}
                      {detailUser.branch && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{detailUser.branch}</Badge>
                      )}
                      {detailUser.graduationYear && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{detailUser.graduationYear}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Body: two-column layout ── */}
              <div className="overflow-y-auto max-h-[calc(85vh-180px)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:divide-x divide-border">

                  {/* Left column — Registration Info */}
                  <div className="px-6 py-4 space-y-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Registration Info</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted-foreground">Reg. Phone</span>
                        <span className="text-sm font-medium font-mono">{detailReg.phone || "–"}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted-foreground">Type</span>
                        <span className="text-sm font-medium">{detailReg.registrationType}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted-foreground">Registered At</span>
                        <span className="text-sm font-medium">{formatDate(detailReg.registeredAt)}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted-foreground">Check-In</span>
                        <span className="text-sm font-medium flex items-center gap-1.5">
                          {detailReg.isCheckedIn ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" />}
                          {detailReg.isCheckedIn ? "Yes" : "No"}
                        </span>
                      </div>
                      {detailReg.isCheckedIn && detailReg.checkedInAt && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-xs text-muted-foreground">Checked In At</span>
                            <span className="text-sm font-medium">{formatDate(detailReg.checkedInAt)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right column — User Profile */}
                  <div className="px-6 py-4 space-y-3 border-t sm:border-t-0 border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">User Profile</p>

                    {detailUserLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading...</span>
                      </div>
                    ) : detailUserError ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center">
                        <p className="text-sm text-muted-foreground">Profile unavailable</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">User may have been deleted</p>
                      </div>
                    ) : detailUser ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" /> Phone</span>
                          <span className="text-sm font-medium font-mono">{detailUser.phoneNumber || "–"}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email</span>
                          <span className="text-sm font-medium truncate max-w-[180px]">{detailUser.email}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> Branch</span>
                          <span className="text-sm font-medium">{detailUser.branch || "–"}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> Grad. Year</span>
                          <span className="text-sm font-medium">{detailUser.graduationYear || "–"}</span>
                        </div>

                        {/* Social links */}
                        {detailUser.socialMedia && Object.keys(detailUser.socialMedia).some(k => detailUser.socialMedia[k]) && (
                          <>
                            <Separator />
                            <div className="py-1.5">
                              <span className="text-xs text-muted-foreground">Social</span>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {detailUser.socialMedia.linkedin && (
                                  <a href={detailUser.socialMedia.linkedin} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 transition-colors">
                                    <Linkedin className="w-3 h-3" /> LinkedIn <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                                  </a>
                                )}
                                {detailUser.socialMedia.github && (
                                  <a href={detailUser.socialMedia.github} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 transition-colors">
                                    <Github className="w-3 h-3" /> GitHub <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                                  </a>
                                )}
                                {detailUser.socialMedia.twitter && (
                                  <a href={detailUser.socialMedia.twitter} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 transition-colors">
                                    <Twitter className="w-3 h-3" /> Twitter <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Resume */}
                        {detailUser.resumeUrl && (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="w-3 h-3" /> Resume</span>
                              <a href={detailUser.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </>
                        )}

                        <Separator />
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3 h-3" /> Participations</span>
                          <span className="text-sm font-medium">{detailUser.participations?.length || 0} event{(detailUser.participations?.length || 0) !== 1 ? "s" : ""}</span>
                        </div>

                        {/* Timestamps */}
                        {(detailUser.createdAt || detailUser.updatedAt) && (
                          <>
                            <Separator />
                            <div className="flex items-center gap-3 py-1.5 text-[10px] text-muted-foreground">
                              {detailUser.createdAt && <span>Joined {formatDate(detailUser.createdAt)}</span>}
                              {detailUser.updatedAt && <span>· Updated {formatDate(detailUser.updatedAt)}</span>}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ID</span>
                  <code className="text-[11px] font-mono text-muted-foreground">{detailReg.userId}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      const regId = detailReg.regId;
                      setDetailReg(null);
                      setConfirmDeleteRegId(regId);
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                  <Button
                    size="sm"
                    variant={detailReg.isCheckedIn ? "outline" : "default"}
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      handleToggleCheckIn(detailReg.regId, detailReg.isCheckedIn);
                      setDetailReg(null);
                    }}
                  >
                    {detailReg.isCheckedIn ? (
                      <><XCircle className="mr-1.5 h-3.5 w-3.5" /> Undo Check-In</>
                    ) : (
                      <><CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Check In</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Registration Dialog ── */}
      <Dialog open={showAddReg} onOpenChange={(open) => {
        setShowAddReg(open);
        if (!open) { setSelectedUser(null); setUserSearchQuery(""); }
      }}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Add Registration</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Search and select a user from the system to register for {event.title}.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-2">
            {selectedUser ? (
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-border bg-muted/40">
                <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                  {selectedUser.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-tight truncate">{selectedUser.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{selectedUser.email}</p>
                </div>
                {selectedUser.branch && (
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted text-muted-foreground border border-border">
                    {selectedUser.branch}
                  </span>
                )}
                <button
                  onClick={() => { setSelectedUser(null); setUserSearchQuery(""); }}
                  className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
                  title="Change user"
                >
                  <XCircle className="w-4 h-4 text-muted-foreground/60 hover:text-foreground" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                  <Input
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name or email…"
                    className="pl-9 h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="max-h-[220px] overflow-y-auto divide-y divide-border">
                    {loadingUsers ? (
                      <div className="flex items-center justify-center gap-2 py-8">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Loading users…</span>
                      </div>
                    ) : userSearchQuery.trim().length < 2 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-1">
                        <Search className="w-5 h-5 text-muted-foreground/30" />
                        <span className="text-xs text-muted-foreground/60">Type at least 2 characters to search</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-1">
                        <Users className="w-5 h-5 text-muted-foreground/30" />
                        <span className="text-xs text-muted-foreground/60">No matching users found</span>
                      </div>
                    ) : (
                      filteredUsers.slice(0, 20).map((u) => (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 outline-none"
                        >
                          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                            {u.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium leading-tight truncate">{u.name}</p>
                            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{u.email}</p>
                          </div>
                          {u.branch && (
                            <span className="shrink-0 text-[10px] text-muted-foreground/70">{u.branch}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  {filteredUsers.length > 0 && (
                    <div className="px-3 py-1.5 bg-muted/30 border-t border-border">
                      <span className="text-[10px] text-muted-foreground/60">
                        {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
                        {filteredUsers.length > 20 ? " · showing first 20" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedUser && (
              <div className="mt-4 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Registration Type</Label>
                <Select value={regForm.registrationType} onValueChange={(v) => setRegForm((p) => ({ ...p, registrationType: v as RegistrationType }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Team">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 mt-2 border-t border-border bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => { setShowAddReg(false); setSelectedUser(null); setUserSearchQuery(""); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 px-4 text-xs"
              onClick={handleAddRegistration}
              disabled={addingReg || !selectedUser}
            >
              {addingReg ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
              Register
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
