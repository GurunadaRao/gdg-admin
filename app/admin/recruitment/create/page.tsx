"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { RoleForm } from "@/components/admin/recruitment/RoleForm";

export default function CreateRecruitPage() {
  const router = useRouter();
  const back = () => router.push("/admin/recruitment");

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="New Recruitment Role" />
      <main className="flex-1 space-y-4 p-6">
        <Link
          href="/admin/recruitment"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to roles
        </Link>
        <Card className="max-w-3xl">
          <CardContent className="p-6">
            <RoleForm
              role={null}
              onCancel={back}
              onSaved={back}
              submitLabel="Create role"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}