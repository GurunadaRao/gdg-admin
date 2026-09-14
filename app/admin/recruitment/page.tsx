"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Briefcase, Inbox, Settings2, LibraryBig, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { RolesPanel } from "@/components/admin/recruitment/RolesPanel";
import { ApplicationsPanel } from "@/components/admin/recruitment/ApplicationsPanel";
import { SettingsPanel } from "@/components/admin/recruitment/SettingsPanel";
import { SavedFieldsPanel } from "@/components/admin/recruitment/SavedFieldsPanel";
import { SavedFormsPanel } from "@/components/admin/recruitment/SavedFormsPanel";

type TabId = "roles" | "applications" | "savedFields" | "savedForms" | "settings";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "roles", label: "Roles", icon: Briefcase },
  { id: "applications", label: "Applications", icon: Inbox },
  { id: "savedFields", label: "Saved Fields", icon: LibraryBig },
  { id: "savedForms", label: "Saved Forms", icon: LayoutTemplate },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export default function RecruitmentPage() {
  const [tab, setTab] = useState<TabId>("roles");

  return (
    <div className="flex flex-col">
      <PageHeader title="Recruitment" />

      <div className="border-b px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {tab === "roles" && <RolesPanel />}
        {tab === "applications" && <ApplicationsPanel />}
        {tab === "savedFields" && <SavedFieldsPanel />}
        {tab === "savedForms" && <SavedFormsPanel />}
        {tab === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
}