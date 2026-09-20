"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateAdminPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [teamMemberId, setTeamMemberId] = useState("none");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, membersRes] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch("/api/admin/members")
      ]);
      const rolesData = await rolesRes.json();
      const membersData = await membersRes.json();
      
      if (Array.isArray(rolesData)) setRoles(rolesData);
      if (Array.isArray(membersData)) setTeamMembers(membersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamMemberChange = (id: string) => {
    setTeamMemberId(id);
    if (id !== "none") {
      const member = teamMembers.find(m => m.id === id);
      if (member) {
        if (member.name) setName(member.name);
        if (member.mail) setEmail(member.mail);
      }
    }
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/internal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          roleId,
          teamMemberId: teamMemberId === "none" ? null : teamMemberId,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create user");
      }

      router.push("/admin/admins");
    } catch (e: any) {
      setError(e.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Add Admin User" />
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <Link href="/admin/admins" className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Link>
          <h1 className="text-2xl font-bold mb-2">Add New Admin User</h1>
          <p className="text-gray-500">Create a new internal portal account and assign a role.</p>
        </div>

        <div className="bg-white border rounded-lg p-6 space-y-6">
          {error && <p className="text-red-500 text-sm p-3 bg-red-50 rounded-md">{error}</p>}
          
          <div className="space-y-4">
            <div className="space-y-2 pt-2 border-t mt-4">
              <Label>Link to Team Member Profile (Optional)</Label>
              <Select value={teamMemberId} onValueChange={handleTeamMemberChange} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading team members..." : "Select a team member"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Independent Account)</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Selecting a member will autofill the name and email, and show their details on their profile.</p>
            </div>
            
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
            </div>
            
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gdgvitb.in" />
            </div>
            
            <div className="space-y-2">
              <Label>Initial Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <p className="text-xs text-gray-400">Must be at least 6 characters long.</p>
            </div>
            
            <div className="space-y-2 pt-2">
              <Label>Assign Role</Label>
              <Select value={roleId} onValueChange={setRoleId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading roles..." : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({role.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">The role determines which modules this user can access.</p>
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <Button onClick={handleCreate} disabled={isSubmitting || !name || !email || !password || !roleId}>
              {isSubmitting ? "Creating..." : "Create User"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/admin/admins")}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
