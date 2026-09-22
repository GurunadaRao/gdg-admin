"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Loader2,
  Plus,
  X,
  Save,
  Upload,
} from "lucide-react";
import GoogleLoader from "@/components/GoogleLoader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MemberCard, {
  type MemberCardProps,
} from "@/components/admin/cards/MemberCard";

const EMPTY_FORM = {
  name: "",
  designation: "",
  position: "",
  imageUrl: "",
  mail: "",
  linkedinUrl: "",
  bgColor: "",
  logo: "",
  dept_logo: "",
  isAlumni: false,
  roles: [{
    id: "role-initial",
    position: "",
    designation: "",
    rank: 0,
    dept_rank: 0,
    isActive: true
  }],
};

export default function MembersPage() {
  const [members, setMembers] = useState<MemberCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [addUploading, setAddUploading] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Search/filter
  const [search, setSearch] = useState("");

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/members", { cache: "no-store" });
      const json = await res.json();
      if (Array.isArray(json)) {
        setMembers(json);
        setError(null);
      } else if (json.error) {
        setError(json.error);
      } else {
        setError("Unexpected response format");
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
      setError("Network error fetching members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  function openAddDialog() {
    setAddForm({ ...EMPTY_FORM });
    setCreateError(null);
    setAddOpen(true);
  }

  function handleAddChange(field: string, value: any) {
    setAddForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddRoleChange(index: number, field: string, value: any) {
    const newRoles = [...addForm.roles];
    newRoles[index] = { ...newRoles[index], [field]: value };
    setAddForm((prev) => ({ ...prev, roles: newRoles }));
  }

  function addRole() {
    setAddForm((prev) => ({
      ...prev,
      roles: [
        ...prev.roles,
        {
          id: `role-${Date.now()}`,
          position: "",
          designation: "",
          rank: 0,
          dept_rank: 0,
          isActive: true
        }
      ]
    }));
  }

  async function handleAddImageUpload(file: File) {
    setAddUploading(true);
    setCreateError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Upload failed");
      } else {
        handleAddChange("imageUrl", data.url);
      }
    } catch {
      setCreateError("Image upload failed");
    } finally {
      setAddUploading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) {
      setCreateError("Name is required");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create member");
      } else {
        setAddOpen(false);
        fetchMembers();
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  }

  function handleDelete(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function handleUpdate() {
    fetchMembers();
  }

  // Filter members by search query
  const filtered = search.trim()
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          (m.designation || "").toLowerCase().includes(search.toLowerCase()) ||
          (m.position || "").toLowerCase().includes(search.toLowerCase()) ||
          (m.mail || "").toLowerCase().includes(search.toLowerCase()),
      )
    : members;

  const stats = [
    {
      title: "Total Members",
      value: String(members.length),
      description: "All team members",
      icon: Users,
    },
    {
      title: "With LinkedIn",
      value: String(members.filter((m) => m.linkedinUrl).length),
      description: "Profiles linked",
      icon: UserPlus,
    },
    {
      title: "With Email",
      value: String(members.filter((m) => m.mail).length),
      description: "Contactable",
      icon: UserCheck,
    },
    {
      title: "Positions",
      value: String(new Set(members.map((m) => m.designation)).size),
      description: "Unique roles",
      icon: UserX,
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title="Members" />

      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Team Members</h2>
            <p className="text-muted-foreground">
              Manage and view all GDG community team members.
            </p>
          </div>
          <Button variant="outline" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        </div>

        {/* Search bar */}
        <div className="max-w-sm">
          <Input
            placeholder="Search by name, designation, position, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <GoogleLoader message="Loading members..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">
              {search.trim() ? "No members match your search" : "No team members found"}
            </p>
            <p className="text-sm">
              {search.trim()
                ? "Try a different search term."
                : "Add team members to see them here."}
            </p>
          </div>
        ) : (
          <div className="space-y-8 w-full">
            {/* Active Members */}
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-6 pl-4 border-l-4 border-primary">
                Active Team Members
              </h3>
              <div className="space-y-4 w-full">
                {(() => {
                  const grouped = filtered
                    .filter((m) => !m.isAlumni)
                    .reduce<Record<string, MemberCardProps[]>>((acc, member) => {
                      const activeRoles = member.roles?.filter(r => r.isActive) || [];
                      if (activeRoles.length === 0) {
                        const pos = (member.position || "").trim() || "Unspecified";
                        if (!acc[pos]) acc[pos] = [];
                        acc[pos].push(member);
                      } else {
                        activeRoles.forEach(role => {
                          const pos = (role.position || "").trim() || "Unspecified";
                          if (!acc[pos]) acc[pos] = [];
                          acc[pos].push({
                            ...member,
                            displayPosition: role.position,
                            displayDesignation: role.designation,
                            rank: role.rank,
                            dept_rank: role.dept_rank
                          });
                        });
                      }
                      return acc;
                    }, {});

                  const sortedEntries = Object.entries(grouped).sort((a, b) => {
                    const dra = typeof a[1][0]?.dept_rank === "number" ? a[1][0].dept_rank : 0;
                    const drb = typeof b[1][0]?.dept_rank === "number" ? b[1][0].dept_rank : 0;
                    return dra - drb;
                  });

                  sortedEntries.forEach(([_, groupMembers]) => {
                    groupMembers.sort((a, b) => {
                      const ra = typeof a.rank === "number" ? a.rank : 0;
                      const rb = typeof b.rank === "number" ? b.rank : 0;
                      if (ra !== rb) return ra - rb;
                      return (a.name || "").localeCompare(b.name || "");
                    });
                  });

                  return sortedEntries.map(([position, groupMembers]) => (
              <section
                key={position}
                className="flex flex-col items-center w-full"
              >
                {/* Position header */}
                <div
                  style={{
                    backgroundColor: groupMembers[0]?.bgColor || undefined,
                  }}
                  className="w-[330px] h-[54px] sm:w-[370px] lg:w-[800px] text-center rounded-[100px] items-center justify-center flex border-2 border-foreground"
                >
                  <h2 className="text-xl font-semibold sm:m-1 p-2 text-center text-foreground">
                    {position}
                  </h2>
                </div>

                <div className="h-4" />

                {/* Mobile: horizontal scroll */}
                <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 md:hidden">
                  <div className="flex gap-6 px-4 min-w-max justify-center">
                    {groupMembers.map((m) => (
                      <div key={m.id} className="flex-shrink-0">
                        <MemberCard
                          id={m.id}
                          imageUrl={m.imageUrl || "/file.svg"}
                          name={m.name}
                          designation={m.designation || "MEMBER"}
                          position={m.position || undefined}
                          linkedinUrl={m.linkedinUrl || undefined}
                          mail={m.mail || undefined}
                          bgColor={m.bgColor || undefined}
                          logo={m.logo || undefined}
                          rank={m.rank}
                          dept_rank={m.dept_rank}
                          dept_logo={m.dept_logo}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop: alternating 3-2-3-2 row layout creates a honeycomb-like grid */}
                <div className="hidden md:block w-full px-4">
                  {groupMembers.length > 4 ? (
                    <div className="space-y-6">
                      {(() => {
                        const rows: React.ReactNode[] = [];
                        let index = 0;
                        let rowIdx = 0;
                        while (index < groupMembers.length) {
                          const isOddRow = rowIdx % 2 === 0;
                          const cardsInRow = isOddRow ? 3 : 2;
                          const rowMembers = groupMembers.slice(
                            index,
                            index + cardsInRow,
                          );
                          rows.push(
                            <div
                              key={index}
                              className="flex gap-6 justify-center"
                            >
                              {rowMembers.map((m) => (
                                <div key={m.id} className="flex-shrink-0">
                                  <MemberCard
                                    id={m.id}
                                    imageUrl={m.imageUrl || "/file.svg"}
                                    name={m.name}
                                    designation={m.designation || "MEMBER"}
                                    position={m.position || undefined}
                                    linkedinUrl={m.linkedinUrl || undefined}
                                    mail={m.mail || undefined}
                                    bgColor={m.bgColor || undefined}
                                    logo={m.logo || undefined}
                                    rank={m.rank}
                                    dept_rank={m.dept_rank}
                                    dept_logo={m.dept_logo}
                                    isAlumni={m.isAlumni}
                                    onDelete={handleDelete}
                                    onUpdate={handleUpdate}
                                  />
                                </div>
                              ))}
                            </div>,
                          );
                          index += cardsInRow;
                          rowIdx++;
                        }
                        return rows;
                      })()}
                    </div>
                  ) : (
                    <div className="flex gap-6 justify-center">
                      {groupMembers.map((m) => (
                        <div key={m.id} className="flex-shrink-0">
                          <MemberCard
                            id={m.id}
                            imageUrl={m.imageUrl || "/file.svg"}
                            name={m.name}
                            designation={m.designation || "MEMBER"}
                            position={m.position || undefined}
                            linkedinUrl={m.linkedinUrl || undefined}
                            mail={m.mail || undefined}
                            bgColor={m.bgColor || undefined}
                            logo={m.logo || undefined}
                            rank={m.rank}
                            dept_rank={m.dept_rank}
                            dept_logo={m.dept_logo}
                            isAlumni={m.isAlumni}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))
          })()}
              </div>
            </div>

            {/* Alumni Members */}
            {filtered.filter((m) => m.isAlumni).length > 0 && (
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-6 pl-4 border-l-4 border-stone-400">
                  Alumni Team Members
                </h3>
                <div className="space-y-8 w-full">
                  {(() => {
                    const grouped = filtered
                      .filter((m) => m.isAlumni)
                      .reduce<Record<string, MemberCardProps[]>>((acc, member) => {
                        const activeRoles = member.roles?.filter(r => r.isActive) || [];
                        if (activeRoles.length === 0) {
                          const pos = (member.position || "").trim() || "Unspecified";
                          if (!acc[pos]) acc[pos] = [];
                          acc[pos].push(member);
                        } else {
                          activeRoles.forEach(role => {
                            const pos = (role.position || "").trim() || "Unspecified";
                            if (!acc[pos]) acc[pos] = [];
                            acc[pos].push({
                              ...member,
                              displayPosition: role.position,
                              displayDesignation: role.designation,
                              rank: role.rank,
                              dept_rank: role.dept_rank
                            });
                          });
                        }
                        return acc;
                      }, {});

                    const sortedEntries = Object.entries(grouped).sort((a, b) => {
                      const dra = typeof a[1][0]?.dept_rank === "number" ? a[1][0].dept_rank : 0;
                      const drb = typeof b[1][0]?.dept_rank === "number" ? b[1][0].dept_rank : 0;
                      return dra - drb;
                    });

                    sortedEntries.forEach(([_, groupMembers]) => {
                      groupMembers.sort((a, b) => {
                        const ra = typeof a.rank === "number" ? a.rank : 0;
                        const rb = typeof b.rank === "number" ? b.rank : 0;
                        if (ra !== rb) return ra - rb;
                        return (a.name || "").localeCompare(b.name || "");
                      });
                    });

                    return sortedEntries.map(([position, groupMembers]) => (
                    <section
                      key={position}
                      className="flex flex-col items-center w-full"
                    >
                      <div
                        style={{
                          backgroundColor: groupMembers[0]?.bgColor || undefined,
                        }}
                        className="w-[330px] h-[54px] sm:w-[370px] lg:w-[800px] text-center rounded-[100px] items-center justify-center flex border-2 border-foreground"
                      >
                        <h2 className="text-xl font-semibold sm:m-1 p-2 text-center text-foreground">
                          {position}
                        </h2>
                      </div>

                      <div className="h-4" />

                      <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 md:hidden">
                        <div className="flex gap-6 px-4 min-w-max justify-center">
                          {groupMembers.map((m) => (
                            <div key={m.id} className="flex-shrink-0">
                              <MemberCard
                                id={m.id}
                                imageUrl={m.imageUrl || "/file.svg"}
                                name={m.name}
                                designation={m.designation || "MEMBER"}
                                position={m.position || undefined}
                                linkedinUrl={m.linkedinUrl || undefined}
                                mail={m.mail || undefined}
                                bgColor={m.bgColor || undefined}
                                logo={m.logo || undefined}
                                rank={m.rank}
                                dept_rank={m.dept_rank}
                                dept_logo={m.dept_logo}
                                isAlumni={m.isAlumni}
                                onDelete={handleDelete}
                                onUpdate={handleUpdate}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="hidden md:block w-full px-4">
                        {groupMembers.length > 4 ? (
                          <div className="space-y-6">
                            {(() => {
                              const rows: React.ReactNode[] = [];
                              let index = 0;
                              let rowIdx = 0;
                              while (index < groupMembers.length) {
                                const isOddRow = rowIdx % 2 === 0;
                                const cardsInRow = isOddRow ? 3 : 2;
                                const rowMembers = groupMembers.slice(
                                  index,
                                  index + cardsInRow,
                                );
                                rows.push(
                                  <div
                                    key={index}
                                    className="flex gap-6 justify-center"
                                  >
                                    {rowMembers.map((m) => (
                                      <div key={m.id} className="flex-shrink-0">
                                        <MemberCard
                                          id={m.id}
                                          imageUrl={m.imageUrl || "/file.svg"}
                                          name={m.name}
                                          designation={m.designation || "MEMBER"}
                                          position={m.position || undefined}
                                          linkedinUrl={m.linkedinUrl || undefined}
                                          mail={m.mail || undefined}
                                          bgColor={m.bgColor || undefined}
                                          logo={m.logo || undefined}
                                          rank={m.rank}
                                          dept_rank={m.dept_rank}
                                          dept_logo={m.dept_logo}
                                          isAlumni={m.isAlumni}
                                          onDelete={handleDelete}
                                          onUpdate={handleUpdate}
                                        />
                                      </div>
                                    ))}
                                  </div>,
                                );
                                index += cardsInRow;
                                rowIdx++;
                              }
                              return rows;
                            })()}
                          </div>
                        ) : (
                          <div className="flex gap-6 justify-center">
                            {groupMembers.map((m) => (
                              <div key={m.id} className="flex-shrink-0">
                                <MemberCard
                                  id={m.id}
                                  imageUrl={m.imageUrl || "/file.svg"}
                                  name={m.name}
                                  designation={m.designation || "MEMBER"}
                                  position={m.position || undefined}
                                  linkedinUrl={m.linkedinUrl || undefined}
                                  mail={m.mail || undefined}
                                  bgColor={m.bgColor || undefined}
                                  logo={m.logo || undefined}
                                  rank={m.rank}
                                  dept_rank={m.dept_rank}
                                  dept_logo={m.dept_logo}
                                  isAlumni={m.isAlumni}
                                  onDelete={handleDelete}
                                  onUpdate={handleUpdate}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  ))
                })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="relative w-[90vw] max-w-3xl max-h-[90vh] bg-card rounded-lg shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAddOpen(false)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <form onSubmit={handleCreate}>
              <div className="flex flex-col md:flex-row">
                {/* Left: Photo preview */}
                <div
                  style={{ backgroundColor: addForm.bgColor || "#e6fffa" }}
                  className="md:w-1/2 flex flex-col items-center justify-center p-6 gap-4"
                >
                  <img
                    src={
                      addForm.imageUrl ||
                      "https://res.cloudinary.com/duvr3z2z0/image/upload/v1764391657/Screenshot_2025-11-29_095727_wptmhb.png"
                    }
                    alt={addForm.name || "New member"}
                    className="w-full max-h-[350px] object-contain rounded-md"
                  />
                  <div className="w-full">
                    <label className="text-xs font-medium text-muted-foreground">
                      Photo
                    </label>
                    <input
                      ref={addFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddImageUpload(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addFileInputRef.current?.click()}
                      disabled={addUploading}
                      className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-md bg-card/80 hover:bg-card transition-colors disabled:opacity-50"
                    >
                      {addUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {addUploading ? "Uploading..." : "Upload Photo"}
                    </button>
                  </div>
                </div>

                {/* Right: Fields */}
                <div className="md:w-1/2 p-6 space-y-4">
                  <h2 className="text-xl font-bold text-foreground">
                    Add New Member
                  </h2>

                  <div className="space-y-3">
                    <AddField
                      label="Name *"
                      value={addForm.name}
                      onChange={(v) => handleAddChange("name", v)}
                      required
                    />
                    <AddField
                      label="Email"
                      value={addForm.mail}
                      onChange={(v) => handleAddChange("mail", v)}
                      type="email"
                    />
                    <AddField
                      label="LinkedIn URL"
                      value={addForm.linkedinUrl}
                      onChange={(v) => handleAddChange("linkedinUrl", v)}
                      type="url"
                    />
                    <AddField
                      label="Logo URL"
                      value={addForm.logo}
                      onChange={(v) => handleAddChange("logo", v)}
                      type="url"
                    />
                    <AddField
                      label="Dept Logo URL"
                      value={addForm.dept_logo}
                      onChange={(v) => handleAddChange("dept_logo", v)}
                      type="url"
                    />
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Background Color
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={addForm.bgColor || "#e6fffa"}
                            onChange={(e) =>
                              handleAddChange("bgColor", e.target.value)
                            }
                            className="w-8 h-8 rounded border border-border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={addForm.bgColor}
                            onChange={(e) =>
                              handleAddChange("bgColor", e.target.value)
                            }
                            className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="#e6fffa"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Manage Roles Section */}
                    <div className="pt-2 pb-2 border-t border-b border-border mt-4 mb-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-foreground">Manage Roles</h3>
                        <button type="button" onClick={addRole} className="text-xs bg-muted hover:bg-stone-200 text-stone-700 px-2 py-1 rounded border border-border">
                          + Add Role
                        </button>
                      </div>
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-300">
                        {addForm.roles.map((role, idx) => (
                          <div key={role.id} className={`p-3 rounded-md border ${role.isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30 opacity-70'}`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Role {idx + 1}</span>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <span className="text-xs text-stone-600">{role.isActive ? 'Active' : 'Inactive'}</span>
                                <input 
                                  type="checkbox" 
                                  checked={role.isActive}
                                  onChange={(e) => handleAddRoleChange(idx, "isActive", e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-border" 
                                />
                              </label>
                            </div>
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-medium text-stone-500">Department / Position</label>
                                  <input
                                    type="text"
                                    value={role.position}
                                    onChange={(e) => handleAddRoleChange(idx, "position", e.target.value)}
                                    className="w-full mt-0.5 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    placeholder="e.g. Web Dev"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-stone-500">Designation</label>
                                  <input
                                    type="text"
                                    value={role.designation}
                                    onChange={(e) => handleAddRoleChange(idx, "designation", e.target.value)}
                                    className="w-full mt-0.5 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    placeholder="e.g. Lead"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-medium text-stone-500">Individual Rank</label>
                                  <input
                                    type="number"
                                    value={role.rank}
                                    onChange={(e) => handleAddRoleChange(idx, "rank", parseInt(e.target.value) || 0)}
                                    className="w-full mt-0.5 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-stone-500">Dept Rank</label>
                                  <input
                                    type="number"
                                    value={role.dept_rank}
                                    onChange={(e) => handleAddRoleChange(idx, "dept_rank", parseInt(e.target.value) || 0)}
                                    className="w-full mt-0.5 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="isAlumni-add"
                        checked={addForm.isAlumni}
                        onChange={(e) => handleAddChange("isAlumni", e.target.checked)}
                        className="w-4 h-4 rounded border-border"
                      />
                      <label htmlFor="isAlumni-add" className="text-sm font-medium text-foreground">
                        Is Alumni?
                      </label>
                    </div>
                  </div>

                  {/* Create button */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
                    >
                      {creating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {creating ? "Creating..." : "Create Member"}
                    </button>
                    {createError && (
                      <span className="text-red-600 text-sm">
                        {createError}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AddField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full mt-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder={placeholder}
      />
    </div>
  );
}
