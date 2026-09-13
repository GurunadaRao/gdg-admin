import type {
  ApplicationStatus,
  RecruitmentApplication,
  RecruitmentFieldTemplate,
  RecruitmentFormTemplate,
  RecruitmentRole,
  RecruitmentSettings,
  RoleStatus,
} from "./types/recruitment";

export const COLLECTIONS = {
  roles: "recruitment_roles",
  applications: "recruitment_applications",
  settings: "recruitment_settings",
  fieldTemplates: "recruitment_field_templates",
  formTemplates: "recruitment_form_templates",
} as const;

export const SETTINGS_DOC_ID = "global";

export const ROLE_STATUSES: RoleStatus[] = [
  "draft",
  "open",
  "closing-soon",
  "closed",
  "archived",
];

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "submitted",
  "under_review",
  "shortlisted",
  "interview_scheduled",
  "interviewed",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
};

export const STATUS_CLASSES: Record<ApplicationStatus, string> = {
  submitted: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  under_review: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  shortlisted: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  interview_scheduled: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  interviewed: "bg-teal-500/15 text-teal-600 border-teal-500/30",
  accepted: "bg-green-500/15 text-green-600 border-green-500/30",
  rejected: "bg-red-500/15 text-red-600 border-red-500/30",
  waitlisted: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  withdrawn: "bg-slate-500/15 text-slate-600 border-slate-500/30",
};

export const ROLE_STATUS_CLASSES: Record<RoleStatus, string> = {
  draft: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  open: "bg-green-500/15 text-green-600 border-green-500/30",
  "closing-soon": "bg-amber-500/15 text-amber-600 border-amber-500/30",
  closed: "bg-red-500/15 text-red-600 border-red-500/30",
  archived: "bg-slate-700/15 text-slate-500 border-slate-700/30",
};

export const LEGAL_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ["under_review", "rejected", "waitlisted"],
  under_review: ["shortlisted", "rejected", "waitlisted"],
  shortlisted: ["interview_scheduled", "rejected", "waitlisted", "accepted"],
  interview_scheduled: ["interviewed", "rejected", "waitlisted"],
  interviewed: ["accepted", "rejected", "waitlisted"],
  accepted: ["withdrawn", "waitlisted"],
  rejected: [],
  waitlisted: ["shortlisted", "accepted", "rejected"],
  withdrawn: [],
};

