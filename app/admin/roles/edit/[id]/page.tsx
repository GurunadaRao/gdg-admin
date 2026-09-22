"use client";

import React, { useState, useEffect, use } from "react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
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

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  // Form State
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch(`/api/admin/roles/${id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch role data");
        }
        const data = await res.json();
        setName(data.name || "");
        setLevel(data.level?.toString() || "99");
        setSelectedModules(data.modules || []);
        setCanManageRoles(data.canManageRoles || false);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRole();
  }, [id]);

  const toggleModule = (moduleName: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleName)
        ? prev.filter((m) => m !== moduleName)
        : [...prev, moduleName]
    );
  };

  const handleUpdate = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          level: parseInt(level) || 99,
          modules: selectedModules,
          canManageRoles,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update role");
      }

      router.push("/admin/roles");
    } catch (e: any) {
      setError(e.message);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Edit Role" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Edit Role" />
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <Link href="/admin/roles" className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Roles
          </Link>
          <h1 className="text-2xl font-bold mb-2">Edit Role: {id}</h1>
          <p className="text-gray-500">Update RBAC role properties and module access.</p>
        </div>

        <div className="bg-white border rounded-lg p-6 space-y-6">
          {error && <p className="text-red-500 text-sm p-3 bg-red-50 rounded-md">{error}</p>}
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role ID</Label>
                <Input value={id} disabled className="bg-gray-50" />
                <p className="text-xs text-gray-400">Role ID cannot be changed.</p>
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
                  disabled={id === "L0"} // Prevent removing manageRoles from L0
                />
                <Label htmlFor="manageRoles" className={`font-medium ${id === "L0" ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer'}`}>
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
            <Button onClick={handleUpdate} disabled={isSubmitting || !name}>
              {isSubmitting ? "Saving..." : "Save Changes"}
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
