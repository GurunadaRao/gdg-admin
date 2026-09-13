"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_SETTINGS } from "@/lib/recruitment";
import type {
  RecruitmentRole,
  RecruitmentSettings,
  RecruitmentRoleField,
  RecruitmentFileMeta,
} from "@/lib/types/recruitment";

const STRUCTURED_FILES = ["resume", "taskSubmission"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldError({
  field,
  value,
  fileMeta,
}: {
  field: RecruitmentRoleField;
  value: string | boolean | undefined;
  fileMeta: RecruitmentFileMeta | undefined;
}): string | null {
  if (field.type === "checkbox") {
    if (field.required && value !== true) return "Required";
    return null;
  }
  if (field.type === "file") {
    if (field.required && !fileMeta) return "Upload required";
    return null;
  }

  const v = typeof value === "string" ? value.trim() : "";
  if (field.required && !v) return "Required";
  if (!v) return null;

  if (field.type === "email" && !EMAIL_RE.test(v)) return "Enter a valid email";
  if (field.type === "url") {
    try {
      new URL(v);
    } catch {
      return "Enter a valid URL";
    }
  }
  if (field.type === "number" && isNaN(Number(v))) return "Enter a number";
  if (field.minLength && v.length < field.minLength)
    return `Minimum ${field.minLength} characters`;
  if (field.maxLength && v.length > field.maxLength)
    return `Maximum ${field.maxLength} characters`;
  if (field.pattern) {
    try {
      if (!new RegExp(field.pattern).test(v))
        return field.patternMessage ?? "Invalid format";
    } catch {
      // ignore malformed patterns
    }
  }
  return null;
}

export default function PublicRecruitmentForm({
  role,
  settings,
}: {
  role: RecruitmentRole;
  settings: RecruitmentSettings | null;
}) {
  const s: RecruitmentSettings = settings ?? {
    ...DEFAULT_SETTINGS,
    id: "global",
    updatedAt: null,
  };

  // Identity fields are read from the role's own schema when defined (matched
  // by field name). The fallback block below only appears for names the schema
  // is missing but the submit API requires (fullName/email).
  const fieldsByName = new Map<string, RecruitmentRoleField>();
  for (const f of role.fields) fieldsByName.set(f.name.toLowerCase(), f);
  const hasIdentity = (name: string) => fieldsByName.has(name.toLowerCase());
  const identityValue = (name: string) => {
    const f = fieldsByName.get(name.toLowerCase());
    if (!f) return "";
    const v = values[f.name];
    return typeof v === "string" ? v.trim() : "";
  };

  const [identityFallback, setIdentityFallback] = useState({
    fullName: "",
    email: "",
  });
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [fileMetas, setFileMetas] = useState<Record<string, RecruitmentFileMeta>>(
    {},
  );
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [confirmInfo, setConfirmInfo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState("");

  const orderedFields = [...role.fields].sort((a, b) => a.order - b.order);

  const sections = [...role.sections].sort((a, b) => a.number - b.number);
  const fieldsBySection = new Map<number, RecruitmentRoleField[]>();
  for (const f of orderedFields) {
    const arr = fieldsBySection.get(f.section) ?? [];
    arr.push(f);
    fieldsBySection.set(f.section, arr);
  }
  const sectionKeys = new Set(sections.map((x) => x.number));
  const grouped = sections.map((section) => ({
    section,
    fields: fieldsBySection.get(section.number) ?? [],
  }));
  const orphanFields =
    orderedFields.filter((f) => !sectionKeys.has(f.section)) ?? [];

  const setValue = (name: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const maxSizeMB = (field: RecruitmentRoleField): number =>
    field.maxSizeMB ??
    (field.name === "resume"
      ? s.maxResumeSizeMB
      : field.name === "taskSubmission"
        ? s.maxTaskFileSizeMB
        : 10);

  const acceptFor = (field: RecruitmentRoleField): string | undefined => {
    if (field.accept) return field.accept;
    const exts =
      field.allowedExtensions ??
      (field.name === "resume"
        ? s.allowedResumeTypes
        : field.name === "taskSubmission"
          ? s.allowedTaskTypes
          : undefined);
    return exts?.length ? exts.join(",") : undefined;
  };

  const extensionOk = (file: File, field: RecruitmentRoleField): boolean => {
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    const allowed = field.allowedExtensions?.length
      ? field.allowedExtensions
      : field.accept
        ? field.accept.split(",").map((x) => x.trim()).filter(Boolean)
        : [];
    if (!allowed.length) return true;
    return allowed.some((a) =>
      a.toLowerCase().startsWith(".")
        ? a.toLowerCase() === ext
        : file.type.toLowerCase().includes(a.toLowerCase()),
    );
  };

  const handleFile = async (
    field: RecruitmentRoleField,
    file: File | undefined,
  ) => {
    if (!file) return;
    setServerError(null);

    if (!extensionOk(file, field)) {
      setErrors((p) => ({
        ...p,
        [field.name]: "Unsupported file type",
      }));
      return;
    }
    const maxMB = maxSizeMB(field);
    if (file.size > maxMB * 1024 * 1024) {
      setErrors((p) => ({
        ...p,
        [field.name]: `File must be under ${maxMB} MB`,
      }));
      return;
    }

    setUploading(field.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("roleId", role.id);
      formData.append("fieldName", field.name);
      const res = await fetch("/api/recruitment/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Upload failed");
      }
      setFileMetas((p) => ({
        ...p,
        [field.name]: {
          url: data.url,
          driveFileId: data.driveFileId ?? "",
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      }));
      setErrors((p) => {
        const next = { ...p };
        delete next[field.name];
        return next;
      });
    } catch (err) {
      setErrors((p) => ({
        ...p,
        [field.name]:
          err instanceof Error ? err.message : "Upload failed",
      }));
    } finally {
      setUploading(null);
    }
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!hasIdentity("fullName") && !identityFallback.fullName.trim())
      errs.__idName = "Required";
    if (!hasIdentity("email")) {
      if (!EMAIL_RE.test(identityFallback.email.trim()))
        errs.__idEmail = "Enter a valid email";
    }
    for (const f of orderedFields) {
      const msg = fieldError({
        field: f,
        value: values[f.name],
        fileMeta: fileMetas[f.name],
      });
      if (msg) errs[f.name] = msg;
    }
    if (!agreeToTerms) errs.agreeToTerms = "You must agree to the terms";
    if (!confirmInfo) errs.confirmInfo = "Please confirm your details";
    return errs;
  };

  const handleSubmit = async () => {
    setServerError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const names = {
      fullName: identityValue("fullName") || identityFallback.fullName.trim(),
      email: identityValue("email") || identityFallback.email.trim(),
      phone: identityValue("phone"),
      branch: identityValue("branch"),
      yearOfStudy: identityValue("yearOfStudy"),
    };
    setSubmittedName(names.fullName);

    const files: Record<string, RecruitmentFileMeta> = {};
    for (const key of STRUCTURED_FILES) {
      if (fileMetas[key]) files[key] = fileMetas[key];
    }

    const answers: Record<string, unknown> = {};
    for (const f of orderedFields) {
      if (f.type === "file") {
        const meta = fileMetas[f.name];
        if (meta && !STRUCTURED_FILES.includes(f.name)) {
          answers[f.name] = {
            url: meta.url,
            originalName: meta.originalName,
            mimeType: meta.mimeType,
            sizeBytes: meta.sizeBytes,
          };
        }
      } else if (f.type === "checkbox") {
        answers[f.name] = values[f.name] === true;
      } else {
        const v = values[f.name];
        if (typeof v === "string" && v.trim() !== "") {
          answers[f.name] =
            f.type === "number" ? Number(v) : v.trim();
        }
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/recruitment/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: role.id,
          applicant: {
            fullName: names.fullName,
            email: names.email.toLowerCase(),
            phone: names.phone,
            branch: names.branch,
            yearOfStudy: names.yearOfStudy,
            agreeToTerms,
            confirmInfo,
          },
          files,
          answers,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setServerError(data?.error ?? "Failed to submit application");
        return;
      }
      setSuccessId(data?.id ?? null);
    } catch {
      setServerError("Failed to submit application. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Success screen ──
  if (successId !== null) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="size-12 mx-auto text-green-600" />
            <h1 className="text-2xl font-semibold">
              Application submitted!
            </h1>
            <p className="text-muted-foreground">
              Thank you, {submittedName || "applicant"}. Your application for{" "}
              <strong>{role.title}</strong> has been received.
            </p>
            <p className="text-xs text-muted-foreground">
              Reference: {successId}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderField = (field: RecruitmentRoleField) => {
    const id = `field-${field.name}`;
    const err = errors[field.name];
    const value = values[field.name];
    const meta = fileMetas[field.name];

if (field.type === "info") {
      return (
        <div
          key={field.name}
          className="space-y-2 rounded-md border-l-4 border-blue-500 bg-muted/40 p-4"
        >
          {field.label && (
            <p className="text-sm font-semibold">{field.label}</p>
          )}
          {field.content && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {field.content}
            </p>
          )}
          {field.links && field.links.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {field.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-accent"
                >
                  <ExternalLink className="size-3.5" />
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (field.type === "file") {
      return (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={id}>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <div
            className={cn(
              "flex items-center gap-3 rounded-md border p-3",
              err && "border-destructive",
            )}
          >
            {meta ? (
              <>
                <a
                  href={meta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-sm text-blue-600 hover:underline"
                >
                  {meta.originalName}
                </a>
                <span className="text-xs text-muted-foreground">
                  {(meta.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFileMetas((p) => {
                      const next = { ...p };
                      delete next[field.name];
                      return next;
                    })
                  }
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove file"
                >
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <>
                <label
                  htmlFor={id}
                  className="inline-flex items-center gap-2 cursor-pointer rounded-md border bg-secondary/40 px-3 py-1.5 text-sm hover:bg-secondary/60"
                >
                  {uploading === field.name ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploading === field.name ? "Uploading…" : "Choose file"}
                </label>
                <input
                  id={id}
                  type="file"
                  accept={acceptFor(field)}
                  className="hidden"
                  onChange={(e) => handleFile(field, e.target.files?.[0])}
                />
                <span className="text-xs text-muted-foreground">
                  Up to {maxSizeMB(field)} MB
                  {acceptFor(field)
                    ? ` · ${acceptFor(field)}`
                    : " · any file"}
                </span>
              </>
            )}
          </div>
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <div key={field.name} className="space-y-1.5">
          <div className="flex items-start gap-3">
            <Checkbox
              id={id}
              checked={value === true}
              onCheckedChange={(checked) => setValue(field.name, checked === true)}
            />
            <Label htmlFor={id} className="font-normal leading-snug">
              {field.checkboxLabel || field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={id}>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Select
            value={typeof value === "string" ? value : undefined}
            onValueChange={(v) => setValue(field.name, v)}
          >
            <SelectTrigger
              id={id}
              className={cn("w-full", err && "border-destructive")}
            >
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
      );
    }

    return (
      <div key={field.name} className="space-y-1.5">
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          id={id}
          type={field.type}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(field.name, e.target.value)}
          className={cn(err && "border-destructive")}
        />
        {field.helpText && (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    );
  };

  const showNameFallback = !hasIdentity("fullName");
  const showEmailFallback = !hasIdentity("email");

  return (
    <main className="min-h-screen bg-background p-6">
      <Card
        className="max-w-3xl mx-auto border-t-4"
        style={{ borderTopColor: role.color }}
      >
        <CardContent className="p-6 md:p-8 space-y-8">
          {/* Role header */}
          <header className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl leading-none">{role.icon}</div>
                <div>
                  <h1 className="text-2xl font-bold">{role.title}</h1>
                  {role.status === "closing-soon" && (
                    <span className="text-xs font-medium text-amber-600">
                      Closing soon
                    </span>
                  )}
                </div>
              </div>
              {role.applicationEnd && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Deadline:{" "}
                  <strong>
                    {new Date(role.applicationEnd).toLocaleDateString()}
                  </strong>
                </span>
              )}
            </div>
            {role.description && (
              <p className="text-muted-foreground">{role.description}</p>
            )}
          </header>

          {/* Fallback identity inputs — only when the schema omits them. */}
          {(showNameFallback || showEmailFallback) && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Your details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {showNameFallback && (
                  <div className="space-y-1.5">
                    <Label htmlFor="idName">
                      Full name
                      <span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      id="idName"
                      value={identityFallback.fullName}
                      onChange={(e) =>
                        setIdentityFallback((p) => ({
                          ...p,
                          fullName: e.target.value,
                        }))
                      }
                      className={cn(errors.__idName && "border-destructive")}
                    />
                    {errors.__idName && (
                      <p className="text-sm text-destructive">
                        {errors.__idName}
                      </p>
                    )}
                  </div>
                )}
                {showEmailFallback && (
                  <div className="space-y-1.5">
                    <Label htmlFor="idEmail">
                      Email
                      <span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      id="idEmail"
                      type="email"
                      value={identityFallback.email}
                      onChange={(e) =>
                        setIdentityFallback((p) => ({
                          ...p,
                          email: e.target.value,
                        }))
                      }
                      className={cn(errors.__idEmail && "border-destructive")}
                    />
                    {errors.__idEmail && (
                      <p className="text-sm text-destructive">
                        {errors.__idEmail}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Role-specific questions */}
          {grouped.map(({ section, fields }) =>
            fields.length === 0 ? null : (
              <section key={section.number} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  {section.description && (
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map(renderField)}
                </div>
              </section>
            ),
          )}

          {orphanFields.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">More questions</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {orphanFields.map(renderField)}
              </div>
            </section>
          )}

          {/* Required confirmations */}
          <section className="space-y-4 border-t pt-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="agreeToTerms"
                checked={agreeToTerms}
                onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
              />
              <Label htmlFor="agreeToTerms" className="font-normal leading-snug">
                I agree to the terms and conditions of this recruitment
                process.
                <span className="text-destructive"> *</span>
              </Label>
            </div>
            {errors.agreeToTerms && (
              <p className="text-sm text-destructive">{errors.agreeToTerms}</p>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirmInfo"
                checked={confirmInfo}
                onCheckedChange={(checked) => setConfirmInfo(checked === true)}
              />
              <Label htmlFor="confirmInfo" className="font-normal leading-snug">
                I confirm that all the information provided is accurate.
                <span className="text-destructive"> *</span>
              </Label>
            </div>
            {errors.confirmInfo && (
              <p className="text-sm text-destructive">{errors.confirmInfo}</p>
            )}
          </section>

          {serverError && (
            <p className="text-sm font-medium text-destructive">
              {serverError}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={busy || uploading !== null}
            >
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              {busy ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}