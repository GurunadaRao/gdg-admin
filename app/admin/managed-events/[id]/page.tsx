"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  Pencil,
  Loader2,
  Tag,
  Star,
  GraduationCap,
  Globe,
  Linkedin,
  Mail,
  Shield,
  MessageSquare,
  Mic,
  UserCheck,
  CalendarClock,
  Hash,
  Info,
  ExternalLink,
  CheckCircle,
  ClipboardList,
  Palette,
} from "lucide-react";
import GoogleLoader from "@/components/GoogleLoader";
import { ManagedEventEditDialog } from "@/components/admin/ManagedEventEditDialog";
import { SendTicketsDialog } from "@/components/admin/SendTicketsDialog";
import type { ManagedEvent, RegisteredMember } from "@/lib/types/managed-event";

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-blue-500",
  ONGOING: "bg-amber-500",
  COMPLETED: "bg-green-500",
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

export default function ManagedEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<ManagedEvent | null>(null);
  const [regCount, setRegCount] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/managed-events/${eventId}`);
      const data = await res.json();
      if (res.ok) {
        setEvent(data);
      } else {
        setError(data.error || "Event not found");
      }
    } catch {
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const fetchRegCounts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/managed-events/${eventId}/registrations`,
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setRegCount(data.length);
        setCheckedInCount(
          data.filter((r: RegisteredMember) => r.isCheckedIn).length,
        );
      }
    } catch {
      console.error("Failed to load registrations");
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
    fetchRegCounts();
  }, [fetchEvent, fetchRegCounts]);

  if (loading) return <GoogleLoader message="Loading event..." />;
  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-muted-foreground">
          {error || "Event not found"}
        </p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => router.push("/admin/managed-events")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  // Computed eligibility display
  const eligibleYears = (event.eligibilityCriteria?.yearOfGrad ?? [])
    .map((allowed: boolean, i: number) => (allowed ? `Year ${i + 1}` : null))
    .filter(Boolean) as string[];
  const eligibleDepts = event.eligibilityCriteria?.Dept ?? [];

  return (
    <div className="flex flex-col min-h-0">
      <PageHeader title={event.title} />

      <div className="flex-1 p-6 space-y-0">
        {/* ── Nav bar ── */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => router.push("/admin/managed-events")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Events
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                router.push(`/admin/managed-events/${eventId}/registrations`)
              }
            >
              <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Registrations
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTicketsOpen(true)}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Send Tickets
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="rounded-2xl overflow-hidden border border-border mb-5 bg-card">
          {/* Banner — full width, 16:9 */}
          {event.bannerImage ? (
            <div className="w-full overflow-hidden">
              <img
                src={event.bannerImage}
                alt="Banner"
                className="w-full object-cover block"
                style={{ aspectRatio: "16 / 9", maxHeight: "320px" }}
              />
            </div>
          ) : (
            <div
              className="w-full bg-muted/30 flex items-center justify-center text-xs text-muted-foreground/50"
              style={{ aspectRatio: "16 / 9", maxHeight: "320px" }}
            >
              No banner image
            </div>
          )}

          {/* Info strip */}
          <div className="relative px-5 pt-4 pb-4 border-t border-border">
            <div className="flex items-start gap-4">
              {/* Poster — small 1:1 square, pulled up to overlap the banner */}
              {event.posterImage && (
                <div className="shrink-0 -mt-16 w-28 h-28 rounded-xl overflow-hidden border-2 border-card shadow-md ring-1 ring-border">
                  <img
                    src={event.posterImage}
                    alt="Poster"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title + badges */}
              <div
                className={`flex-1 min-w-0 ${event.posterImage ? "" : "pt-0"}`}
              >
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide text-white ${STATUS_COLORS[event.status] || "bg-zinc-500"}`}
                  >
                    {event.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                    {event.eventType}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                    {event.mode}
                  </span>
                  {event.isRegistrationOpen && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      REG OPEN
                    </span>
                  )}
                </div>
                <h1 className="text-lg sm:text-xl font-bold leading-tight">
                  {event.title}
                </h1>
                {event.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Inline stat bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            {
              icon: Calendar,
              label: "Starts",
              value: formatDateTime(event.startDate),
              color: "text-primary",
              bg: "bg-primary/8",
            },
            {
              icon: CalendarClock,
              label: "Ends",
              value: formatDateTime(event.endDate),
              color: "text-violet-500",
              bg: "bg-violet-500/8",
            },
            {
              icon: MapPin,
              label: "Venue",
              value: event.venue || "TBD",
              color: "text-sky-500",
              bg: "bg-sky-500/8",
            },
            {
              icon: Users,
              label: "Mode / Type",
              value: `${event.mode} · ${event.eventType}`,
              color: "text-emerald-500",
              bg: "bg-emerald-500/8",
            },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-3 bg-card"
            >
              <div
                className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}
              >
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-sm font-semibold leading-tight truncate">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Registration Summary ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-5">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    event.isRegistrationOpen
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      : "bg-muted-foreground/30"
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold">
                    Registration is{" "}
                    {event.isRegistrationOpen ? "Open" : "Closed"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {event.registrationStart && event.registrationEnd
                      ? `${formatDateTime(event.registrationStart)} — ${formatDateTime(event.registrationEnd)}`
                      : event.registrationStart
                        ? `Opens ${formatDateTime(event.registrationStart)}`
                        : "No registration window configured"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-5 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold tabular-nums">{regCount}</span>
                  {event.maxParticipants > 0 && (
                    <span className="text-muted-foreground text-xs">
                      / {event.maxParticipants}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-semibold tabular-nums">
                    {checkedInCount}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    checked in
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={() =>
                  router.push(`/admin/managed-events/${eventId}/registrations`)
                }
              >
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Manage
                Registrations
              </Button>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* LEFT: meta cards */}
          <div className="lg:col-span-1 space-y-4">
            {/* Event Details */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Event Details
                </span>
              </div>
              <div className="divide-y divide-border">
                {(
                  [
                    ["Type", event.eventType],
                    ["Mode", event.mode],
                    [
                      "Max Capacity",
                      event.maxParticipants
                        ? String(event.maxParticipants)
                        : "Unlimited",
                    ],
                    ["Created By", event.createdBy || "–"],
                    ["Event Start", formatDateTime(event.startDate)],
                    ...(event.endDate
                      ? [
                          ["Event End", formatDateTime(event.endDate)] as [
                            string,
                            string,
                          ],
                        ]
                      : []),
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="text-muted-foreground text-xs flex-shrink-0">
                      {k}
                    </span>
                    <span className="font-medium text-xs text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Executive Board */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Executive Board
                </span>
              </div>
              <div className="divide-y divide-border">
                {(
                  [
                    ["Organiser", event.executiveBoard?.organiser],
                    ["Co-Organiser", event.executiveBoard?.coOrganiser],
                    ["Facilitator", event.executiveBoard?.facilitator],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="text-muted-foreground text-xs flex-shrink-0">
                      {k}
                    </span>
                    <span className="font-medium text-xs text-right">
                      {v || "–"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Eligibility */}
            {(eligibleYears.length > 0 || eligibleDepts.length > 0) && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Eligibility
                  </span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {eligibleYears.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">
                        Years
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {eligibleYears.map((y) => (
                          <span
                            key={y}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-primary/10 text-primary border border-primary/20"
                          >
                            {y}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {eligibleDepts.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">
                        Departments
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {eligibleDepts.map((d: string) => (
                          <span
                            key={d}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-border text-muted-foreground"
                          >
                            {d.replace(/&/g, "")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tags & Highlights */}
            {(event.tags?.length > 0 || event.keyHighlights?.length > 0) && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Tags & Highlights
                  </span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {event.tags?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Tags
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {event.tags.map((t: string) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 text-[11px] rounded-md bg-muted text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {event.keyHighlights?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                        <Star className="w-3 h-3" /> Highlights
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {event.keyHighlights.map((h: string) => (
                          <span
                            key={h}
                            className="px-2 py-0.5 text-[11px] rounded-md border border-border text-muted-foreground"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Theme Colors */}
            {event.Theme && event.Theme.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Theme Colors
                  </span>
                </div>
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {event.Theme.map((color: string, i: number) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div
                          className="w-10 h-10 rounded-lg border border-border shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-2 space-y-4">
            {/* Officials */}
            {event.eventOfficials?.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Officials
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {event.eventOfficials.length} total
                  </span>
                </div>
                <div className="p-4 grid gap-3 sm:grid-cols-2">
                  {event.eventOfficials.map((off: any, i: number) => (
                    <div
                      key={i}
                      className="flex gap-3 p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-border flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                        {off.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm leading-tight">
                            {off.name}
                          </p>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary/10 text-primary border border-primary/15">
                            {off.role}
                          </span>
                        </div>
                        {off.expertise && (
                          <p className="text-xs text-muted-foreground">
                            {off.expertise}
                          </p>
                        )}
                        {off.bio && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {off.bio}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-0.5">
                          {off.email && (
                            <a
                              href={`mailto:${off.email}`}
                              className="text-[11px] text-primary hover:underline flex items-center gap-1"
                            >
                              <Mail className="w-3 h-3" />
                              {off.email}
                            </a>
                          )}
                          {off.profileUrl && (
                            <a
                              href={off.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <Globe className="w-3 h-3" />
                              Profile
                            </a>
                          )}
                          {off.linkedinUrl && (
                            <a
                              href={off.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <Linkedin className="w-3 h-3" />
                              LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQs */}
            {event.faqs?.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    FAQs
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {event.faqs.length} questions
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {event.faqs.map((faq: any, i: number) => (
                    <div key={i} className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {faq.question}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rules */}
            {event.rules?.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Rules
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {event.rules.length} rules
                  </span>
                </div>
                <ol className="divide-y divide-border">
                  {event.rules.map((r: any, i: number) => (
                    <li key={i} className="flex gap-3 px-5 py-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {r.rule}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      <ManagedEventEditDialog
        event={event}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          fetchEvent();
        }}
      />

      <SendTicketsDialog
        event={event}
        open={ticketsOpen}
        onOpenChange={setTicketsOpen}
      />
    </div>
  );
}
