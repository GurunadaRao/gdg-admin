"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { RecruitmentRole, RecruitmentSettings } from "./types";

export function useSettings() {
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "recruitment_settings", "global"),
      (snap) => {
        setSettings(
          snap.exists() ? ({ id: snap.id, ...snap.data() } as RecruitmentSettings) : null,
        );
        setReady(true);
      },
    );
    return unsub;
  }, []);

  return { settings, ready };
}

export function useRole(roleId: string) {
  const [role, setRole] = useState<RecruitmentRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleId) return;
    const unsub = onSnapshot(
      doc(db, "recruitment_roles", roleId),
      (snap) => {
        setRole(
          snap.exists() ? ({ id: snap.id, ...snap.data() } as RecruitmentRole) : null,
        );
        setLoading(false);
      },
    );
    return unsub;
  }, [roleId]);

  return { role, loading };
}

export function useOpenRoles() {
  const [roles, setRoles] = useState<RecruitmentRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "recruitment_roles"),
      where("status", "in", ["open", "closing-soon"]),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecruitmentRole)));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { roles, loading };
}
