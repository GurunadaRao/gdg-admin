"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Search,
  CalendarDays,
  Users,
  LayoutGrid,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import GoogleLoader from "@/components/GoogleLoader";
import { cn } from "@/lib/utils";
import {
  ROLE_STATUSES,
  ROLE_STATUS_CLASSES,
} from "@/lib/recruitment";
import type { RecruitmentRole } from "@/lib/types/recruitment";

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function RolesPanel() {
  const [roles, setRoles] = useState<RecruitmentRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recruitment/roles");
      const json = await res.json();
      if (Array.isArray(json)) setRoles(json);
      else throw new Error(json.error || "Failed to load roles");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this role and ALL of its applications? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/recruitment/roles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete role");
      toast.success("Role deleted");
      fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = roles.filter((r) => {
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles…"
              className="w-56 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ROLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("-", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Link
          href="/admin/recruitment/create"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Role
        </Link>
      </div>

      {loading ? (
        <GoogleLoader message="Loading roles…" />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((role) => (
            <Card key={role.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: `${role.color}1A` }}
                    >
                      {role.icon || <ClipboardList className="h-5 w-5" style={{ color: role.color }} />}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{role.title}</CardTitle>
                      <p className="truncate text-xs text-muted-foreground">{role.fields.length} field{role.fields.length === 1 ? "" : "s"} · {role.sections.length} section{role.sections.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", ROLE_STATUS_CLASSES[role.status])}
                  >
                    {role.status.replace("-", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {role.description || "No description."}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {role.maxApplications == null ? "Unlimited" : `Max ${role.maxApplications}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {fmtDate(role.applicationStart)} → {fmtDate(role.applicationEnd)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/recruitment/${role.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </Link>
                  <Link
                    href={`/admin/recruitment/${role.id}/edit`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === role.id}
                    onClick={() => handleDelete(role.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {deletingId === role.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
      <LayoutGrid className="h-10 w-10" />
      <p className="font-medium">No recruitment roles</p>
      <p className="text-sm">Create your first role to start collecting applications.</p>
    </div>
  );
}