"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Upload, X, Loader2, CheckCircle2, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase/client";
import type {
  RecruitmentRole,
  RecruitmentRoleField,
  RecruitmentSettings,
  RecruitmentFileMeta,
} from "@/lib/recruitment/types";
import { fieldError, extensionOk, maxSizeMB } from "@/lib/recruitment/validation";
import { uploadFile } from "@/lib/recruitment/upload";
import { submitApplication } from "@/lib/recruitment/submit";

const IDENTITY_FIELD_NAMES = ["fullName", "email", "phone", "branch", "yearOfStudy"];

export default function RoleForm({
  role,
  settings,
}: {
  role: RecruitmentRole;
  settings: RecruitmentSettings | null;
}) {
  const s = useMemo<RecruitmentSettings>(
    () =>
      settings ?? {
        id: "global",
        isRecruitmentActive: true,
        globalMessage: "",
        allowedEmailDomain: "",
        maxResumeSizeMB: 10,
        maxTaskFileSizeMB: 10,
        allowedResumeTypes: [".pdf", ".doc", ".docx"],
        allowedTaskTypes: [".pdf", ".doc", ".docx", ".zip"],
        emailScriptUrl: null,
        driveUploadScriptUrl: null,
        notifyOnApplication: false,
        notificationEmails: [],
        updatedAt: null,
      },
    [settings],
  );

  // Identity is driven by the role's own schema fields (matched by name).
  // The fallback fields only appear for names the schema is missing but the
  // submit path requires (fullName/email).
  const fieldsByName = useMemo(() => {
    const m = new Map<string, RecruitmentRoleField>();
    for (const f of role.fields) m.set(f.name.toLowerCase(), f);
    return m;
  }, [role.fields]);

  const hasIdentity = (name: string) => fieldsByName.has(name.toLowerCase());
  const identityFieldNames = identityNamesInSchema();

  function identityNamesInSchema() {
    return IDENTITY_FIELD_NAMES.filter((n) => hasIdentity(n));
  }

  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [fileMetas, setFileMetas] = useState<Record<string, RecruitmentFileMeta>>({});
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [confirmInfo, setConfirmInfo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFileField, setPendingFileField] = useState<RecruitmentRoleField | null>(null);

  const orderedFields = useMemo(
    () => [...role.fields].sort((a, b) => a.order - b.order),
    [role.fields],
  );
  const sections = useMemo(
    () => [...role.sections].sort((a, b) => a.number - b.number),
    [role.sections],
  );

  // Applicants authenticate with their college mail, so Full Name + Email are
  // pre-filled directly from the signed-in user into the schema's identity
  // fields (kept as required in the schema).
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const fullNameField = fieldsByName.get("fullName");
    const emailField = fieldsByName.get("email");
    const prefill: Record<string, string> = {};
    if (fullNameField && u.displayName) prefill[fullNameField.name] = u.displayName;
    if (emailField && u.email) prefill[emailField.name] = u.email;
    if (Object.keys(prefill).length === 0) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(prefill)) {
        // Never clobber something the user already typed.
        if (!next[k] || String(next[k]).trim() === "") next[k] = v;
      }
      return next;
    });
  }, [fieldsByName]);

  function setValue(field: RecruitmentRoleField, value: string | boolean) {
    setValues((prev) => ({ ...prev, [field.name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field.name];
      return next;
    });
  }

  function handleFilePick(field: RecruitmentRoleField) {
    setPendingFileField(field);
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const field = pendingFileField;
    const file = e.target.files?.[0];
    e.target.value = "";
    setPendingFileField(null);
    if (!field || !file) return;

    if (field.allowedExtensions?.length) {
      const ok = extensionOk(file, field, s);
      if (!ok) {
        setErrors((prev) => ({
          ...prev,
          [field.name]: `Only ${field.allowedExtensions.join(", ")} files are allowed`,
        }));
        return;
      }
    }
    const cap = maxSizeMB(field, s);
    if (file.size > cap * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        [field.name]: `File exceeds the ${cap} MB limit`,
      }));
      return;
    }

    setUploading(field.name);
    try {
      const meta = await uploadFile(file, role.id, field.name);
      setFileMetas((prev) => ({
        ...prev,
        [field.name]: {
          url: meta.url,
          driveFileId: meta.driveFileId,
          originalName: meta.originalName,
          mimeType: meta.mimeType,
          sizeBytes: meta.sizeBytes,
        },
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field.name];
        return next;
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [field.name]: err instanceof Error ? err.message : "Upload failed",
      }));
    } finally {
      setUploading(null);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const f of orderedFields) {
      const msg = fieldError({
        field: f,
        value: values[f.name],
        fileMeta: fileMetas[f.name],
      });
      if (msg) errs[f.name] = msg;
    }
    if (!agreeToTerms) errs["_terms"] = "You must agree to the terms";
    if (!confirmInfo) errs["_confirm"] = "Please confirm your information is accurate";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      const resolvedEmail =
        (identityFieldNames.includes("email") &&
        typeof values[fieldsByName.get("email")!.name] === "string"
          ? String(values[fieldsByName.get("email")!.name])
          : "").trim();
      const resolvedName =
        (identityFieldNames.includes("fullName") &&
        typeof values[fieldsByName.get("fullName")!.name] === "string"
          ? String(values[fieldsByName.get("fullName")!.name])
          : "").trim();

      const applicant: Record<string, string | boolean> = {};
      const files: Record<string, { url: string; driveFileId: string; originalName: string; mimeType: string; sizeBytes: number }> = {};
      const answers: Record<string, string | boolean> = {};

      for (const f of orderedFields) {
        if (f.type === "info") continue;
        if (f.type === "file") {
          const meta = fileMetas[f.name];
          if (meta) {
            files[f.name] = {
              url: meta.url,
              driveFileId: meta.driveFileId,
              originalName: meta.originalName,
              mimeType: meta.mimeType,
              sizeBytes: meta.sizeBytes,
            };
          }
        } else if (typeof values[f.name] === "string" && String(values[f.name]).trim()) {
          // identity fields go into `applicant`, everything else into `answers`
          if (IDENTITY_FIELD_NAMES.includes(f.name.toLowerCase())) {
            applicant[f.name] = String(values[f.name]).trim();
          } else {
            answers[f.name] = String(values[f.name]).trim();
          }
        } else if (typeof values[f.name] === "boolean") {
          answers[f.name] = values[f.name] === true;
        }
      }

      // Minimal fallback fields: only present when the schema didn't define them.
      if (!hasIdentity("fullName") && resolvedName) applicant.fullName = resolvedName;
      if (!hasIdentity("email") && resolvedEmail) applicant.email = resolvedEmail;
      if (!hasIdentity("fullName") && !resolvedName)
        throw new Error("Full name is required");
      if (Object.values(applicant).length === 0 || (!applicant.fullName && !resolvedName))
        throw new Error("Full name is required");

      const id = await submitApplication({
        roleId: role.id,
        applicant,
        files,
        answers,
      });
      setSuccessId(id);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const fullNameValue =
    fieldsByName.get("fullName") && typeof values[fieldsByName.get("fullName")!.name] === "string"
      ? String(values[fieldsByName.get("fullName")!.name])
      : "";

  if (successId) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h2 className="text-2xl font-bold">Application submitted!</h2>
            <p className="text-muted-foreground">
              {fullNameValue ? (
                <>Thanks, <strong>{fullNameValue}</strong>! We&apos;ve received your application
                  and will get back to you via email.</>
              ) : (
                <>We&apos;ve received your application and will get back to you via email.</>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Reference: <code className="bg-muted px-1.5 py-0.5 rounded">{successId}</code>
            </p>
            <Button asChild variant="outline">
              <a href="/recruitment">Back to positions</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{role.icon}</span>
          <h1 className="text-2xl font-bold">{role.title}</h1>
        </div>
        <p className="text-muted-foreground mb-8">{role.description}</p>

        <form onSubmit={onSubmit} className="space-y-8">
          {sections.map((section) => {
            const sectionFields = orderedFields.filter((f) => f.section === section.number);
            if (sectionFields.length === 0) return null;
            return (
              <Card key={section.number} style={{ borderColor: section.borderColor }}>
                <CardHeader>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-5">
                  {sectionFields.map((field) => (
                    <FieldRow key={field.name} field={field} {...fieldRowProps(field)} />
                  ))}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardContent className="space-y-4 pt-5">
              <Label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={agreeToTerms}
                  onCheckedChange={(v) => {
                    setAgreeToTerms(v === true);
                    setErrors((p) => ({ ...p, _terms: "" }));
                  }}
                />
                <span className="text-sm">
                  I agree to the terms and conditions of the application process.
                </span>
              </Label>
              <Label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={confirmInfo}
                  onCheckedChange={(v) => {
                    setConfirmInfo(v === true);
                    setErrors((p) => ({ ...p, _confirm: "" }));
                  }}
                />
                <span className="text-sm">
                  I confirm that the information provided is accurate to the best of my knowledge.
                </span>
              </Label>
              {(errors._terms || errors._confirm) && (
                <p className="text-sm text-destructive">
                  {errors._terms || errors._confirm}
                </p>
              )}
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" className="w-full" disabled={busy || !!uploading}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? "Submitting…" : "Submit Application"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );

  function fieldRowProps(field: RecruitmentRoleField) {
    return {
      values,
      fileMetas,
      errors,
      uploading,
      setValue,
      onPickFile: () => handleFilePick(field),
      onRemoveFile: (name: string) =>
        setFileMetas((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        }),
    };
  }
}

function FieldRow({
  field,
  values,
  fileMetas,
  errors,
  uploading,
  setValue,
  onPickFile,
  onRemoveFile,
}: {
  field: RecruitmentRoleField;
  values: Record<string, string | boolean>;
  fileMetas: Record<string, RecruitmentFileMeta>;
  errors: Record<string, string>;
  uploading: string | null;
  setValue: (f: RecruitmentRoleField, v: string | boolean) => void;
  onPickFile: () => void;
  onRemoveFile: (name: string) => void;
}) {
  const value = values[field.name];
  const error = errors[field.name] || "";

  let control: React.ReactNode;
  if (field.type === "info") {
    control = (
      <div className="space-y-2 rounded-md border-l-4 border-blue-500 bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold">{field.label}</span>
        </div>
        {field.content && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {field.content}
          </p>
        )}
        {field.links && field.links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {field.links.map((l: { label: string; url: string }) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  } else if (field.type === "checkbox") {
    control = (
      <div className="space-y-2">
        <Label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={value === true}
            onCheckedChange={(v) => setValue(field, v === true)}
          />
          <span className="text-sm">
            {field.checkboxLabel ?? `${field.label} — I agree`}
            {field.required && <span className="text-destructive"> *</span>}
          </span>
        </Label>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  } else if (field.type === "file") {
    const meta = fileMetas[field.name];
    control = (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {meta ? (
            <>
              <a
                href={meta.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-sm underline-offset-4 hover:underline"
                title={meta.originalName}
              >
                {meta.originalName}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveFile(field.name)}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="flex-1 justify-start"
              onClick={onPickFile}
              disabled={uploading !== null}
            >
              {uploading === field.name ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading === field.name ? "Uploading…" : "Choose file"}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {field.helpText}
          {field.allowedExtensions?.length
            ? ` Allowed: ${field.allowedExtensions.join(", ")}`
            : ""}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  } else if (field.type === "select") {
    control = (
      <Select value={typeof value === "string" ? value : ""} onValueChange={(v) => setValue(field, v)}>
        <SelectTrigger className={cn(error && "border-destructive")}>
          <SelectValue placeholder={field.placeholder ?? "Select an option…"} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o: { label: string; value: string }) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else {
    const type =
      field.type === "email"
        ? "email"
        : field.type === "tel"
          ? "tel"
          : field.type === "number"
            ? "number"
            : field.type === "url"
              ? "url"
              : "text";
    control = (
      <Input
        type={type}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        onChange={(e) => setValue(field, e.target.value)}
        className={cn(error && "border-destructive")}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {field.type !== "checkbox" && field.type !== "info" && (
        <Label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      {control}
    </div>
  );
}