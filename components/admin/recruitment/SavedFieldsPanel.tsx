"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import GoogleLoader from "@/components/GoogleLoader";
import type {
  FieldType,
  RecruitmentFieldTemplate,
} from "@/lib/types/recruitment";

const FIELD_TYPES: FieldType[] = [
  "text",
  "email",
  "tel",
  "url",
  "number",
  "select",
  "file",
  "checkbox",
  "info",
];

type Draft = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  optionsText: string;
  accept: string;
  maxSizeMB: string;
  extensionsText: string;
  checkboxLabel: string;
  minLength: string;
  maxLength: string;
  pattern: string;
  patternMessage: string;
  content: string;
  linksText: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  label: "",
  type: "text",
  required: true,
  placeholder: "",
  helpText: "",
  optionsText: "",
  accept: "",
  maxSizeMB: "",
  extensionsText: "",
  checkboxLabel: "",
  minLength: "",
  maxLength: "",
  pattern: "",
  patternMessage: "",
  content: "",
  linksText: "",
});

function toDraft(t: RecruitmentFieldTemplate): Draft {
  return {
    name: t.name,
    label: t.label,
    type: t.type,
    required: t.required,
    placeholder: t.placeholder ?? "",
    helpText: t.helpText ?? "",
    optionsText: (t.options ?? []).map((o) => o.value).join(", "),
    accept: t.accept ?? "",
    maxSizeMB: t.maxSizeMB != null ? String(t.maxSizeMB) : "",
    extensionsText: (t.allowedExtensions ?? []).join(", "),
    checkboxLabel: t.checkboxLabel ?? "",
    minLength: t.minLength != null ? String(t.minLength) : "",
    maxLength: t.maxLength != null ? String(t.maxLength) : "",
    pattern: t.pattern ?? "",
    patternMessage: t.patternMessage ?? "",
    content: t.content ?? "",
    linksText: (t.links ?? []).map((l) => `${l.label} | ${l.url}`).join(", "),
  };
}

function buildPayload(d: Draft): Record<string, unknown> | null {
  const name = d.name.trim();
  const label = d.label.trim();
  if (!name || !label) {
    toast.error("name and label are required");
    return null;
  }
  const payload: Record<string, unknown> = {
    name,
    label,
    type: d.type,
    required: d.required,
  };
  for (const key of ["placeholder", "helpText", "checkboxLabel", "pattern", "patternMessage", "accept"]) {
    if (d[key as keyof Omit<Draft, "optionsText" | "extensionsText">]) {
      payload[key] = (d as unknown as Record<string, string>)[key];
    }
  }
  if (d.type === "select" && d.optionsText.trim()) {
    payload.options = d.optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .map((value) => ({ label: value, value }));
  }
  if (d.type === "info") {
    if (d.content.trim()) payload.content = d.content.trim();
    const links = d.linksText
      .split(",")
      .map((seg) => {
        const [label, url] = seg.split("|");
        const l = label?.trim() ?? "";
        const u = url?.trim() ?? "";
        return l && u ? { label: l, url: u } : null;
      })
      .filter((x): x is { label: string; url: string } => x !== null);
    if (links.length > 0) payload.links = links;
    payload.required = false;
  }
  if (d.type === "file") {
    if (d.maxSizeMB !== "") {
      const mb = Number(d.maxSizeMB);
      if (!isFinite(mb) || mb <= 0) {
        toast.error("Max size must be a positive number");
        return null;
      }
      payload.maxSizeMB = mb;
    }
    const exts = d.extensionsText.split(",").map((e) => e.trim()).filter(Boolean);
    if (exts.length > 0) payload.allowedExtensions = exts;
  }
  const minLength = d.minLength === "" ? NaN : Number(d.minLength);
  const maxLength = d.maxLength === "" ? NaN : Number(d.maxLength);
  if (isFinite(minLength)) payload.minLength = minLength;
  if (isFinite(maxLength)) payload.maxLength = maxLength;
  return payload;
}

