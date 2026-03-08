"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Send,
  Users,
  Loader2,
  CheckCircle,
  XCircle,
  User,
  FlaskConical,
} from "lucide-react";
import type { ManagedEvent, RegisteredMember } from "@/lib/types/managed-event";

interface SendTicketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ManagedEvent;
}

type SendResult = { status: "success" | "error"; message: string };

function formatDateForTicket(d: string | null): string {
  if (!d) return "TBD";
  try {
    const date =
      typeof d === "object" && (d as any)?._seconds
        ? new Date((d as any)._seconds * 1000)
        : new Date(d);
    if (isNaN(date.getTime())) return "TBD";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "TBD";
  }
}

export function SendTicketsDialog({
  open,
  onOpenChange,
  event,
}: SendTicketsDialogProps) {
  const [registrations, setRegistrations] = useState<RegisteredMember[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Single ticket fields
  const [singleEmail, setSingleEmail] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleUserId, setSingleUserId] = useState("");

  // Mode: "single" | "bulk" | "test"
  const [mode, setMode] = useState<"single" | "bulk" | "test">("bulk");

  const eventDate = formatDateForTicket(event.startDate);

  const fetchRegistrations = useCallback(async () => {
    setLoadingRegs(true);
    try {
      const res = await fetch(
        `/api/admin/managed-events/${event.eventId}/registrations`
      );
      const data = await res.json();
      if (Array.isArray(data)) setRegistrations(data);
    } catch {
      console.error("Failed to load registrations");
    } finally {
      setLoadingRegs(false);
    }
  }, [event.eventId]);

  useEffect(() => {
    if (open) {
      fetchRegistrations();
      setResult(null);
      setSingleEmail("");
      setSingleName("");
      setSingleUserId("");
    }
  }, [open, fetchRegistrations]);

  const sendSingleTicket = async () => {
    if (!singleEmail || !singleName) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendSingleTicket",
          mail: singleEmail,
          name: singleName,
          date: eventDate,
          eventName: event.title,
          userId: singleUserId || singleEmail,
        }),
      });
      const data: SendResult = await res.json();
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Network error" });
    } finally {
      setSending(false);
    }
  };

  const sendBulkTickets = async () => {
    setSending(true);
    setResult(null);
    try {
      // Send tickets one-by-one to each registered member
      let successCount = 0;
      let failCount = 0;

      for (const reg of registrations) {
        try {
          const res = await fetch("/api/admin/send-tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sendSingleTicket",
              mail: reg.email,
              name: reg.name,
              date: eventDate,
              eventName: event.title,
              userId: reg.userId,
            }),
          });
          const data = await res.json();
          if (data.status === "success") successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }

      setResult({
        status: failCount === 0 ? "success" : "error",
        message:
          failCount === 0
            ? `All ${successCount} tickets sent successfully!`
            : `${successCount} sent, ${failCount} failed`,
      });
    } catch {
      setResult({ status: "error", message: "Bulk send failed" });
    } finally {
      setSending(false);
    }
  };

  const runTestSingleTicket = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "testSingleTicket" }),
      });
      const data: SendResult = await res.json();
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Network error" });
    } finally {
      setSending(false);
    }
  };

  const runTestBulkTickets = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "testSendTicketsFromSheet",
          eventName: event.title,
          eventDate,
        }),
      });
      const data: SendResult = await res.json();
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Network error" });
    } finally {
      setSending(false);
    }
  };

  const selectRegistrant = (reg: RegisteredMember) => {
    setSingleEmail(reg.email);
    setSingleName(reg.name);
    setSingleUserId(reg.userId);
    setMode("single");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Send Tickets
          </DialogTitle>
          <DialogDescription>
            Send event tickets for <strong>{event.title}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Event info strip */}
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm space-y-0.5">
          <p className="font-semibold">{event.title}</p>
          <p className="text-muted-foreground text-xs">
            Date: {eventDate} &middot; Venue: {event.venue || "TBD"}
          </p>
          <p className="text-muted-foreground text-xs">
            {registrations.length} registered participants
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "bulk" ? "default" : "outline"}
            onClick={() => setMode("bulk")}
            className="flex-1"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" /> Bulk Send
          </Button>
          <Button
            size="sm"
            variant={mode === "single" ? "default" : "outline"}
            onClick={() => setMode("single")}
            className="flex-1"
          >
            <User className="mr-1.5 h-3.5 w-3.5" /> Single Ticket
          </Button>
          <Button
            size="sm"
            variant={mode === "test" ? "default" : "outline"}
            onClick={() => setMode("test")}
            className="flex-1"
          >
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Test
          </Button>
        </div>

        <Separator />

        {mode === "single" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-name" className="text-xs">
                Recipient Name
              </Label>
              <Input
                id="ticket-name"
                placeholder="Enter name"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-email" className="text-xs">
                Recipient Email
              </Label>
              <Input
                id="ticket-email"
                type="email"
                placeholder="Enter email"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-userid" className="text-xs">
                User ID{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ticket-userid"
                placeholder="User ID"
                value={singleUserId}
                onChange={(e) => setSingleUserId(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={sending || !singleEmail || !singleName}
              onClick={sendSingleTicket}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {sending ? "Sending..." : "Send Ticket"}
            </Button>

            {/* Quick-pick from registrations */}
            {registrations.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Or pick from registrations:
                </p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {registrations.map((reg) => (
                    <button
                      key={reg.userId}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm flex items-center justify-between gap-2"
                      onClick={() => selectRegistrant(reg)}
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{reg.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {reg.email}
                        </p>
                      </div>
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "bulk" && (
          <div className="space-y-3">
            {loadingRegs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading registrations...
                </span>
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No registrations found for this event.
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-sm font-medium">
                    {registrations.length} recipients will receive tickets
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tickets will be sent to all registered participants.
                  </p>
                </div>

                {/* Preview of recipients */}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {registrations.map((reg) => (
                    <div
                      key={reg.userId}
                      className="px-3 py-2 text-sm flex items-center gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{reg.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {reg.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {reg.registrationType}
                      </Badge>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  disabled={sending || registrations.length === 0}
                  onClick={sendBulkTickets}
                >
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {sending
                    ? "Sending tickets..."
                    : `Send Tickets to All (${registrations.length})`}
                </Button>
              </>
            )}
          </div>
        )}

        {mode === "test" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">Test Ticket Sending</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run test actions to verify ticket delivery without affecting real participants.
              </p>
            </div>

            <Button
              className="w-full"
              variant="outline"
              disabled={sending}
              onClick={runTestSingleTicket}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              {sending ? "Running..." : "Test Single Ticket"}
            </Button>

            <Button
              className="w-full"
              variant="outline"
              disabled={sending}
              onClick={runTestBulkTickets}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              {sending ? "Running..." : `Test Bulk Tickets (${event.title})`}
            </Button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              result.status === "success"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
            }`}
          >
            {result.status === "success" ? (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <p>{result.message}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
