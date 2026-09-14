"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/layout/PageHeader";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to users page to save Firestore reads
    router.replace("/admin/users");
  }, [router]);

  return (
    <div className="flex flex-col min-h-0">
      <PageHeader title="Dashboard" />
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
