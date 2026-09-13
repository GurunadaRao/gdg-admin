"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Loader2, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import GoogleLoader from "@/components/GoogleLoader";
import type { RecruitmentFormTemplate } from "@/lib/types/recruitment";

export function SavedFormsPanel() {
  const [templates, setTemplates] = useState<RecruitmentFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecruitmentFormTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recruitment/form-templates");
      const json = await res.json();
      if (Array.isArray(json)) setTemplates(json);
      else throw new Error(json.error || "Failed to load saved forms");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load saved forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openEdit = (t: RecruitmentFormTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/recruitment/form-templates/${editing!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      toast.success("Form template updated");
      setOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: RecruitmentFormTemplate) => {
    if (!window.confirm(`Delete saved form "${t.name}"? Existing roles keep their copies.`)) return;
    try {
      const res = await fetch(`/api/recruitment/form-templates/${t.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      toast.success("Form template deleted");
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) return <GoogleLoader message="Loading saved forms…" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
          Reusable complete forms. Build one in any role editor, hit
          &ldquo;Save form&rdquo;, then reload it with &ldquo;From saved
          form&rdquo; to reuse across recruitments.
        </p>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No saved forms yet</p>
            <p className="text-sm text-muted-foreground">
              Open a role, design the form, and use &ldquo;Save form&rdquo; to
              reuse it later.
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
                    {t.description && (
                      <p className="text-sm text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {t.fields.length} fields · {t.sections.length} sections
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" /> Rename
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.name ?? "Edit"}</DialogTitle>
            <DialogDescription>
              Updating the template name/description only. Edit the actual
              fields inside a role via &ldquo;From saved form&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}