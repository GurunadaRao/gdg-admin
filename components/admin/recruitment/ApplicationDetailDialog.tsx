"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Star,
  Mail,
  Phone,
  User,
  Linkedin,
  Github,
  Link2,
  FileText,
  Trash2,
  History,
  ShieldCheck,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import GoogleLoader from "@/components/GoogleLoader";
import {
  STATUS_LABELS,
  STATUS_CLASSES,
  LEGAL_TRANSITIONS,
} from "@/lib/recruitment";
import type {
  ApplicationDetail,
  ApplicationStatus,
  RecruitmentReview,
  ReviewVerdict,
} from "@/lib/types/recruitment";

interface ApplicationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string | null;
  roleTitle: string;
  onChanged: () => void;
}

const VERDICTS: ReviewVerdict[] = ["pending", "shortlist", "reject", "waitlist"];

interface CriterionInput {
  technical: string;
  communication: string;
  portfolio: string;
  culturalFit: string;
}

const emptyCriteria: CriterionInput = {
  technical: "",
  communication: "",
  portfolio: "",
  culturalFit: "",
};

function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CRITERIA_LABELS: { key: keyof CriterionInput; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "communication", label: "Communication" },
  { key: "portfolio", label: "Portfolio" },
  { key: "culturalFit", label: "Cultural Fit" },
];