export function SavedFieldsPanel() {
  const [templates, setTemplates] = useState<RecruitmentFieldTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecruitmentFieldTemplate | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recruitment/templates");
      const json = await res.json();
      if (Array.isArray(json)) setTemplates(json);
      else throw new Error(json.error || "Failed to load saved fields");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load saved fields");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
  };

  const openEdit = (t: RecruitmentFieldTemplate) => {
    setEditing(t);
    setDraft(toDraft(t));
    setOpen(true);
  };

  const save = async () => {
    const payload = buildPayload(draft);
    if (!payload) return;
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/recruitment/templates/${editing.id}` : "/api/recruitment/templates",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      toast.success(editing ? "Saved field updated" : "Saved field created");
      setOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: RecruitmentFieldTemplate) => {
    if (!window.confirm(`Delete saved field "${t.name}"? Existing roles keep their copies.`)) return;
    try {
      const res = await fetch(`/api/recruitment/templates/${t.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      toast.success("Saved field deleted");
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) return <GoogleLoader message="Loading saved fields…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable field definitions. Use them in any role form via
          &ldquo;From saved&rdquo; and adjust the section.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New saved field
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <LibraryBig className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No saved fields yet</p>
            <p className="text-sm text-muted-foreground">
              Build your own schema once and reuse it across recruitments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.label}</p>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {t.type}
                    {t.required ? " *" : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(t)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit saved field — ${editing.name}` : "New saved field"}
            </DialogTitle>
            <DialogDescription>
              Define a reusable question. Drive folder is decided per-role when the
              field is added to a form.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="fullName"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Label *</Label>
                <Input
                  value={draft.label}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="What should we ask?"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v) => {
                    const t = v as FieldType;
                    set("type", t);
                    if (t === "info") set("required", false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                {draft.type === "info" ? (
                  <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    Info (read-only)
                  </span>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.required}
                      onChange={(e) => set("required", e.target.checked)}
                      className="h-4 w-4"
                    />
                    Required
                  </label>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Placeholder</Label>
              <Input
                value={draft.placeholder}
                onChange={(e) => set("placeholder", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Help text</Label>
              <Input
                value={draft.helpText}
                onChange={(e) => set("helpText", e.target.value)}
              />
            </div>
            {draft.type === "select" && (
              <div className="space-y-1.5">
                <Label>Options (comma separated)</Label>
                <Input
                  value={draft.optionsText}
                  onChange={(e) => set("optionsText", e.target.value)}
                  placeholder="CSE, AI&ML, ECE"
                />
              </div>
            )}
            {draft.type === "file" && (
              <>
                <div className="space-y-1.5">
                  <Label>Accept (e.g. .pdf,.doc)</Label>
                  <Input
                    value={draft.accept}
                    onChange={(e) => set("accept", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Max size (MB)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={draft.maxSizeMB}
                      onChange={(e) => set("maxSizeMB", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Extensions (comma separated)</Label>
                    <Input
                      value={draft.extensionsText}
                      onChange={(e) => set("extensionsText", e.target.value)}
                      placeholder=".pdf, .docx"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </>
            )}
            {draft.type === "checkbox" && (
              <div className="space-y-1.5">
                <Label>Checkbox label</Label>
                <Input
                  value={draft.checkboxLabel}
                  onChange={(e) => set("checkboxLabel", e.target.value)}
                />
              </div>
            )}
            {draft.type === "info" && (
              <>
                <div className="space-y-1.5">
                  <Label>Content (body text — not an input)</Label>
                  <Textarea
                    value={draft.content}
                    onChange={(e) => set("content", e.target.value)}
                    rows={3}
                    placeholder="Key information to display…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Links (text | url, comma separated)</Label>
                  <Input
                    value={draft.linksText}
                    onChange={(e) => set("linksText", e.target.value)}
                    placeholder="Task template | https://drive.google.com/…"
                    className="font-mono text-xs"
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min length</Label>
                <Input
                  type="number"
                  value={draft.minLength}
                  onChange={(e) => set("minLength", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max length</Label>
                <Input
                  type="number"
                  value={draft.maxLength}
                  onChange={(e) => set("maxLength", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Regex pattern</Label>
              <Input
                value={draft.pattern}
                onChange={(e) => set("pattern", e.target.value)}
                placeholder="^[A-Za-z ]+$"
                className="font-mono text-xs"
              />
            </div>
            {draft.pattern && (
              <div className="space-y-1.5">
                <Label>Pattern error message</Label>
                <Textarea
                  value={draft.patternMessage}
                  onChange={(e) => set("patternMessage", e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}