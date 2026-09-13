import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  APPLICATION_STATUSES,
  normaliseApplication,
  normaliseSettings,
} from "@/lib/recruitment";
import { notifyApplicationReceived } from "@/lib/recruitment-webhooks";
import { publicCorsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

const STATUS_SET = new Set<string>(APPLICATION_STATUSES);

/**
 * GET /api/recruitment/applications — List applications.
 * Optional filters: ?roleId=, ?status=, ?search= (name/email).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");
    const status = searchParams.get("status");
    const search = (searchParams.get("search") ?? "").trim().toLowerCase();

    const snapshot = await db
      .collection(COLLECTIONS.applications)
      .orderBy("submittedAt", "desc")
      .limit(200)
      .get();

    const applications = snapshot.docs
      .map((doc) => normaliseApplication({ id: doc.id, ...doc.data() }))
      .filter((app) => {
        if (roleId && app.roleId !== roleId) return false;
        if (status && STATUS_SET.has(status) && app.status !== status) return false;
        if (search) {
          const name = (app.applicant.fullName ?? "").toLowerCase();
          const email = (app.userEmail ?? "").toLowerCase();
          if (!name.includes(search) && !email.includes(search)) return false;
        }
        return true;
      });

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Failed to fetch recruitment applications:", error);
    return NextResponse.json(
      { error: "Failed to fetch recruitment applications" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/recruitment/applications — Submit a new application.
 * Validates role is open, email domain is allowed, and no duplicate exists.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const roleId = body.roleId;
    const applicant = body.applicant ?? {};
    const email = String(applicant.email ?? "").trim().toLowerCase();

    if (!roleId || !applicant.fullName || !email) {
      return NextResponse.json(
        { error: "roleId, applicant.fullName and applicant.email are required" },
        { status: 400 },
      );
    }

    if (!applicant.agreeToTerms || !applicant.confirmInfo) {
      return NextResponse.json(
        { error: "You must agree to the terms and confirm your information" },
        { status: 400 },
      );
    }

    const roleDoc = await db.collection(COLLECTIONS.roles).doc(roleId).get();
    if (!roleDoc.exists) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    const role = roleDoc.data();
    const roleStatus = role?.status;

    if (roleStatus !== "open" && roleStatus !== "closing-soon") {
      return NextResponse.json(
        { error: "Applications are closed for this role" },
        { status: 403 },
      );
    }

    const now = Date.now();
    if (role?.applicationEnd) {
      const endVal = role.applicationEnd as unknown;
      let end: number;
      if (
        typeof endVal === "object" &&
        endVal !== null &&
        typeof (endVal as { toDate?: () => Date }).toDate === "function"
      ) {
        end = (endVal as { toDate: () => Date }).toDate().getTime();
      } else {
        end = new Date(String(endVal)).getTime();
      }
      if (!isNaN(end) && now > end) {
        return NextResponse.json(
          { error: "The application deadline has passed" },
          { status: 403 },
        );
      }
    }

    if (typeof role?.maxApplications === "number" && role.maxApplications > 0) {
      const countSnap = await db
        .collection(COLLECTIONS.applications)
        .where("roleId", "==", roleId)
        .count()
        .get();
      if (countSnap.data().count >= role.maxApplications) {
        return NextResponse.json(
          { error: "This role has reached its maximum number of applications" },
          { status: 403 },
        );
      }
    }

    const settingsDoc = await db
      .collection(COLLECTIONS.settings)
      .doc("global")
      .get();
    const settings = normaliseSettings(settingsDoc.exists ? settingsDoc.data() : undefined);

    if (settings.allowedEmailDomain && !email.endsWith(settings.allowedEmailDomain)) {
      return NextResponse.json(
        {
          error: `Only ${settings.allowedEmailDomain} email addresses are allowed`,
        },
        { status: 403 },
      );
    }

    if (settings.isRecruitmentActive === false) {
      return NextResponse.json(
        { error: "Recruitment is currently closed" },
        { status: 403 },
      );
    }

    const dedupeKey = `${roleId}_${email}`;
    const dupSnap = await db
      .collection(COLLECTIONS.applications)
      .where("dedupeKey", "==", dedupeKey)
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return NextResponse.json(
        { error: "You have already applied for this role" },
        { status: 409 },
      );
    }

    const data = {
      roleId,
      userId: body.userId ?? null,
      userEmail: email,
      applicant: {
        fullName: applicant.fullName,
        email,
        phone: applicant.phone ?? "",
        branch: applicant.branch ?? "",
        yearOfStudy: applicant.yearOfStudy ?? "",
      },
      socialLinks: body.socialLinks ?? {},
      files: body.files ?? {},
      answers:
        body.answers && typeof body.answers === "object" ? body.answers : {},
      status: "submitted",
      currentReviewer: null,
      shortlistedAt: null,
      reviewedAt: null,
      acceptedAt: null,
      rejectedAt: null,
      rejectedReason: null,
      dedupeKey,
      agreeToTerms: applicant.agreeToTerms ?? false,
      confirmInfo: applicant.confirmInfo ?? false,
      isRead: false,
      isStarred: false,
      notes: "",
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTIONS.applications).add(data);
    await docRef.collection("status_history").add({
      fromStatus: "none",
      toStatus: "submitted",
      changedBy: "system",
      reason: "Application submitted",
      createdAt: FieldValue.serverTimestamp(),
    });

    const created = await docRef.get();

    // Confirm receipt to the applicant via the configured Apps Script email
    // webhook. Fire-and-forget so a slow/failed email never blocks the submit.
    notifyApplicationReceived(settings, {
      to: email,
      fullName: applicant.fullName,
      roleTitle: role?.title ?? "",
      applicationId: docRef.id,
      submittedAtIso: new Date().toISOString(),
    }).catch((err) => {
      console.error("Failed to send application confirmation email:", err);
    });

    const origin = request.headers.get("origin");
    return NextResponse.json(
      normaliseApplication({ id: docRef.id, ...created.data() }),
      { status: 201, headers: publicCorsHeaders(origin) },
    );
  } catch (error) {
    console.error("Failed to submit recruitment application:", error);
    return NextResponse.json(
      { error: "Failed to submit recruitment application" },
      { status: 500 },
    );
  }
}