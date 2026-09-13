import type { RecruitmentRoleField, RecruitmentSettings, RecruitmentFileMeta } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function fieldError({
  field,
  value,
  fileMeta,
}: {
  field: RecruitmentRoleField;
  value: string | boolean | undefined;
  fileMeta: RecruitmentFileMeta | undefined;
}): string | null {
  if (field.type === "info") return null;
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
    try { new URL(v); } catch { return "Enter a valid URL"; }
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

export function extensionOk(
  file: File,
  field: RecruitmentRoleField,
  settings: RecruitmentSettings,
): boolean {
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const allowed = field.allowedExtensions?.length
    ? field.allowedExtensions
    : field.accept
      ? field.accept.split(",").map((x) => x.trim()).filter(Boolean)
      : field.name === "resume"
        ? settings.allowedResumeTypes
        : field.name === "taskSubmission"
          ? settings.allowedTaskTypes
          : [];
  if (!allowed.length) return true;
  return allowed.some((a) =>
    a.toLowerCase().startsWith(".")
      ? a.toLowerCase() === ext
      : file.type.toLowerCase().includes(a.toLowerCase()),
  );
}

export function maxSizeMB(
  field: RecruitmentRoleField,
  settings: RecruitmentSettings,
): number {
  return (
    field.maxSizeMB ??
    (field.name === "resume"
      ? settings.maxResumeSizeMB
      : field.name === "taskSubmission"
        ? settings.maxTaskFileSizeMB
        : 10)
  );
}
