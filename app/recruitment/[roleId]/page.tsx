"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecruitmentRole, RecruitmentSettings } from "@/lib/types/recruitment";
import PublicRecruitmentForm from "@/components/recruitment/PublicRecruitmentForm";

export default function RecruitPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = use(params);
  const [role, setRole] = useState<RecruitmentRole | null>(null);
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [roleRes, settingsRes] = await Promise.all([
          fetch(`/api/recruitment/roles/${roleId}`),
          fetch("/api/recruitment/settings"),
        ]);

        if (!roleRes.ok) {
          const data = await roleRes.json().catch(() => null);
          throw new Error(data?.error ?? "Role not found");
        }

        const [roleData, settingsData] = await Promise.all([
          roleRes.json(),
          settingsRes.ok ? settingsRes.json() : null,
        ]);

        if (cancelled) return;
        setRole(roleData);
        setSettings(settingsData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load role");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [roleId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-32 ml-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-destructive mb-2">
              {error || "Recruitment not found"}
            </h2>
            <p className="text-muted-foreground">
              Please check the link and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Gating ──
  const active = settings?.isRecruitmentActive !== false;
  const roleOpen = role.status === "open" || role.status === "closing-soon";

  const startMs = role.applicationStart
    ? new Date(role.applicationStart).getTime()
    : null;
  const endMs = role.applicationEnd
    ? new Date(role.applicationEnd).getTime()
    : null;
  const now = Date.now();

  let blockedReason: string | null = null;
  if (!active) {
    blockedReason =
      settings?.globalMessage?.trim() ||
      "Recruitment is currently closed. Please check back later.";
  } else if (!roleOpen) {
    blockedReason = "Applications for this role are closed.";
  } else if (startMs && !isNaN(startMs) && now < startMs) {
    blockedReason = `Applications open on ${new Date(startMs).toLocaleDateString()}.`;
  } else if (endMs && !isNaN(endMs) && now > endMs) {
    blockedReason = "The application deadline has passed.";
  } else if (
    typeof role.maxApplications === "number" &&
    role.maxApplications > 0 &&
    typeof role.applicationCount === "number" &&
    role.applicationCount >= role.maxApplications
  ) {
    blockedReason = "This role has reached its maximum number of applications.";
  }

  if (blockedReason) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <main
          className="w-full max-w-md rounded-lg border-l-4 p-6 shadow-sm"
          style={{ borderLeftColor: role.color }}
        >
          <div className="text-3xl mb-2">{role.icon}</div>
          <h2 className="text-xl font-semibold mb-1">{role.title}</h2>
          <p className="text-muted-foreground">{blockedReason}</p>
        </main>
      </div>
    );
  }

  return (
    <PublicRecruitmentForm role={role} settings={settings ?? null} />
  );
}