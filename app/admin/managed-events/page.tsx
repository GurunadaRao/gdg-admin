"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Card, CardTitle } from "@/components/ui/card";
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
  Calendar,
  Plus,
  Search,
  Trash2,
  Pencil,
  Users,
  MapPin,
  Loader2,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  Clock,
  Mail,
} from "lucide-react";
import GoogleLoader from "@/components/GoogleLoader";
import type {
  ManagedEvent,
  EventStatus,
  EventType,
} from "@/lib/types/managed-event";
import { ManagedEventEditDialog } from "@/components/admin/ManagedEventEditDialog";
import { SendTicketsDialog } from "@/components/admin/SendTicketsDialog";

const STATUS_COLORS: Record<EventStatus, string> = {
  UPCOMING: "bg-blue-500",
  ONGOING: "bg-amber-500",
  COMPLETED: "bg-green-500",
};
const STATUS_LABELS: Record<EventStatus, string> = {
  UPCOMING: "Upcoming",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
};

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  try {
    const date =
      typeof d === "object" && (d as any)?._seconds
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
  return `${day}/${month}/${year}`;
}

function formatDateTime(d: string | null): string {
  const date = parseDate(d);
  if (!date) return "TBD";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

function ManagedEventsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | EventStatus>("all");
  const [filterType, setFilterType] = useState<"all" | EventType>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");

  // Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ManagedEvent | null>(null);

  // Send tickets dialog
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [ticketsEvent, setTicketsEvent] = useState<ManagedEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/managed-events");
      const json = await res.json();
      if (Array.isArray(json)) setEvents(json);
      else if (json.error) setError(json.error);
    } catch {
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user?.email) setCurrentUserEmail(d.user.email);
      })
      .catch(() => {});
  }, [fetchEvents]);

  // Auto-open edit form when navigated with ?edit=<id>
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || events.length === 0) return;
    const target = events.find((e) => e.eventId === editId);
    if (target) {
      openEdit(target);
      router.replace("/admin/managed-events");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, searchParams]);

  /* ──── dialog helpers ──── */

  function openCreate() {
    setEditingEvent(null);
    setFormOpen(true);
  }

  function openEdit(event: ManagedEvent) {
    setEditingEvent(event);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingEvent(null);
  }

  async function handleDelete(eventId: string) {
    setDeletingId(eventId);
    try {
      const res = await fetch(`/api/admin/managed-events/${eventId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.eventId !== eventId));
        setConfirmDeleteId(null);
      }
    } catch {
      console.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.venue.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || event.status === filterStatus;
    const matchesType = filterType === "all" || event.eventType === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Sort: Upcoming & Ongoing first, then Completed
  const STATUS_ORDER: Record<string, number> = {
    ONGOING: 0,
    UPCOMING: 1,
    COMPLETED: 2,
  };
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

  const activeEvents = sortedEvents.filter((e) => e.status !== "COMPLETED");
  const completedEvents = sortedEvents.filter((e) => e.status === "COMPLETED");

  const stats = [
    {
      title: "Total Events",
      value: events.length,
      description: "All managed events",
      icon: Calendar,
    },
    {
      title: "Upcoming",
      value: events.filter((e) => e.status === "UPCOMING").length,
      description: "Scheduled events",
      icon: CalendarPlus,
    },
    {
      title: "Ongoing",
      value: events.filter((e) => e.status === "ONGOING").length,
      description: "In progress",
      icon: Clock,
    },
    {
      title: "Completed",
      value: events.filter((e) => e.status === "COMPLETED").length,
      description: "Past events",
      icon: CalendarCheck,
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title="Managed Events" />

      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Event Management
            </h2>
            <p className="text-muted-foreground">
              Create and manage community events with registration tracking.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-sm"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{stat.title}:</span>
                <span className="font-semibold text-foreground">
                  {stat.value}
                </span>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events by title, description, or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as any)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="UPCOMING">Upcoming</SelectItem>
              <SelectItem value="ONGOING">Ongoing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as any)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="WORKSHOP">Workshop</SelectItem>
              <SelectItem value="HACKATHON">Hackathon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Events List */}
        <div className="space-y-6">
          {loading ? (
            <GoogleLoader message="Loading events..." />
          ) : error ? (
            <Card className="flex items-center justify-center p-12 bg-muted/20 border-dashed">
              <div className="text-center">
                <CalendarX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-xl font-medium text-muted-foreground">
                  {error}
                </p>
              </div>
            </Card>
          ) : sortedEvents.length === 0 ? (
            <Card className="flex items-center justify-center p-12 bg-muted/20 border-dashed">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-xl font-medium text-muted-foreground">
                  No events found.
                </p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  {searchQuery || filterStatus !== "all" || filterType !== "all"
                    ? "Try adjusting your filters."
                    : "Create your first managed event."}
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Active events (Upcoming & Ongoing) */}
              {activeEvents.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Active Events
                  </h3>
                  <div className="grid gap-4">
                    {activeEvents.map((event) => renderEventCard(event))}
                  </div>
                </div>
              )}

              {/* Completed events */}
              {completedEvents.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4" />
                    Completed Events
                  </h3>
                  <div className="grid gap-4">
                    {completedEvents.map((event) => renderEventCard(event))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ManagedEventEditDialog
        event={editingEvent}
        open={formOpen}
        onClose={closeForm}
        onSaved={() => {
          closeForm();
          fetchEvents();
        }}
        createdByEmail={currentUserEmail}
      />

      {ticketsEvent && (
        <SendTicketsDialog
          event={ticketsEvent}
          open={ticketsOpen}
          onOpenChange={(open) => {
            setTicketsOpen(open);
            if (!open) setTicketsEvent(null);
          }}
        />
      )}
    </div>
  );

  function renderEventCard(event: ManagedEvent) {
    return (
      <Card
        key={event.eventId}
        onClick={() => router.push(`/admin/managed-events/${event.eventId}`)}
        className="group relative transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-card cursor-pointer border border-border p-3"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Image — padded inside card with rounded corners */}
          <div className="relative w-full sm:w-48 md:w-56 flex-shrink-0 rounded-xl overflow-hidden bg-muted">
            <div className="aspect-square">
              {event.posterImage || event.bannerImage ? (
                <img
                  src={event.posterImage || event.bannerImage}
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
                  <Calendar className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 py-1 flex flex-col">
            {/* Row 1: Title + actions */}
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-1">
                {event.title}
              </CardTitle>
              <div
                className="flex items-center gap-0.5 flex-shrink-0 -mt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(event);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit event"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTicketsEvent(event);
                    setTicketsOpen(true);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Send Tickets via Email"
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>
                {confirmDeleteId === event.eventId ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(event.eventId)}
                      disabled={deletingId === event.eventId}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === event.eventId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Yes"
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(event.eventId)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete event"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Badges */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide text-white ${STATUS_COLORS[event.status] || "bg-zinc-500"}`}
              >
                {STATUS_LABELS[event.status] || event.status}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                {event.eventType}
              </span>
              {event.mode && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                  {event.mode}
                </span>
              )}
              {event.isRegistrationOpen && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20">
                  Registration Open
                </span>
              )}
            </div>

            {/* Row 3: Description */}
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
              {event.description || "No description provided."}
            </p>

            {/* Row 4: Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 text-primary/70" />
                <span>{formatDateTime(event.startDate)}</span>
              </div>
              {event.venue && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 text-primary/70" />
                  <span className="truncate max-w-[180px]">{event.venue}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3 h-3 text-primary/70" />
                <span>Max {event.maxParticipants || "∞"}</span>
              </div>
              {event.tags && event.tags.length > 0 && (
                <div className="flex gap-1 ml-auto">
                  {event.tags.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[9px] font-semibold uppercase tracking-wider"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }
}

export default function ManagedEventsPage() {
  return (
    <Suspense>
      <ManagedEventsContent />
    </Suspense>
  );
}
