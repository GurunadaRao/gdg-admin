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
export type RoleStatus =
  | "draft"
  | "open"
  | "closing-soon"
  | "closed"
  | "archived";

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
  driveFolderId?: string;
  maxSizeMB?: number;
  allowedExtensions?: string[];
  checkboxLabel?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  order: number;
  /** Only for `info` fields — body text shown read-only to the applicant. */
  content?: string;
  /** Only for `info` fields — links shown read-only to the applicant. */
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
  applicationStart: string | number | null;
  applicationEnd: string | number | null;
  sections: RecruitmentRoleSection[];
  fields: RecruitmentRoleField[];
  applicationCount?: number;
  createdAt: unknown;
  updatedAt: unknown;
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
  emailScriptUrl: string | null;
  driveUploadScriptUrl: string | null;
  notifyOnApplication: boolean;
  notificationEmails: string[];
  updatedAt: unknown;
}

export interface RecruitmentFileMeta {
  url: string;
  driveFileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}
