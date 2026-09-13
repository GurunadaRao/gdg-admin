/**
 * Types for the recruitment module — matches the GDG client-side schema.
 * Collections: recruitment_roles, recruitment_applications, recruitment_settings.
 */

export type RoleStatus =
  | "draft"
  | "open"
  | "closing-soon"
  | "closed"
  | "archived";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "select"
  | "file"
  | "checkbox"
  | "info";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "interview_scheduled"
  | "interviewed"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "withdrawn";

export type ReviewVerdict = "pending" | "shortlist" | "reject" | "waitlist";

export interface RecruitmentRoleSection {
  number: number;
  title: string;
  description?: string;
  borderColor: string;
}

export interface RecruitmentRoleField {
  name: string;
  label: string;
  type: FieldType;
  section: number;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  accept?: string;
  maxSizeMB?: number;
  allowedExtensions?: string[];
  checkboxLabel?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  order: number;
  /** Mandatory for `file` fields — Google Drive folder where uploads are stored. */
  driveFolderId?: string;
  /** Only for `info` fields: body text shown to the applicant (read-only). */
  content?: string;
  /** Only for `info` fields: links shown to the applicant (read-only). */
  links?: { label: string; url: string }[];
}

export interface RecruitmentRole {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  status: RoleStatus;
  maxApplications: number | null;
  applicationStart: string | null;
  applicationEnd: string | null;
  sections: RecruitmentRoleSection[];
  fields: RecruitmentRoleField[];
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  applicationCount?: number;
}

export type RecruitmentRoleInput = Omit<
  RecruitmentRole,
  "id" | "createdAt" | "updatedAt" | "applicationCount"
>;

export interface RecruitmentApplicantInfo {
  fullName: string;
  email: string;
  phone: string;
  branch: string;
  yearOfStudy: string;
}

export interface RecruitmentSocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  gitRepoLink?: string;
}

export interface RecruitmentFileMeta {
  url: string;
  driveFileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RecruitmentFiles {
  resume: RecruitmentFileMeta;
  taskSubmission?: RecruitmentFileMeta;
}

export interface RecruitmentApplication {
  id: string;
  roleId: string;
  userId: string | null;
  userEmail: string;
  applicant: RecruitmentApplicantInfo;
  socialLinks: RecruitmentSocialLinks;
  files: RecruitmentFiles;
  answers: Record<string, unknown>;
  status: ApplicationStatus;
  currentReviewer: string | null;
  shortlistedAt: string | null;
  reviewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  dedupeKey: string;
  agreeToTerms: boolean;
  confirmInfo: boolean;
  isRead: boolean;
  isStarred: boolean;
  notes: string;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface RecruitmentReviewCriteria {
  technical: number | null;
  communication: number | null;
  portfolio: number | null;
  culturalFit: number | null;
}

export interface RecruitmentReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  score: number | null;
  criteria: RecruitmentReviewCriteria;
  verdict: ReviewVerdict;
  strengths: string;
  weaknesses: string;
  comments: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RecruitmentStatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  reason: string;
  createdAt: string | null;
}

export interface ApplicationDetail extends RecruitmentApplication {
  reviews: RecruitmentReview[];
  statusHistory: RecruitmentStatusHistoryEntry[];
}

export interface RecruitmentSettings {
  id: string;
  isRecruitmentActive: boolean;
  globalMessage: string;
  allowedEmailDomain: string;
  maxResumeSizeMB: number;
  maxTaskFileSizeMB: number;
  allowedResumeTypes: string[];
  allowedTaskTypes: string[];
  notifyOnApplication: boolean;
  notificationEmails: string[];
  /** Apps Script web app (doPost) that saves uploaded files to a Drive folder. */
  driveUploadScriptUrl: string | null;
  /** Apps Script web app (doPost) that emails the applicant a confirmation. */
  emailScriptUrl: string | null;
  updatedAt: string | null;
}

/** Reusable field definition an admin can save and re-use when building roles. */
export interface RecruitmentFieldTemplate {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  accept?: string;
  maxSizeMB?: number;
  allowedExtensions?: string[];
  checkboxLabel?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  /** Only for `info` field templates. */
  content?: string;
  links?: { label: string; url: string }[];
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Reusable complete form (sections + fields) an admin can save and re-use when
 * building roles. Loaded into the role form builder and modified per role.
 * `driveFolderId` links are intentionally not stored — they are decided per-role.
 */
export interface RecruitmentFormTemplate {
  id: string;
  name: string;
  description: string;
  sections: RecruitmentRoleSection[];
  fields: RecruitmentRoleField[];
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}