/** Convert a Firestore Timestamp (or serialised {_seconds}) to an ISO string. */
export function tsToISO(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const maybe = value as {
      toDate?: () => Date;
      _seconds?: number;
      seconds?: number;
    };
    if (typeof maybe.toDate === "function") {
      const d = maybe.toDate();
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const secs = maybe._seconds ?? maybe.seconds;
    if (typeof secs === "number") {
      const d = new Date(secs * 1000);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
  }
  return null;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asIso(v: unknown): string | null {
  return typeof v === "string" ? v : tsToISO(v);
}

export function normaliseRole(raw: Record<string, unknown>): RecruitmentRole {
  return {
    id: asStr(raw.id),
    title: asStr(raw.title),
    description: asStr(raw.description),
    icon: asStr(raw.icon),
    color: asStr(raw.color) || "#4285F4",
    status: (asStr(raw.status) || "draft") as RoleStatus,
    maxApplications:
      typeof raw.maxApplications === "number" ? raw.maxApplications : null,
    applicationStart: asIso(raw.applicationStart),
    applicationEnd: asIso(raw.applicationEnd),
    sections: asArr(raw.sections) as RecruitmentRole["sections"],
    fields: asArr(raw.fields) as RecruitmentRole["fields"],
    createdBy: asStr(raw.createdBy),
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    applicationCount:
      typeof raw.applicationCount === "number" ? raw.applicationCount : undefined,
  };
}

export function normaliseApplication(
  raw: Record<string, unknown>,
): RecruitmentApplication {
  return {
    id: asStr(raw.id),
    roleId: asStr(raw.roleId),
    userId: typeof raw.userId === "string" ? raw.userId : null,
    userEmail: asStr(raw.userEmail),
    applicant: (raw.applicant as RecruitmentApplication["applicant"]) ?? {
      fullName: "",
      email: "",
      phone: "",
      branch: "",
      yearOfStudy: "",
    },
    socialLinks: (raw.socialLinks as RecruitmentApplication["socialLinks"]) ?? {},
    files: (raw.files as RecruitmentApplication["files"]) ?? {},
    answers:
      raw.answers &&
      typeof raw.answers === "object" &&
      !Array.isArray(raw.answers)
        ? (raw.answers as Record<string, unknown>)
        : {},
    status: (asStr(raw.status) || "submitted") as ApplicationStatus,
    currentReviewer:
      typeof raw.currentReviewer === "string" ? raw.currentReviewer : null,
    shortlistedAt: asIso(raw.shortlistedAt),
    reviewedAt: asIso(raw.reviewedAt),
    acceptedAt: asIso(raw.acceptedAt),
    rejectedAt: asIso(raw.rejectedAt),
    rejectedReason:
      typeof raw.rejectedReason === "string" ? raw.rejectedReason : null,
    dedupeKey: asStr(raw.dedupeKey),
    agreeToTerms: raw.agreeToTerms === true,
    confirmInfo: raw.confirmInfo === true,
    isRead: raw.isRead === true,
    isStarred: raw.isStarred === true,
    notes: asStr(raw.notes),
    submittedAt: asIso(raw.submittedAt),
    updatedAt: asIso(raw.updatedAt),
  };
}

export const DEFAULT_SETTINGS: Omit<RecruitmentSettings, "updatedAt"> = {
  id: SETTINGS_DOC_ID,
  isRecruitmentActive: false,
  globalMessage: "",
  allowedEmailDomain: "@vishnu.edu.in",
  maxResumeSizeMB: 5,
  maxTaskFileSizeMB: 10,
  allowedResumeTypes: [".pdf", ".doc", ".docx"],
  allowedTaskTypes: [".doc", ".docx"],
  notifyOnApplication: false,
  notificationEmails: [],
  driveUploadScriptUrl: null,
  emailScriptUrl: null,
};

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

export function normaliseSettings(
  raw: Record<string, unknown> | undefined,
): RecruitmentSettings {
  const strArr = (v: unknown, fallback: string[]): string[] =>
    Array.isArray(v) ? (v as string[]) : fallback;

  return {
    id: SETTINGS_DOC_ID,
    isRecruitmentActive: raw?.isRecruitmentActive === true,
    globalMessage: asStr(raw?.globalMessage),
    allowedEmailDomain:
      asStr(raw?.allowedEmailDomain) || DEFAULT_SETTINGS.allowedEmailDomain,
    maxResumeSizeMB:
      typeof raw?.maxResumeSizeMB === "number"
        ? raw.maxResumeSizeMB
        : DEFAULT_SETTINGS.maxResumeSizeMB,
    maxTaskFileSizeMB:
      typeof raw?.maxTaskFileSizeMB === "number"
        ? raw.maxTaskFileSizeMB
        : DEFAULT_SETTINGS.maxTaskFileSizeMB,
    allowedResumeTypes: strArr(
      raw?.allowedResumeTypes,
      DEFAULT_SETTINGS.allowedResumeTypes,
    ),
    allowedTaskTypes: strArr(
      raw?.allowedTaskTypes,
      DEFAULT_SETTINGS.allowedTaskTypes,
    ),
    notifyOnApplication: raw?.notifyOnApplication === true,
    notificationEmails: strArr(
      raw?.notificationEmails,
      DEFAULT_SETTINGS.notificationEmails,
    ),
    driveUploadScriptUrl: strOrNull(raw?.driveUploadScriptUrl),
    // `scriptUrl` was the legacy name for the email webhook — keep reading it
    // so already-configured deployments keep working after the rename.
    emailScriptUrl: strOrNull(raw?.emailScriptUrl) ?? strOrNull(raw?.scriptUrl),
    updatedAt: tsToISO(raw?.updatedAt),
  };
}

export function normaliseFieldTemplate(
  raw: Record<string, unknown>,
): RecruitmentFieldTemplate {
  return {
    id: asStr(raw.id),
    name: asStr(raw.name),
    label: asStr(raw.label),
    type: (asStr(raw.type) || "text") as RecruitmentFieldTemplate["type"],
    required: raw.required === true,
    placeholder: strOrNull(raw.placeholder) ?? undefined,
    helpText: strOrNull(raw.helpText) ?? undefined,
    options: Array.isArray(raw.options)
      ? (raw.options as RecruitmentFieldTemplate["options"])
      : undefined,
    accept: strOrNull(raw.accept) ?? undefined,
    maxSizeMB:
      typeof raw.maxSizeMB === "number" ? raw.maxSizeMB : undefined,
    allowedExtensions: Array.isArray(raw.allowedExtensions)
      ? (raw.allowedExtensions as string[])
      : undefined,
    checkboxLabel: strOrNull(raw.checkboxLabel) ?? undefined,
    minLength: typeof raw.minLength === "number" ? raw.minLength : undefined,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : undefined,
    pattern: strOrNull(raw.pattern) ?? undefined,
    patternMessage: strOrNull(raw.patternMessage) ?? undefined,
    content: strOrNull(raw.content) ?? undefined,
    links: Array.isArray(raw.links)
      ? (raw.links as RecruitmentFieldTemplate["links"])
      : undefined,
    createdBy: asStr(raw.createdBy),
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
  };
}

export function normaliseFormTemplate(
  raw: Record<string, unknown>,
): RecruitmentFormTemplate {
  return {
    id: asStr(raw.id),
    name: asStr(raw.name),
    description: strOrNull(raw.description) ?? "",
    sections: asArr(raw.sections) as RecruitmentFormTemplate["sections"],
    fields: asArr(raw.fields) as RecruitmentFormTemplate["fields"],
    createdBy: asStr(raw.createdBy),
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
  };
}