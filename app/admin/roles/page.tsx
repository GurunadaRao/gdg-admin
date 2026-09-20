"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete Dialog State
  const [deleteRole, setDeleteRole] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (Array.isArray(data)) setRoles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole || deleteConfirmation !== deleteRole.name) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/roles/${deleteRole.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRoles(roles.filter(r => r.id !== deleteRole.id));
        setDeleteRole(null);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete role");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Roles & Permissions" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Roles & Permissions</h1>
            <p className="text-gray-500">Manage RBAC roles and their accessible modules.</p>
          </div>

          <Link href="/admin/roles/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </Link>
        </div>
        
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-mono font-medium">{role.id}</TableCell>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.level}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {role.modules?.map((m: string) => (
                          <span key={m} className="bg-gray-100 px-2 py-1 rounded text-xs">{m}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          setDeleteRole(role);
                          setDeleteConfirmation("");
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteRole} onOpenChange={(open) => !open && setDeleteRole(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Role</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the <strong>{deleteRole?.name}</strong> role.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label>
                Please type <strong>{deleteRole?.name}</strong> to confirm.
              </Label>
              <Input 
                value={deleteConfirmation} 
                onChange={(e) => setDeleteConfirmation(e.target.value)} 
                placeholder={deleteRole?.name}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteRole(null)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={isDeleting || deleteConfirmation !== deleteRole?.name}
              >
                {isDeleting ? "Deleting..." : "Delete Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
