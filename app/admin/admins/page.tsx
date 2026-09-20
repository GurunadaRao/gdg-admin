"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete Dialog State
  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/admin/internal-users"),
        fetch("/api/admin/roles")
      ]);
      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      
      if (Array.isArray(usersData)) setUsers(usersData);
      if (Array.isArray(rolesData)) setRoles(rolesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser || deleteConfirmation !== deleteUser.name) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/internal-users/${deleteUser.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== deleteUser.id));
        setDeleteUser(null);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete user");
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
      <PageHeader title="Internal Admins" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Internal Admin Users</h1>
            <p className="text-gray-500">Manage portal access for GDG organizers.</p>
          </div>

          <Link href="/admin/admins/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const userRole = roles.find(r => r.id === user.roleId);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-mono">
                          {user.roleId}
                        </span>
                        {userRole && <span className="ml-2 text-sm text-gray-500">{userRole.name}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.roleId !== "L0" && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => {
                              setDeleteUser(user);
                              setDeleteConfirmation("");
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Admin User</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the account for <strong>{deleteUser?.name}</strong> ({deleteUser?.email}).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label>
                Please type <strong>{deleteUser?.name}</strong> to confirm.
              </Label>
              <Input 
                value={deleteConfirmation} 
                onChange={(e) => setDeleteConfirmation(e.target.value)} 
                placeholder={deleteUser?.name}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={isDeleting || deleteConfirmation !== deleteUser?.name}
              >
                {isDeleting ? "Deleting..." : "Delete User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