export function ApplicationDetailDialog({
  open,
  onOpenChange,
  appId,
  roleTitle,
  onChanged,
}: ApplicationDetailDialogProps) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState({ uid: "", name: "" });

  // Status transition form
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | null>(null);
  const [reason, setReason] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Review form
  const [reviewForm, setReviewForm] = useState<{
    editingId: string | null;
    score: string;
    criteria: CriterionInput;
    verdict: ReviewVerdict;
    strengths: string;
    weaknesses: string;
    comments: string;
  }>({
    editingId: null,
    score: "",
    criteria: emptyCriteria,
    verdict: "pending",
    strengths: "",
    weaknesses: "",
    comments: "",
  });

  useEffect(() => {
    if (open) {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => {
          if (d.authenticated) {
            setMe({ uid: d.user?.id ?? "", name: d.user?.email ?? "" });
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const loadDetail = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/recruitment/applications/${appId}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDetail(json);
      setNotes(json.notes ?? "");
      setNextStatus(null);
      setReason("");
      setReviewForm({
        editingId: null,
        score: "",
        criteria: emptyCriteria,
        verdict: "pending",
        strengths: "",
        weaknesses: "",
        comments: "",
      });
      if (!json.isRead) {
        fetch(`/api/recruitment/applications/${appId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        }).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load application");
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    if (open) loadDetail();
  }, [open, loadDetail]);

  const patch = async (body: Record<string, unknown>, successMsg: string) => {
    if (!appId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recruitment/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Update failed");
      }
      toast.success(successMsg);
      await loadDetail();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = () => {
    if (!nextStatus) return;
    patch(
      {
        status: nextStatus,
        reason,
        changedBy: me.uid || me.name || "admin",
      },
      `Moved to "${STATUS_LABELS[nextStatus]}"`,
    );
  };

  const handleSaveNotes = () => patch({ notes }, "Notes saved");

  const handleToggle = (key: "isRead" | "isStarred") => {
    if (!detail) return;
    patch({ [key]: !detail[key] }, key === "isRead" ? "Read toggled" : "Starred toggled");
  };

  const handleDelete = async () => {
    if (!appId) return;
    if (!window.confirm("Delete this application and its reviews/history?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recruitment/applications/${appId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Application deleted");
      onOpenChange(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const startEditReview = (r: RecruitmentReview) => {
    setReviewForm({
      editingId: r.id,
      score: r.score != null ? String(r.score) : "",
      criteria: {
        technical: r.criteria?.technical != null ? String(r.criteria.technical) : "",
        communication: r.criteria?.communication != null ? String(r.criteria.communication) : "",
        portfolio: r.criteria?.portfolio != null ? String(r.criteria.portfolio) : "",
        culturalFit: r.criteria?.culturalFit != null ? String(r.criteria.culturalFit) : "",
      },
      verdict: r.verdict,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
      comments: r.comments,
    });
  };

  const submitReview = () => {
    const toNum = (v: string) => (v === "" ? null : Math.min(10, Math.max(0, Number(v))));
    patch(
      {
        review: {
          id: reviewForm.editingId ?? undefined,
          reviewerId: me.uid || "admin",
          reviewerName: me.name || me.uid || "Admin",
          score: toNum(reviewForm.score),
          criteria: {
            technical: toNum(reviewForm.criteria.technical),
            communication: toNum(reviewForm.criteria.communication),
            portfolio: toNum(reviewForm.criteria.portfolio),
            culturalFit: toNum(reviewForm.criteria.culturalFit),
          },
          verdict: reviewForm.verdict,
          strengths: reviewForm.strengths,
          weaknesses: reviewForm.weaknesses,
          comments: reviewForm.comments,
        },
      },
      reviewForm.editingId ? "Review updated" : "Review saved",
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {loading || !detail ? (
          <>
            <DialogTitle className="sr-only">Loading application…</DialogTitle>
            <GoogleLoader message="Loading application…" />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5" />
                </span>
                <span>
                  <span className="block">{detail.applicant.fullName}</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {roleTitle || detail.roleId} · {detail.applicant.yearOfStudy || "—"} · {detail.applicant.branch || "—"}
                  </span>
                </span>
                <span
                  className={cn(
                    "ml-auto inline-block shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    STATUS_CLASSES[detail.status],
                  )}
                >
                  {STATUS_LABELS[detail.status]}
                </span>
              </DialogTitle>
              <DialogDescription>
                Submitted {fmtDateTime(detail.submittedAt)} · Updated {fmtDateTime(detail.updatedAt)}
              </DialogDescription>
            </DialogHeader>

            {/* ── Quick actions ── */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggle("isStarred")}
                className={detail.isStarred ? "text-amber-500" : ""}
              >
                <Star className={cn("h-4 w-4", detail.isStarred && "fill-amber-500")} />
                {detail.isStarred ? "Starred" : "Star"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggle("isRead")}
              >
                <CheckCheck className="h-4 w-4" />
                {detail.isRead ? "Marked read" : "Mark unread"}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={handleDelete} disabled={busy}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>

            {/* ── Status transition ── */}
            <Section title="Status transition">
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Move to</Label>
                  <Select
                    value={nextStatus ?? undefined}
                    onValueChange={(v) => setNextStatus(v as ApplicationStatus)}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder={`From ${STATUS_LABELS[detail.status]}…`} />
                    </SelectTrigger>
                    <SelectContent>
                      {LEGAL_TRANSITIONS[detail.status].length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No transitions from {STATUS_LABELS[detail.status]}
                        </SelectItem>
                      ) : (
                        LEGAL_TRANSITIONS[detail.status].map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Reason (shown in history)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Strong technical round, passed"
                  />
                </div>
                <Button size="sm" onClick={handleStatusChange} disabled={!nextStatus || busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Apply
                </Button>
              </div>
            </Section>

            {/* ── Applicant info ── */}
            <Section title="Applicant">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={detail.applicant.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={detail.applicant.phone || "—"} />
                <InfoRow label="Branch" value={detail.applicant.branch || "—"} />
                <InfoRow label="Year of study" value={detail.applicant.yearOfStudy || "—"} />
                <InfoRow label="Reviewer" value={detail.currentReviewer || "Unassigned"} />
                <InfoRow label="Status history count" value={String(detail.statusHistory?.length ?? 0)} />
              </div>

              {(Object.keys(detail.socialLinks ?? {}).length > 0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.socialLinks.linkedin && (
                    <a href={detail.socialLinks.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                    </a>
                  )}
                  {detail.socialLinks.github && (
                    <a href={detail.socialLinks.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Github className="h-3.5 w-3.5" /> GitHub
                    </a>
                  )}
                  {detail.socialLinks.portfolio && (
                    <a href={detail.socialLinks.portfolio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Link2 className="h-3.5 w-3.5" /> Portfolio
                    </a>
                  )}
                  {detail.socialLinks.gitRepoLink && (
                    <a href={detail.socialLinks.gitRepoLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Link2 className="h-3.5 w-3.5" /> Assignment repo
                    </a>
                  )}
                </div>
              )}

              {(detail.files?.resume || detail.files?.taskSubmission) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.files.resume && (
                    <a href={detail.files.resume.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                      <FileText className="h-3.5 w-3.5" /> Resume: {detail.files.resume.originalName || "open"}
                    </a>
                  )}
                  {detail.files.taskSubmission && (
                    <a href={detail.files.taskSubmission.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                      <FileText className="h-3.5 w-3.5" /> Task: {detail.files.taskSubmission.originalName || "open"}
                    </a>
                  )}
                </div>
              )}

              {Object.keys(detail.answers ?? {}).length > 0 && (
                <div className="mt-3 space-y-1.5 border-t pt-3">
                  <p className="text-sm font-medium">Responses</p>
                  {Object.entries(detail.answers ?? {}).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-3 text-sm">
                      <span className="shrink-0 text-muted-foreground">
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      <AnswerValue value={value} />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Reviewer assignment ── */}
            <Section title="Reviewer assignment">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    value={detail.currentReviewer ?? ""}
                    onChange={(e) => patch({ currentReviewer: e.target.value }, "Reviewer updated")}
                    placeholder="Assign reviewer (admin UID/email)…"
                  />
                </div>
              </div>
            </Section>

            {/* ── Notes ── */}
            <Section title="Notes">
              <div className="flex items-start gap-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Private admin notes…"
                  rows={3}
                />
                <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={busy}>
                  Save
                </Button>
              </div>
            </Section>

            {/* ── Reviews ── */}
            <Section
              title="Reviews"
              action={
                detail.reviews?.length ? (
                  <Button size="sm" variant="ghost" onClick={() => setReviewForm({ ...reviewForm, editingId: null })}>
                    + New review
                  </Button>
                ) : undefined
              }
            >
              {detail.reviews?.length ? (
                <div className="space-y-3">
                  {detail.reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.reviewerName || r.reviewerId}</span>
                        <div className="flex items-center gap-2">
                          {r.score != null && (
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                              {r.score}/10
                            </span>
                          )}
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.verdict}</span>
                          <Button size="sm" variant="ghost" onClick={() => startEditReview(r)}>
                            Edit
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {CRITERIA_LABELS.map((c) => (
                          <span key={c.key}>{c.label}: {r.criteria?.[c.key] ?? "—"}</span>
                        ))}
                      </div>
                      {(r.strengths || r.weaknesses || r.comments) && (
                        <div className="mt-2 space-y-1 text-xs">
                          {r.strengths && <p><strong>Strengths:</strong> {r.strengths}</p>}
                          {r.weaknesses && <p><strong>Weaknesses:</strong> {r.weaknesses}</p>}
                          {r.comments && <p><strong>Comments:</strong> {r.comments}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              )}

              <div className="mt-3 space-y-3 rounded-lg border border-dashed p-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Overall score (1–10)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={reviewForm.score}
                    onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })}
                    className="w-24"
                  />
                  <Label className="ml-2 text-xs text-muted-foreground">Verdict</Label>
                  <Select
                    value={reviewForm.verdict}
                    onValueChange={(v) => setReviewForm({ ...reviewForm, verdict: v as ReviewVerdict })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERDICTS.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CRITERIA_LABELS.map((c) => (
                    <div key={c.key} className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-28">{c.label}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={reviewForm.criteria[c.key]}
                        onChange={(e) =>
                          setReviewForm({ ...reviewForm, criteria: { ...reviewForm.criteria, [c.key]: e.target.value } })
                        }
                        className="w-24"
                      />
                    </div>
                  ))}
                </div>
                <Input
                  value={reviewForm.strengths}
                  onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })}
                  placeholder="Strengths"
                />
                <Input
                  value={reviewForm.weaknesses}
                  onChange={(e) => setReviewForm({ ...reviewForm, weaknesses: e.target.value })}
                  placeholder="Weaknesses"
                />
                <Textarea
                  value={reviewForm.comments}
                  onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                  placeholder="General comments"
                  rows={2}
                />
                <Button size="sm" onClick={submitReview} disabled={busy}>
                  {reviewForm.editingId ? "Update review" : "Save review"}
                </Button>
              </div>
            </Section>

            {/* ── Status history ── */}
            <Section title="Status history">
              {detail.statusHistory?.length ? (
                <ol className="relative ml-3 space-y-4 border-l pl-5">
                  {detail.statusHistory.map((h) => (
                    <li key={h.id} className="relative text-sm">
                      <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                        <History className="h-2.5 w-2.5 text-muted-foreground" />
                      </span>
                      <p className="font-medium">
                        {h.fromStatus === "none" ? "Submitted" : h.fromStatus} → {h.toStatus}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.reason || "—"} · {h.changedBy} · {fmtDateTime(h.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              )}
            </Section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="w-28 shrink-0 text-xs">{label}</span>
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}

function AnswerValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>;
  }
  if (typeof value === "string" || typeof value === "number") {
    return <span className="text-right font-medium">{String(value)}</span>;
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.url === "string") {
      return (
        <a href={rec.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {typeof rec.originalName === "string" && rec.originalName ? rec.originalName : "open file"}
        </a>
      );
    }
    return <span className="text-right text-muted-foreground break-all">{JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}