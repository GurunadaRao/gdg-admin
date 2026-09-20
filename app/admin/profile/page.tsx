"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [teamMember, setTeamMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        
        if (data.user.teamMemberId) {
          const membersRes = await fetch("/api/admin/members");
          const membersData = await membersRes.json();
          if (Array.isArray(membersData)) {
            const member = membersData.find(m => m.id === data.user.teamMemberId);
            if (member) setTeamMember(member);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    if (newPassword !== confirmPassword) {
      setMessage({ text: "Passwords do not match", type: "error" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ text: "Password must be at least 6 characters", type: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to reset password");
      }

      setMessage({ text: "Password updated successfully!", type: "success" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setMessage({ text: error.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Profile" />
        <div className="p-6">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Profile" />
        <div className="p-6">Failed to load user profile.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="My Profile" />
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Profile</h1>
          <p className="text-gray-500">View your account details and update your credentials.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile Details */}
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            
            <div className="space-y-4">
              <div>
                <Label className="text-gray-500 text-xs uppercase tracking-wider">Full Name</Label>
                <div className="font-medium text-lg mt-1">{user.name || "N/A"}</div>
              </div>
              
              <div>
                <Label className="text-gray-500 text-xs uppercase tracking-wider">Email Address</Label>
                <div className="font-medium mt-1">{user.email}</div>
              </div>

              <div>
                <Label className="text-gray-500 text-xs uppercase tracking-wider">Assigned Role</Label>
                <div className="mt-1">
                  <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-mono font-medium">
                    {user.roleId}
                  </span>
                </div>
              </div>
              
              <div>
                <Label className="text-gray-500 text-xs uppercase tracking-wider block mb-2">Module Access</Label>
                <div className="flex flex-wrap gap-2">
                  {user.modules && user.modules.length > 0 ? (
                    user.modules.map((m: string) => (
                      <span key={m} className="bg-gray-100 border text-gray-700 px-2 py-1 rounded text-sm">
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 italic">No modules assigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reset Password */}
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Security</h2>
            <p className="text-sm text-gray-500 mb-6">Update your password to keep your account secure.</p>
            
            <form onSubmit={handleResetPassword} className="space-y-4">
              {message.text && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input 
                  id="newPassword"
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input 
                  id="confirmPassword"
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || !newPassword || !confirmPassword}>
                {isSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </div>
          
          {/* Team Member Profile (if linked) */}
          {teamMember && (
            <div className="bg-white border rounded-xl p-6 shadow-sm md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Public Team Profile</h2>
              <div className="flex items-start gap-6">
                {teamMember.imageUrl && (
                  <img src={teamMember.imageUrl} alt={teamMember.name} className="w-24 h-24 rounded-full object-cover border" />
                )}
                <div className="space-y-3 flex-1">
                  <div>
                    <Label className="text-gray-500 text-xs uppercase tracking-wider">Display Name</Label>
                    <div className="font-medium mt-1">{teamMember.name}</div>
                  </div>
                  {teamMember.roles && teamMember.roles.length > 0 && (
                    <div>
                      <Label className="text-gray-500 text-xs uppercase tracking-wider">Roles</Label>
                      <div className="mt-1 flex flex-col gap-1">
                        {teamMember.roles.map((r: any) => (
                          <span key={r.id} className="text-sm">
                            {r.designation} - {r.position} {r.isActive ? "(Active)" : "(Past)"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {teamMember.linkedinUrl && (
                    <div>
                      <Label className="text-gray-500 text-xs uppercase tracking-wider">LinkedIn</Label>
                      <div className="mt-1">
                        <a href={teamMember.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                          {teamMember.linkedinUrl}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
