"use client";

import React, { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  LibraryBig,
  BookmarkPlus,
  LayoutTemplate,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ROLE_STATUSES,
  ROLE_STATUS_CLASSES,
} from "@/lib/recruitment";
import type {
  RecruitmentFieldTemplate,
  RecruitmentFormTemplate,
  RecruitmentRole,
  RecruitmentRoleField,
  RecruitmentRoleSection,
  FieldType,
  RoleStatus,
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

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = isNaN(Date.parse(iso)) ? null : new Date(iso);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToISO(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

interface RoleFormProps {
  role?: RecruitmentRole | null;
  onSaved: () => void;
  onCancel: () => void;
  submitLabel?: string;
}

interface FieldDraft extends Omit<RecruitmentRoleField, "options" | "allowedExtensions"> {
  _id: string;
  optionsText: string;
  extensionsText: string;
  driveFolderId: string;
  contentText: string;
  linksText: string;
}

const emptySection = (number: number): RecruitmentRoleSection => ({
  number,
  title: "",
  description: "",
  borderColor: "#4285F4",
});

const emptyField = (section: number, order: number): FieldDraft => ({
  _id: uid(),
  name: "",
  label: "",
  type: "text",
  section,
  required: true,
  placeholder: "",
  helpText: "",
  optionsText: "",
  accept: "",
  maxSizeMB: undefined,
  extensionsText: "",
  checkboxLabel: "",
  minLength: undefined,
  maxLength: undefined,
  pattern: "",
  patternMessage: "",
  order,
  driveFolderId: "",
  contentText: "",
  linksText: "",
});

function toDraftField(
  f: Pick<
    RecruitmentRoleField,
    | "name"
    | "label"
    | "type"
    | "required"
    | "placeholder"
    | "helpText"
    | "options"
    | "accept"
    | "maxSizeMB"
    | "allowedExtensions"
    | "checkboxLabel"
    | "minLength"
    | "maxLength"
    | "pattern"
    | "patternMessage"
    | "content"
    | "links"
  >,
  order: number,
  section: number,
  driveFolderId?: string,
): FieldDraft {
  return {
    _id: uid(),
    name: f.name,
    label: f.label,
    type: f.type,
    section,
    required: f.required,
    placeholder: f.placeholder ?? "",
    helpText: f.helpText ?? "",
    optionsText: (f.options ?? []).map((o) => o.value).join(", "),
    accept: f.accept ?? "",
    maxSizeMB: f.maxSizeMB,
    extensionsText: (f.allowedExtensions ?? []).join(", "),
    checkboxLabel: f.checkboxLabel ?? "",
    minLength: f.minLength,
    maxLength: f.maxLength,
    pattern: f.pattern ?? "",
    patternMessage: f.patternMessage ?? "",
    order,
    driveFolderId: driveFolderId ?? "",
    contentText: f.content ?? "",
    linksText: (f.links ?? []).map((l) => `${l.label} | ${l.url}`).join(", "),
  };
}

function parseLinks(text: string): { label: string; url: string }[] {
  return text
    .split(",")
    .map((seg) => {
      const [label, url] = seg.split("|");
      const l = (label ?? "").trim();
      const u = (url ?? "").trim();
      return l && u ? { label: l, url: u } : null;
    })
    .filter((x): x is { label: string; url: string } => x !== null);
}

function toDraft(role?: RecruitmentRole | null): {
  title: string;
  description: string;
  icon: string;
  color: string;
  status: RoleStatus;
  maxApplications: string;
  applicationStart: string;
  applicationEnd: string;
  sections: RecruitmentRoleSection[];
  fields: FieldDraft[];
} {
  if (!role) {
    // Every new form ships with a default "Personal Info" section containing
    // the mandatory Full Name + Email fields. Applicants authenticate with
    // their college mail, so the client pre-fills these directly from the
    // signed-in user — they stay required and are generally not removed.
    return {
      title: "",
      description: "",
      icon: "",
      color: "#4285F4",
      status: "draft",
      maxApplications: "",
      applicationStart: "",
      applicationEnd: "",
      sections: [
        {
          number: 1,
          title: "Personal Info",
          description: "Your basic details",
          borderColor: "#4285F4",
        },
      ],
      fields: [
        {
          ...emptyField(1, 0),
          name: "fullName",
          label: "Full Name",
          type: "text",
          placeholder: "Enter your full name",
        },
        {
          ...emptyField(1, 1),
          name: "email",
          label: "Email",
          type: "email",
          placeholder: "you@vishnu.edu.in",
        },
      ],
    };
  }
  return {
    title: role.title,
    description: role.description,
    icon: role.icon,
    color: role.color || "#4285F4",
    status: role.status,
    maxApplications: role.maxApplications != null ? String(role.maxApplications) : "",
    applicationStart: isoToDatetimeLocal(role.applicationStart),
    applicationEnd: isoToDatetimeLocal(role.applicationEnd),
    sections: role.sections.length ? role.sections : [emptySection(1)],
    fields: role.fields.map((f) => toDraftField(f, f.order, f.section, f.driveFolderId)),
  };
}

export function RoleForm({ role, onSaved, onCancel, submitLabel }: RoleFormProps) {
  const [form, setForm] = useState(() => toDraft(role));
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<RecruitmentFieldTemplate[]>([]);
  const [formTemplates, setFormTemplates] = useState<RecruitmentFormTemplate[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSection, setPickerSection] = useState<number>(
    form.sections[0]?.number ?? 1,
  );
  const [saveFormOpen, setSaveFormOpen] = useState(false);
  const [loadFormOpen, setLoadFormOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/recruitment/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {
        /* saved fields are optional */
      });
    fetch("/api/recruitment/form-templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setFormTemplates(data);
      })
      .catch(() => {
        /* saved forms are optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setSection = (number: number, patch: Partial<RecruitmentRoleSection>) =>
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.number === number ? { ...s, ...patch } : s,
      ),
    }));

  const addSection = () =>
    setForm((prev) => {
      const nextNumber =
        prev.sections.length > 0
          ? Math.max(...prev.sections.map((s) => s.number)) + 1
          : 1;
      return { ...prev, sections: [...prev.sections, emptySection(nextNumber)] };
    });

  const removeSection = (number: number) =>
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.number !== number),
    }));

  const setField = (id: string, patch: Partial<FieldDraft>) =>
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f._id === id ? { ...f, ...patch } : f)),
    }));

  const addField = () =>
    setForm((prev) => {
      const nextOrder =
        prev.fields.length > 0
          ? Math.max(...prev.fields.map((f) => f.order)) + 1
          : 0;
      const section = prev.sections[0]?.number ?? 1;
      return { ...prev, fields: [...prev.fields, emptyField(section, nextOrder)] };
    });

  const removeField = (id: string) =>
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f._id !== id),
    }));

  const addFieldFromTemplate = (t: RecruitmentFieldTemplate) =>
    setForm((prev) => {
      const nextOrder =
        prev.fields.length > 0
          ? Math.max(...prev.fields.map((f) => f.order)) + 1
          : 0;
      return { ...prev, fields: [...prev.fields, toDraftField(t, nextOrder, pickerSection)] };
    });

  const loadFormTemplate = (t: RecruitmentFormTemplate) => {
    if (
      form.fields.length > 0 &&
      !window.confirm(
        "Replace the current sections and fields with this saved form?",
      )
    ) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      sections: t.sections.length ? t.sections : [emptySection(1)],
      fields: t.fields.map((f, i) => toDraftField(f, f.order ?? i, f.section)),
    }));
    setPickerSection(t.sections[0]?.number ?? 1);
    setLoadFormOpen(false);
  };

  const saveAsTemplate = async () => {
    if (!form.fields.some((f) => f.name.trim())) {
      toast.error("Add at least one field before saving as a template");
      return;
    }
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    const payload = buildPayload(false);
    if (!payload) return;

    setSavingTemplate(true);
    try {
      const res = await fetch("/api/recruitment/form-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim(),
          sections: payload.sections,
          // Drive folder links are per-role, never stored in a template.
          fields: payload.fields.map((f) => {
            const rest = { ...f };
            delete rest.driveFolderId;
            return rest;
          }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save template");
      toast.success("Form template saved");
      setSaveFormOpen(false);
      setTemplateDescription("");
      const listRes = await fetch("/api/recruitment/form-templates");
      const list = await listRes.json();
      if (Array.isArray(list)) setFormTemplates(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const buildPayload = (requireFolders = true) => {
    const sectionNumbers = form.sections.map((s) => s.number);
    const issues: string[] = [];
    const usedNames = new Set<string>();
    for (const f of form.fields) {
      const name = f.name.trim();
      const label = f.label.trim();
      const where = label || name || `Field ${f.order + 1}`;
      if (!name && !label) {
        issues.push(`Field ${f.order + 1} is missing a name and label`);
        continue;
      }
      if (!name) issues.push(`Field "${label}" is missing a name`);
      if (!label) issues.push(`Field "${name}" is missing a label`);
      const dup = name.toLowerCase();
      if (dup && usedNames.has(dup)) issues.push(`Duplicate field name: "${name}"`);
      else if (dup) usedNames.add(dup);
      if (!sectionNumbers.includes(f.section)) {
        issues.push(`Field "${where}" has an invalid section`);
        continue;
      }
      // if (requireFolders && f.type === "file" && !f.driveFolderId.trim()) {
      //   issues.push(`File field "${where}" needs a Drive folder link`);
      // }
      if (f.type === "select") {
        const opts = f.optionsText
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
        if (opts.length === 0) {
          issues.push(`Select field "${where}" has no options`);
        }
      }
    }
    if (issues.length > 0) {
      toast.error("Fix the following to save this role:", {
        description: (
          <ul className="list-disc space-y-0.5 pl-5">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        ),
      });
      return null;
    }

    const fields: RecruitmentRoleField[] = form.fields.map((f) => {
      const base: RecruitmentRoleField = {
        name: f.name,
        label: f.label,
        type: f.type,
        section: f.section,
        required: f.required,
        placeholder: f.placeholder,
        helpText: f.helpText,
        order: f.order,
        minLength: f.minLength,
        maxLength: f.maxLength,
        pattern: f.pattern || undefined,
        patternMessage: f.patternMessage || undefined,
        driveFolderId: f.driveFolderId || undefined,
      };
      if (f.type === "select") {
        base.options = f.optionsText
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
          .map((value) => ({ label: value, value }));
      }
      if (f.type === "file") {
        base.accept = f.accept || undefined;
        base.maxSizeMB = f.maxSizeMB;
        base.allowedExtensions = f.extensionsText
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
      }
      if (f.type === "checkbox") {
        base.checkboxLabel = f.checkboxLabel || undefined;
      }
      if (f.type === "info") {
        base.required = false;
        base.content = f.contentText.trim() || undefined;
        base.links = parseLinks(f.linksText);
      }
      return base;
    });

    return {
      title: form.title,
      description: form.description,
      icon: form.icon,
      color: form.color,
      status: form.status,
      maxApplications: form.maxApplications === "" ? null : Number(form.maxApplications),
      applicationStart: datetimeLocalToISO(form.applicationStart),
      applicationEnd: datetimeLocalToISO(form.applicationEnd),
      sections: form.sections,
      fields,
    };
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = buildPayload(form.status !== "draft");
    if (!payload) return;

    setSaving(true);
    try {
      const isEdit = Boolean(role?.id);
      const res = await fetch(
        isEdit ? `/api/recruitment/roles/${role!.id}` : "/api/recruitment/roles",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to save role");
      }
      toast.success(isEdit ? "Role updated" : "Role created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Basic info ── */}
      <SectionTitle>Basic Info</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Title *</Label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Full Stack Web Development"
          />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Role description…"
          />
        </div>
        <div>
          <Label>Icon (emoji)</Label>
          <Input
            value={form.icon}
            onChange={(e) => set("icon", e.target.value)}
            placeholder="💻"
          />
        </div>
        <div>
          <Label>Brand color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border"
            />
            <Input
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="font-mono"
            />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => set("status", v as RoleStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span
                    className={cn(
                      "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                      ROLE_STATUS_CLASSES[s],
                    )}
                  >
                    {s.replace("-", " ")}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Max applications</Label>
          <Input
            type="number"
            min={0}
            value={form.maxApplications}
            onChange={(e) => set("maxApplications", e.target.value)}
            placeholder="∞ if empty"
          />
        </div>
        <div>
          <Label>Application start</Label>
          <Input
            type="datetime-local"
            value={form.applicationStart}
            onChange={(e) => set("applicationStart", e.target.value)}
          />
        </div>
        <div>
          <Label>Application end</Label>
          <Input
            type="datetime-local"
            value={form.applicationEnd}
            onChange={(e) => set("applicationEnd", e.target.value)}
          />
        </div>
      </div>

      {/* ── Sections ── */}
      <Separator />
      <div className="flex items-center justify-between">
        <SectionTitle>Sections</SectionTitle>
        <Button type="button" size="sm" variant="outline" onClick={addSection}>
          <Plus className="h-4 w-4" /> Add section
        </Button>
      </div>
      {form.sections.length === 0 && (
        <p className="text-sm text-muted-foreground">No sections yet.</p>
      )}
      <div className="space-y-2">
        {form.sections.map((s) => (
          <div
            key={s.number}
            className="flex items-center gap-2 rounded-lg border p-2"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="w-6 text-xs font-semibold text-muted-foreground">
              #{s.number}
            </span>
            <Input
              value={s.title}
              onChange={(e) => setSection(s.number, { title: e.target.value })}
              placeholder="Section title"
              className="flex-1"
            />
            <input
              type="color"
              value={s.borderColor}
              onChange={(e) =>
                setSection(s.number, { borderColor: e.target.value })
              }
              className="h-9 w-9 cursor-pointer rounded border"
              title="Section border color"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => removeSection(s.number)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* ── Fields ── */}
      <Separator />
      <div className="flex items-center justify-between">
        <SectionTitle>Form Fields</SectionTitle>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setTemplateName("");
              setTemplateDescription("");
              setSaveFormOpen(true);
            }}
          >
            <BookmarkPlus className="h-4 w-4" /> Save form
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLoadFormOpen(true)}
          >
            <LayoutTemplate className="h-4 w-4" /> From saved form
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
          >
            <LibraryBig className="h-4 w-4" /> From saved
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addField}>
            <Plus className="h-4 w-4" /> Add field
          </Button>
        </div>
      </div>
      {form.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No fields yet.</p>
      )}
      <div className="space-y-3">
        {form.fields.map((f) => (
          <FieldRow
            key={f._id}
            field={f}
            sections={form.sections}
            onChange={(patch) => setField(f._id, patch)}
            onRemove={() => removeField(f._id)}
          />
        ))}
      </div>

      {/* ── Add from saved fields ── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add from saved fields</DialogTitle>
            <DialogDescription>
              Copies a saved field into this form into the selected section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                Add to section
              </Label>
              <Select
                value={String(pickerSection)}
                onValueChange={(v) => setPickerSection(Number(v))}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {form.sections.map((s) => (
                    <SelectItem key={s.number} value={String(s.number)}>
                      #{s.number} {s.title ? `— ${s.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved fields yet — create them in the Recruitment → Saved
                Fields tab of the admin portal.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addFieldFromTemplate(t)}
                    className="w-full rounded-lg border p-3 text-left text-sm hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.name}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        {t.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.label}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Save form as template ── */}
      <Dialog open={saveFormOpen} onOpenChange={setSaveFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as form template</DialogTitle>
            <DialogDescription>
              Reuse this whole form across recruitments. Drive folder links are
              removed from file fields — set them per role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="GDG Web Team Application"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={2}
                placeholder="Optional — what this template is for"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsTemplate} disabled={savingTemplate}>
              {savingTemplate && <Loader2 className="h-4 w-4 animate-spin" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Load form template ── */}
      <Dialog open={loadFormOpen} onOpenChange={setLoadFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Load a saved form</DialogTitle>
            <DialogDescription>
              Replaces the current sections and fields — modify them further
              before saving the role. Drive folder links must be re-set per role.
            </DialogDescription>
          </DialogHeader>
          {formTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved forms yet — build a form and use &ldquo;Save form&rdquo;
              to create one.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {formTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => loadFormTemplate(t)}
                  className="w-full rounded-lg border p-3 text-left text-sm hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {t.fields.length} fields · {t.sections.length} sections
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : submitLabel ?? (role ? "Save changes" : "Create role")}
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

function FieldRow({
  field,
  sections,
  onChange,
  onRemove,
}: {
  field: FieldDraft;
  sections: RecruitmentRoleSection[];
  onChange: (patch: Partial<FieldDraft>) => void;
  onRemove: () => void;
}) {
  const fileShown = field.type === "file";
  const selectShown = field.type === "select";
  const checkboxShown = field.type === "checkbox";
  const infoShown = field.type === "info";

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-5">
          <Input
            value={field.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Field name (e.g. fullName)"
            className="font-mono text-xs"
          />
        </div>
        <div className="col-span-4">
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Label"
          />
        </div>
        <div className="col-span-2">
          <Select
            value={field.type}
            onValueChange={(v: FieldType) =>
              onChange(v === "info" ? { type: v, required: false } : { type: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onRemove}
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-3 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Section</Label>
          <Select
            value={String(field.section)}
            onValueChange={(v) => onChange({ section: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.number} value={String(s.number)}>
                  #{s.number} {s.title ? `— ${s.title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Order</Label>
          <Input
            type="number"
            value={field.order}
            onChange={(e) => onChange({ order: Number(e.target.value) || 0 })}
            className="w-20"
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          {infoShown ? (
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              Info (read-only)
            </span>
          ) : (
            <>
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="h-4 w-4"
              />
              <Label className="text-xs text-muted-foreground">Required</Label>
            </>
          )}
        </div>
        <div className="col-span-5">
          <Input
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Placeholder (optional)"
          />
        </div>
      </div>

      {fileShown && (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12">
            <Input
              value={field.driveFolderId}
              onChange={(e) => onChange({ driveFolderId: e.target.value })}
              placeholder="Drive folder ID or link (required) — uploaded files land here"
              className="font-mono text-xs"
            />
          </div>
          <div className="col-span-5">
            <Input
              value={field.accept ?? ""}
              onChange={(e) => onChange({ accept: e.target.value })}
              placeholder="accept (e.g. .doc,.docx)"
              className="font-mono text-xs"
            />
          </div>
          <div className="col-span-3">
            <Input
              type="number"
              value={field.maxSizeMB ?? ""}
              onChange={(e) =>
                onChange({ maxSizeMB: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              placeholder="Max MB"
            />
          </div>
          <div className="col-span-4">
            <Input
              value={field.extensionsText}
              onChange={(e) => onChange({ extensionsText: e.target.value })}
              placeholder="Extensions: .pdf,.docx"
              className="font-mono text-xs"
            />
          </div>
        </div>
      )}

      {selectShown && (
        <Input
          value={field.optionsText}
          onChange={(e) => onChange({ optionsText: e.target.value })}
          placeholder="Options (comma separated): CSE, AI&ML, ECE"
        />
      )}

      {checkboxShown && (
        <Input
          value={field.checkboxLabel ?? ""}
          onChange={(e) => onChange({ checkboxLabel: e.target.value })}
          placeholder="Checkbox label"
        />
      )}

      {infoShown && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Content (body text shown to applicants — not an input)
            </Label>
            <Textarea
              value={field.contentText}
              onChange={(e) => onChange({ contentText: e.target.value })}
              rows={3}
              placeholder="Key information to display…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Links (text | url, comma separated)
            </Label>
            <Input
              value={field.linksText}
              onChange={(e) => onChange({ linksText: e.target.value })}
              placeholder="Task template | https://drive.google.com/…, Guide | https://…"
              className="font-mono text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}