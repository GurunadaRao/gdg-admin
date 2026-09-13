"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, ShieldCheck, Play } from "lucide-react";
import { toast } from "sonner";
import GoogleLoader from "@/components/GoogleLoader";
import type { RecruitmentSettings } from "@/lib/types/recruitment";

export function SettingsPanel() {
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recruitment/settings");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSettings(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const set = <K extends keyof RecruitmentSettings>(key: K, value: RecruitmentSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  const testScript = async (url: string | null, label: string) => {
    if (!url) {
      toast.error("Enter the URL first, then save and test");
      return;
    }
    setTesting(label);
    try {
      const res = await fetch("/api/recruitment/scripts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Script test failed");
      toast.success(`${label} is reachable${json?.result ? " and responded OK" : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} test failed`);
    } finally {
      setTesting(null);
    }
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/recruitment/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSettings(json);
      toast.success("Recruitment settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <GoogleLoader message="Loading settings…" />;

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Global Configuration
          </CardTitle>
          <CardDescription>
            Controls whether recruitment is live, who can apply, and file limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Recruitment active</p>
              <p className="text-sm text-muted-foreground">
                Master kill switch — blocks all new applications when off.
              </p>
            </div>
            <Switch
              checked={settings.isRecruitmentActive}
              onCheckedChange={(v) => set("isRecruitmentActive", v)}
            />
          </div>
          <Field label="Global banner message">
            <Input
              value={settings.globalMessage}
              onChange={(e) => set("globalMessage", e.target.value)}
              placeholder="e.g. Recruitment drive closes March 31 — apply now!"
            />
          </Field>
          <Field label="Allowed email domain">
            <Input
              value={settings.allowedEmailDomain}
              onChange={(e) => set("allowedEmailDomain", e.target.value)}
              placeholder="@vishnu.edu.in"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File Upload Limits</CardTitle>
          <CardDescription>
            Size limits and allowed extensions for resumes and task submissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max resume size (MB)">
              <Input
                type="number"
                min={1}
                value={settings.maxResumeSizeMB}
                onChange={(e) => set("maxResumeSizeMB", Number(e.target.value) || 1)}
              />
            </Field>
            <Field label="Max task file size (MB)">
              <Input
                type="number"
                min={1}
                value={settings.maxTaskFileSizeMB}
                onChange={(e) => set("maxTaskFileSizeMB", Number(e.target.value) || 1)}
              />
            </Field>
            <Field label="Allowed resume types (comma separated)">
              <Input
                value={settings.allowedResumeTypes.join(", ")}
                onChange={(e) =>
                  set("allowedResumeTypes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                }
                placeholder=".pdf, .doc, .docx"
              />
            </Field>
            <Field label="Allowed task types (comma separated)">
              <Input
                value={settings.allowedTaskTypes.join(", ")}
                onChange={(e) =>
                  set("allowedTaskTypes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                }
                placeholder=".doc, .docx"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Email the team when a new application arrives.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Notify on application</p>
              <p className="text-sm text-muted-foreground">Send an email on every new submission.</p>
            </div>
            <Switch
              checked={settings.notifyOnApplication}
              onCheckedChange={(v) => set("notifyOnApplication", v)}
            />
          </div>
          <Field label="Notification emails (comma separated)">
            <Input
              value={settings.notificationEmails.join(", ")}
              onChange={(e) =>
                set("notificationEmails", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
              placeholder="team@gdgvitb.in"
            />
          </Field>
          <Separator />
          <Field label="Email script URL (Apps Script web app)">
            <div className="flex gap-2">
              <Input
                value={settings.emailScriptUrl ?? ""}
                onChange={(e) => set("emailScriptUrl", e.target.value || null)}
                placeholder="https://script.google.com/macros/s/…/exec"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={testing !== null}
                onClick={() => testScript(settings.emailScriptUrl, "Email script")}
              >
                {testing === "Email script" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Test
              </Button>
            </div>
          </Field>
          <Field label="Drive upload script URL (Apps Script web app)">
            <div className="flex gap-2">
              <Input
                value={settings.driveUploadScriptUrl ?? ""}
                onChange={(e) => set("driveUploadScriptUrl", e.target.value || null)}
                placeholder="https://script.google.com/macros/s/…/exec"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={testing !== null}
                onClick={() => testScript(settings.driveUploadScriptUrl, "Drive script")}
              >
                {testing === "Drive script" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Test
              </Button>
            </div>
          </Field>
          <Separator />
          <p className="text-xs text-muted-foreground">
            The Drive script stores applicant files in the Drive folder of each
            file field. The email script sends each applicant a &quot;received&quot;
            confirmation with their name and role. Save before testing.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}