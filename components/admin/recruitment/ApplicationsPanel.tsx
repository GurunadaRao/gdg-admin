"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Star,
  Inbox,
  FolderOpen,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import GoogleLoader from "@/components/GoogleLoader";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  STATUS_CLASSES,
} from "@/lib/recruitment";
import type {
  RecruitmentApplication,
  RecruitmentRole,
} from "@/lib/types/recruitment";
import { ApplicationDetailDialog } from "./ApplicationDetailDialog";

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ApplicationsPanel() {
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [roles, setRoles] = useState<RecruitmentRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("roleId", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/recruitment/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recruitment-applications.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, rolesRes] = await Promise.all([
        fetch("/api/recruitment/applications"),
        fetch("/api/recruitment/roles"),
      ]);
      const apps = await appsRes.json();
      const rls = await rolesRes.json();
      if (Array.isArray(apps)) setApplications(apps);
      else throw new Error(apps.error || "Failed to load applications");
      if (Array.isArray(rls)) setRoles(rls);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const roleTitleById = (id: string) => roles.find((r) => r.id === id)?.title ?? id;

  const filtered = applications.filter((a) => {
    if (roleFilter !== "all" && a.roleId !== roleFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.applicant.fullName ?? "").toLowerCase().includes(q) ||
      (a.userEmail ?? "").toLowerCase().includes(q)
    );
  });

  const counts = (status: string) =>
    applications.filter((a) => a.status === status).length;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / email…"
            className="w-64 pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]} ({counts(s)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2">
        {APPLICATION_STATUSES.filter((s) => counts(s) > 0).map((s) => (
          <span
            key={s}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              STATUS_CLASSES[s],
            )}
          >
            {STATUS_LABELS[s]}
            <span className="font-semibold">{counts(s)}</span>
          </span>
        ))}
      </div>

      {loading ? (
        <GoogleLoader message="Loading applications…" />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {filtered.map((app) => (
            <Card
              key={app.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => { setSelectedId(app.id); setDetailOpen(true); }}
            >
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  app.isRead ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                )}>
                  {(app.applicant.fullName ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {app.applicant.fullName}
                    {app.isStarred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {app.userEmail} · {roleTitleById(app.roleId)}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  {app.applicant.branch || "—"} · {app.applicant.yearOfStudy || "—"}
                </div>
                <span
                  className={cn(
                    "inline-block shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    STATUS_CLASSES[app.status],
                  )}
                >
                  {STATUS_LABELS[app.status]}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <FolderOpen className="mr-1 inline h-3.5 w-3.5" />
                  {fmtDate(app.submittedAt)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ApplicationDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appId={selectedId}
        roleTitle={selectedId ? roleTitleById(applications.find((a) => a.id === selectedId)?.roleId ?? "") : ""}
        onChanged={fetchAll}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
      <Inbox className="h-10 w-10" />
      <p className="font-medium">No applications match your filters</p>
      <p className="flex items-center gap-1 text-sm">
        <FileText className="h-3.5 w-3.5" /> Applications appear here once applicants submit.
      </p>
    </div>
  );
}