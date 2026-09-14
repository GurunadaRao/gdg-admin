"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { RoleForm } from "@/components/admin/recruitment/RoleForm";
import GoogleLoader from "@/components/GoogleLoader";
import type { RecruitmentRole } from "@/lib/types/recruitment";

export default function EditRecruitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const back = () => router.push("/admin/recruitment");

  const [role, setRole] = useState<RecruitmentRole | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recruitment/roles/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Role not found");
        if (!cancelled) setRole(json);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title={notFound ? "Role not found" : "Edit Recruitment Role"} />
      <main className="flex-1 space-y-4 p-6">
        {notFound ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <p className="font-medium">Could not load this role.</p>
            <p className="text-sm">It may have been deleted. Choose another role to edit.</p>
          </div>
        ) : !role ? (
          <GoogleLoader message="Loading role…" />
        ) : (
          <>
            <Link
              href="/admin/recruitment"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to roles
            </Link>
            <Card className="max-w-3xl">
              <CardContent className="p-6">
                <RoleForm
                  role={role}
                  onCancel={back}
                  onSaved={back}
                  submitLabel="Save changes"
                />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}