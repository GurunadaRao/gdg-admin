"use client";

import React, { useState, useRef } from "react";
import { Mail, Linkedin, Pencil, X, Loader2, Save, Trash2, Upload } from "lucide-react";
import MemberRolesManager from "@/components/admin/members/MemberRolesManager";

export type TeamMemberRole = {
  id: string;
  position: string;
  designation: string;
  rank: number;
  dept_rank: number;
  dept_logo?: string;
  isActive: boolean;
};

export type MemberCardProps = {
  bgColor?: string | null;
  logo?: string | null;
  id: string;
  imageUrl?: string | null;
  name: string;
  linkedinUrl?: string | null;
  mail?: string | null;
  isAlumni?: boolean;
  roles?: TeamMemberRole[];
  // display props
  displayPosition?: string | null;
  displayDesignation?: string | null;
  // legacy
  designation?: string | null;
  position?: string | null;
  rank?: number | null;
  dept_rank?: number | null;
  dept_logo?: string | null;
};

type MemberCardComponentProps = MemberCardProps & {
  onDelete?: (id: string) => void;
  onUpdate?: () => void;
};

export default function MemberCard({
  id,
  imageUrl,
  name,
  designation,
  linkedinUrl,
  mail,
  logo,
  bgColor,
  isAlumni,
  displayDesignation,
  onDelete,
  onUpdate,
}: MemberCardComponentProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rolesChanged, setRolesChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: name || "",
    imageUrl: imageUrl || "",
    mail: mail || "",
    linkedinUrl: linkedinUrl || "",
    bgColor: bgColor || "",
    isAlumni: isAlumni ?? false,
  });

  function openEdit() {
    setForm({
      name: name || "",
      imageUrl: imageUrl || "",
      mail: mail || "",
      linkedinUrl: linkedinUrl || "",
      bgColor: bgColor || "",
      isAlumni: isAlumni ?? false,
      });
    setSaved(false);
    setError(null);
    setConfirmDelete(false);
    setRolesChanged(false);
    setEditOpen(true);
  }

  // Role changes can move this card to another department group, which would
  // unmount the open dialog, so the page is refreshed only when it is closed.
  function closeEdit() {
    setEditOpen(false);
    if (rolesChanged) {
      setRolesChanged(false);
      if (onUpdate) onUpdate();
      else window.location.reload();
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
      } else {
        setSaved(true);
        setTimeout(() => {
          setEditOpen(false);
          if (onUpdate) onUpdate();
          else window.location.reload();
        }, 800);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
      } else {
        handleChange("imageUrl", data.url);
      }
    } catch {
      setError("Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Delete failed");
      } else {
        setEditOpen(false);
        if (onDelete) onDelete(id);
        else window.location.reload();
      }
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="w-[290px] rounded-lg overflow-hidden border border-border shadow-sm bg-card relative group">
        {/* Edit button — visible on hover */}
        <button
          onClick={openEdit}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-card/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card"
          aria-label={`Edit ${name}`}
        >
          <Pencil className="w-4 h-4 text-stone-700" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-sky-200" />
            <div className="w-3 h-3 rounded-full bg-green-100" />
            <div className="w-3 h-3 rounded-full bg-yellow-100" />
          </div>
          {isAlumni && (
            <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
              Alumni
            </div>
          )}
        </div>

        {/* Image area */}
        <div
          style={{ backgroundColor: bgColor || "#e6fffa" }}
          className="flex items-center justify-center h-[272px] w-[287px]"
        >
          <img
            src={
              imageUrl ||
              "https://res.cloudinary.com/duvr3z2z0/image/upload/v1764391657/Screenshot_2025-11-29_095727_wptmhb.png"
            }
            alt={String(name)}
            className="object-cover h-full w-full"
          />
        </div>

        {/* Footer / details */}
        <div className="px-4 py-3 flex flex-col justify-between">
          <div>
            <h3 className="font-medium text-card-foreground w-full text-lg font-productSans">
              {name}
            </h3>
          </div>
          <div className="flex justify-between items-center">
            <h1
              className="text-[20px] text-green-600 font-semibold mt-1 font-productSans text-wrap"
              style={{ color: bgColor || "#38a169" }}
            >
              {displayDesignation || designation}
            </h1>

            <div className="flex space-x-3">
              {mail && (
                <a
                  href={`mailto:${mail}`}
                  aria-label={`Email ${name}`}
                  className="p-2 rounded-md border border-border"
                >
                  <Mail className="w-7 h-7 text-foreground" />
                </a>
              )}

              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${name} on LinkedIn`}
                  className="p-2 rounded-md border border-border"
                >
                  <Linkedin className="w-7 h-7 text-foreground" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit overlay */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeEdit}
        >
          <div
            className="relative w-[90vw] max-w-4xl max-h-[90vh] bg-card rounded-lg shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeEdit}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-md hover:bg-stone-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-stone-600" />
            </button>

            <div className="flex flex-col md:flex-row">
              {/* Left: Photo */}
              <div
                style={{ backgroundColor: form.bgColor || "#e6fffa" }}
                className="md:w-1/2 flex flex-col items-center justify-center p-6 gap-4"
              >
                <img
                  src={
                    form.imageUrl ||
                    "https://res.cloudinary.com/duvr3z2z0/image/upload/v1764391657/Screenshot_2025-11-29_095727_wptmhb.png"
                  }
                  alt={form.name}
                  className="w-full max-h-[350px] object-contain rounded-md"
                />
                <div className="w-full">
                  <label className="text-xs font-medium text-stone-600">
                    Photo
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-md bg-card/80 hover:bg-card transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploading ? "Uploading..." : "Upload Photo"}
                  </button>
                </div>
              </div>

              {/* Right: Editable fields */}
              <div className="md:w-1/2 p-6 space-y-4">
                <h2 className="text-xl font-bold text-foreground">
                  Edit Member
                </h2>

                <div className="space-y-3">
                  <Field
                    label="Name"
                    value={form.name}
                    onChange={(v) => handleChange("name", v)}
                  />
                  <Field
                    label="Email"
                    value={form.mail}
                    onChange={(v) => handleChange("mail", v)}
                    type="email"
                  />
                  <Field
                    label="LinkedIn URL"
                    value={form.linkedinUrl}
                    onChange={(v) => handleChange("linkedinUrl", v)}
                    type="url"
                  />
                  
                  <MemberRolesManager
                    memberId={id}
                    onChanged={() => setRolesChanged(true)}
                  />

                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="isAlumni-edit"
                      checked={form.isAlumni}
                      onChange={(e) => handleChange("isAlumni", e.target.checked as any)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <label htmlFor="isAlumni-edit" className="text-sm font-medium text-foreground">
                      Is Alumni?
                    </label>
                  </div>
                </div>

                {/* Status + Save + Delete */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || deleting}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? "Saving..." : "Save Changes"}
                  </button>

                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      disabled={saving || deleting}
                      className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground rounded-md hover:bg-muted disabled:opacity-50 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {deleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {deleting ? "Deleting..." : "Confirm Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                        className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {saved && (
                    <span className="text-green-600 text-sm font-medium">
                      Saved!
                    </span>
                  )}
                  {error && (
                    <span className="text-red-600 text-sm">{error}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
