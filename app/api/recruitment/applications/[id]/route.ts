import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  APPLICATION_STATUSES,
  LEGAL_TRANSITIONS,
  tsToISO,
} from "@/lib/recruitment";
import type { ApplicationStatus } from "@/lib/types/recruitment";

export const dynamic = "force-dynamic";

const STATUS_SET = new Set<string>(APPLICATION_STATUSES);

/**
 * GET /api/recruitment/applications/[id] — Application + reviews + status history.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const docRef = db.collection(COLLECTIONS.applications).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const reviewsSnap = await docRef
      .collection("reviews")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const historySnap = await docRef
      .collection("status_history")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    return NextResponse.json({
      ...doc.data(),
      id: doc.id,
      reviews: reviewsSnap.docs.map((r) => ({
        id: r.id,
        ...r.data(),
        createdAt: tsToISO(r.data().createdAt),
        updatedAt: tsToISO(r.data().updatedAt),
      })),
      statusHistory: historySnap.docs.map((h) => ({
        id: h.id,
        ...h.data(),
        createdAt: tsToISO(h.data().createdAt),
      })),
      submittedAt: tsToISO(doc.data()?.submittedAt),
      updatedAt: tsToISO(doc.data()?.updatedAt),
      shortlistedAt: tsToISO(doc.data()?.shortlistedAt),
      reviewedAt: tsToISO(doc.data()?.reviewedAt),
      acceptedAt: tsToISO(doc.data()?.acceptedAt),
      rejectedAt: tsToISO(doc.data()?.rejectedAt),
    });
  } catch (error) {
    console.error("Failed to fetch recruitment application:", error);
    return NextResponse.json(
      { error: "Failed to fetch recruitment application" },
      { status: 500 },
    );
  }
}

/** Timestamps to set based on a status transition. */
function statusTimestamps(
  status: ApplicationStatus,
  reason: string | null,
): Record<string, unknown> {
  const now = FieldValue.serverTimestamp();
  return {
    shortlistedAt: status === "shortlisted" ? now : null,
    reviewedAt:
      status === "under_review" || status === "interviewed" ? now : null,
    acceptedAt: status === "accepted" ? now : null,
    rejectedAt: status === "rejected" ? now : null,
    rejectedReason: status === "rejected" ? reason : null,
  };
}

/**
 * PATCH /api/recruitment/applications/[id]
 * Body supports (all optional):
 *   { status, reason?, changedBy? }              → status transition + history
 *   { notes, isRead, isStarred, currentReviewer } → direct field updates
 *   { review: { id?, reviewerId, reviewerName, score, criteria, verdict, ... } } → upsert review
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const docRef = db.collection(COLLECTIONS.applications).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const current = doc.data() ?? {};
    const updates: Record<string, unknown> = {};
    const batch = db.batch();

    // ── Status transition ──
    if (body.status) {
      if (!STATUS_SET.has(body.status)) {
        return NextResponse.json(
          { error: "Invalid application status" },
          { status: 400 },
        );
      }
      const from = (current.status ?? "submitted") as ApplicationStatus;
      const to = body.status as ApplicationStatus;
      if (to !== from && !LEGAL_TRANSITIONS[from].includes(to)) {
        return NextResponse.json(
          {
            error: `Cannot move an application from "${from}" to "${to}"`,
          },
          { status: 400 },
        );
      }

      const reason = typeof body.reason === "string" ? body.reason : "";
      updates.status = to;
      Object.assign(updates, statusTimestamps(to, reason || null));

      const historyRef = docRef.collection("status_history").doc();
      batch.set(historyRef, {
        fromStatus: from,
        toStatus: to,
        changedBy: body.changedBy ?? "admin",
        reason,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // ── Direct field updates (whitelisted) ──
    const directFields = ["notes", "isRead", "isStarred", "currentReviewer"] as const;
    for (const field of directFields) {
      if (field in body) updates[field] = body[field];
    }

    // ── Review upsert ──
    if (body.review && typeof body.review === "object") {
      const review = body.review as Record<string, unknown>;
      const revRef =
        typeof review.id === "string" && review.id
          ? docRef.collection("reviews").doc(review.id)
          : docRef.collection("reviews").doc();

      const criteria = [
        "technical",
        "communication",
        "portfolio",
        "culturalFit",
      ];
      const criteriaData: Record<string, number | null> = {};
      for (const key of criteria) {
        const v = (review.criteria as Record<string, unknown> | undefined)?.[key];
        criteriaData[key] =
          typeof v === "number" ? Math.min(10, Math.max(0, v)) : null;
      }

      batch.set(
        revRef,
        {
          reviewerId: typeof review.reviewerId === "string" ? review.reviewerId : "",
          reviewerName: typeof review.reviewerName === "string" ? review.reviewerName : "",
          score:
            typeof review.score === "number"
              ? Math.min(10, Math.max(0, review.score))
              : null,
          criteria: criteriaData,
          verdict: review.verdict ?? "pending",
          strengths: review.strengths ?? "",
          weaknesses: review.weaknesses ?? "",
          comments: review.comments ?? "",
          updatedAt: FieldValue.serverTimestamp(),
          ...(review.id
            ? {}
            : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );
    }

    // ── Commit ──
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = FieldValue.serverTimestamp();
      batch.update(docRef, updates);
    }

    if (body.status || Object.keys(updates).length > 0 || body.review) {
      await batch.commit();
    } else {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await docRef.get();
    return NextResponse.json({
      ...updated.data(),
      id: updated.id,
      updatedAt: tsToISO(updated.data()?.updatedAt),
      submittedAt: tsToISO(updated.data()?.submittedAt),
    });
  } catch (error) {
    console.error("Failed to update recruitment application:", error);
    return NextResponse.json(
      { error: "Failed to update recruitment application" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/recruitment/applications/[id] — Delete app + reviews + history.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const docRef = db.collection(COLLECTIONS.applications).doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const batch = db.batch();
    for (const sub of ["reviews", "status_history"]) {
      const subSnap = await docRef.collection(sub).get();
      subSnap.docs.forEach((subDoc) => batch.delete(subDoc.ref));
    }
    batch.delete(docRef);
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recruitment application:", error);
    return NextResponse.json(
      { error: "Failed to delete recruitment application" },
      { status: 500 },
    );
  }
}