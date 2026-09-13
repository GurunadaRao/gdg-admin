"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleForm } from "./RoleForm";
import type { RecruitmentRole } from "@/lib/types/recruitment";

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RecruitmentRole | null;
  onSaved: () => void;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSaved,
}: RoleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {role ? `Edit Role — ${role.title}` : "New Recruitment Role"}
          </DialogTitle>
          <DialogDescription>
            Define the role, its form sections, and the fields applicants must fill.
          </DialogDescription>
        </DialogHeader>
        <RoleForm
          role={role}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}