"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const AVAILABLE_MODULES = [
  "dashboard",
  "events",
  "form-builder",
  "forms",
  "gallery",
  "gdg-team",
  "image-to-url",
  "managed-events",
  "members",
  "recruitment",
  "settings",
  "users"
];

export default function CreateRolePage() {
  const router = useRouter();
  
  // Form State
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleModule = (moduleName: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleName)
        ? prev.filter((m) => m !== moduleName)
        : [...prev, moduleName]
    );
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          level: parseInt(level) || 99,
          modules: selectedModules,
          canManageRoles,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create role");
      }

      router.push("/admin/roles");
    } catch (e: any) {
      setError(e.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Create Role" />
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <Link href="/admin/roles" className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Roles
          </Link>
          <h1 className="text-2xl font-bold mb-2">Create New Role</h1>
          <p className="text-gray-500">Define a new RBAC role and assign module access.</p>
        </div>

        <div className="bg-white border rounded-lg p-6 space-y-6">
          {error && <p className="text-red-500 text-sm p-3 bg-red-50 rounded-md">{error}</p>}
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role ID</Label>
                <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. L5 or content-manager" />
                <p className="text-xs text-gray-400">Unique identifier for the role.</p>
              </div>
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Content Manager" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Level (0 is highest)</Label>
                <Input type="number" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="5" />
                <p className="text-xs text-gray-400">Determines hierarchy in lists.</p>
              </div>
              
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox 
                  id="manageRoles" 
                  checked={canManageRoles} 
                  onCheckedChange={(c) => setCanManageRoles(c === true)} 
                />
                <Label htmlFor="manageRoles" className="font-medium cursor-pointer">
                  Can Manage Roles & Users?
                </Label>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-lg">Modules Access</Label>
            <p className="text-sm text-gray-500">Select which sections of the admin portal this role can access.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              {AVAILABLE_MODULES.map((module) => (
                <div key={module} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50">
                  <Checkbox 
                    id={`module-${module}`}
                    checked={selectedModules.includes(module)}
                    onCheckedChange={() => toggleModule(module)}
                  />
                  <Label htmlFor={`module-${module}`} className="text-sm font-medium cursor-pointer flex-1">
                    {module}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <Button onClick={handleCreate} disabled={isSubmitting || !id || !name}>
              {isSubmitting ? "Creating..." : "Create Role"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/admin/roles")}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
