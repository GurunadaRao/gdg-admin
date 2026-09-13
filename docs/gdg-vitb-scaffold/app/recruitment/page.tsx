"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOpenRoles, useSettings } from "@/lib/recruitment/hooks";

export default function RecruitmentLanding() {
  const router = useRouter();
  const { settings, ready: settingsReady } = useSettings();
  const { roles, loading: rolesLoading } = useOpenRoles();
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.replace(`/auth/login?next=${encodeURIComponent("/recruitment")}`);
    });
    return unsub;
  }, [router]);

  const loading = !user || !settingsReady || rolesLoading;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (settings && settings.isRecruitmentActive === false) {
    return (
      <div className="max-w-3xl mx-auto min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Recruitment</h1>
        <p className="text-muted-foreground">
          {settings.globalMessage?.trim() ||
            "Recruitment is currently closed. Please check back later."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Open Positions</h1>
        {settings?.globalMessage?.trim() && (
          <span className="text-sm text-muted-foreground">
            {settings.globalMessage.trim()}
          </span>
        )}
      </div>

      {roles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No open roles right now</p>
          <p className="text-sm">Check back later.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {roles.map((role) => (
            <Link key={role.id} href={`/recruitment/${role.id}`}>
              <Card className="h-full hover:border-primary transition-colors">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl leading-none">{role.icon}</span>
                    <h2 className="text-lg font-semibold">{role.title}</h2>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground line-clamp-3 mb-4">
                    {role.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {role.applicationEnd && (
                      <span>
                        Deadline:{" "}
                        <strong>
                          {new Date(role.applicationEnd).toLocaleDateString()}
                        </strong>
                      </span>
                    )}
                    {role.status === "closing-soon" && (
                      <span className="font-medium text-amber-600">Closing soon</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}