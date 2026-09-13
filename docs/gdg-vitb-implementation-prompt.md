# gdg-vitb — Recruitment Module Implementation Prompt (Next.js site repo)

Paste this prompt into your build context. It fully specifies the student-facing
recruitment module for the **gdg-vitb** Next.js app, including two server-side
Route Handlers (file upload → Google Drive, and the confirmation-email trigger).
The **gdg_admin** repo is the admin console only; this app owns the student
journey and self-hosts the two "portal" jobs server-side.

**Hard rules:**
1. The browser NEVER calls Apps Script URLs. Uploads and emails always go
   through this app's Route Handlers; the script URLs are read from Firestore
   at runtime by the server, never embedded in the bundle.
2. This app only ever WRITES `recruitment_applications` (+ its
   `status_history` seed). It never writes `recruitment_roles`,
   `recruitment_settings`, or `recruitment_field_templates`.
3. The confirmation email fires ONLY after the application document is
   successfully committed.

---

## 1. Stack & dependencies

- Next.js App Router, `"use client"` for live pages.
- `npm i firebase firebase-admin`
- Same Firebase project as the admin portal (roles/settings/applications live there).
- UI: reuse the site's existing design system (Card/Input/Select/Checkbox/
  Button/toast or the site's equivalents). Reference UI contract can be copied
  from `docs/recruitment-client-contract.md` in gdg_admin.

## 2. Environment variables

`.env.local` (+ production):
```env
# Firebase WEB app config (public, same project as portal)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK credentials (server-side Route Handlers only)
FIREBASE_SERVICE_ACCOUNT_JSON={ "type": "service_account", ... }   # or path via GOOGLE_APPLICATION_CREDENTIALS
FIREBASE_STORAGE_BUCKET=                                          # optional
```

## 3. Firebase initialization

**Client (web):** `lib/firebase/client.ts`
```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

**Server (Route Handlers):** `lib/firebase/admin.ts`
```ts
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function init() {
  const apps = getApps();
  if (apps.length) return apps[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "null");
  return initializeApp({
    credential: cert(serviceAccount ?? {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    }),
  });
}
const app = init();
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
```

## 4. Firestore data model quick reference

- `recruitment_settings/global` → public read. Keys: `isRecruitmentActive`,
  `globalMessage`, `allowedEmailDomain`, `maxResumeSizeMB`, `maxTaskFileSizeMB`,
  `allowedResumeTypes`, `allowedTaskTypes`, `emailScriptUrl`, `driveUploadScriptUrl`,
  `notificationEmails`, `notifyOnApplication`.
- `recruitment_roles/<id>` → read; `{ title, description, icon, color, status,
  maxApplications|null, applicationStart?, applicationEnd?, sections[],
  fields[] (with order), createdBy, createdAt, updatedAt }`.
  Field type set: `text|email|tel|url|number|select|file|checkbox`.
  File fields carry `driveFolderId` (server-resolved on upload).
- `recruitment_applications/<id>` → create by signed-in users (rules enforce
  `userEmail == auth.email`, `dedupeKey == roleId + "_" + auth.email` verbatim,
  `status == "submitted"`); read own or admin.
  Values: `applicant{fullName,email,phone,branch,yearOfStudy}`, `files{resume?,
  taskSubmission?}`, `answers{fieldName: value|fileMeta}`, `dedupeKey`,
  `agreeToTerms`, `confirmInfo`, timestamps.

## 5. Pages & routes

### `/recruitment` (list)
- Real-time `onSnapshot` on `query(collection(db,"recruitment_roles"),
  where("status","in",["open","closing-soon"]))`.
- Card per role: icon, title, description, deadline, "Closing soon" badge.
- Empty state when none open. If `settings.isRecruitmentActive == false`, show
  hero with `globalMessage` and disable the journey.

### `/recruitment/[roleId]` (detail + form)
- `onSnapshot` role doc + settings doc (react live to status/deadline/max
  changes). Gate order: inactive → `globalMessage`; role closed → "Applications
  for this role are closed."; before start → "Applications open on <date>";
  after end → "The application deadline has passed."; reached `maxApplications`
  → "This role has reached its maximum number of applications."
- Render **exactly `role.sections[]` + `role.fields[]`** grouped by section
  (order by `field.order`). Identity fields (`fullName`, `email`, `phone`,
  `branch`, `yearOfStudy`) come from the schema when defined (case-insensitive
  name match); render a minimal Full name + Email block ONLY if the schema
  omits them. No hardcoded "details" or "links" sections.
- Field widgets + inline validation per type (see §6).
- File fields: pre-validate size/type, upload via this app's
  `/api/recruitment/upload`, show chip + remove, block submit until required
  uploads are done.
- Submit: Firestore `add` (client SDK, per rules) → on success seed
  `status_history` → fire-and-forget `POST /api/recruitment/notify` → success
  screen with reference id + "A confirmation email has been sent to <email>."
- Distinct error states: "You've already applied for this role", domain
  rejection, closed/deadline/max (read-only), network (retry, never wipe form).

### `/api/recruitment/upload` — Route Handler (server, node runtime)
Multipart `file` + `roleId` + `fieldName`. Server-side only:
1. Read role doc via Admin SDK → find `fieldName` → must be `type:"file"` and
   have `driveFolderId` → else 400 "No Drive folder configured for field X".
2. Read settings → `driveUploadScriptUrl` → else 500 "not configured".
3. Enforce 50 MB hard cap (413).
4. `Buffer.from(await file.arrayBuffer()).toString("base64")` → POST to the
   script: `{ fileName, mimeType, base64, folderId }` with
   `AbortSignal.timeout(45_000)`. Apps Script always returns HTTP 200, so read
   the JSON body.
5. If body has `error` → throw it. Require `fileUrl` + `fileId` → else error.
6. Respond `{ success:true, url:body.fileUrl, driveFileId:body.fileId,
   originalName, mimeType, sizeBytes }`.
Set `export const dynamic = "force-dynamic"`.

### `/api/recruitment/notify` — Route Handler (server, node runtime)
Body: `{ roleId, applicationId }` + `Authorization: Bearer <student ID token>`.
1. Verify the token via `adminAuth.verifyIdToken` → require `uid` + `email`.
2. Read the application doc; require exists, `status == "submitted"`,
   `userEmail == token.email`, `roleId` matches (prevents spraying anyone's app).
3. Read settings → `emailScriptUrl`; if absent → return `{ ok:true, skipped:true }`.
4. POST to the script:
   `{ to: app.userEmail, fullName: app.applicant.fullName, roleTitle: <role.title>,
      applicationId, subject: "Application received — <title>",
      submittedAtIso: new Date().toISOString(),
      ccEmails?: settings.notificationEmails }` (include `ccEmails` only when
   `settings.notifyOnApplication` and the list is non-empty).
5. Body has `error` → 502 with that message. Else `{ ok:true }`.
Never throws on the client path; the success screen renders regardless.

## 6. Form behavior spec (per field type)

| type | widget / validation |
|---|---|
| text | TextField; min/max length; `pattern` + `patternMessage` |
| email | email input + regex; also `allowedEmailDomain` check on identity email |
| tel | phone input |
| url | URL input + `new URL()` parse |
| number | numeric input; `Number(v)` on submit |
| select | dropdown of `options[].{label,value}`; store `value` |
| checkbox | checkbox tile `checkboxLabel ?? label`; store bool |
| file | picker + upload chip (see §5 upload) |

Show required asterisks (`*`), `helpText`, inline errors that clear on edit,
and scroll-to-first-error on submit. `resume`/`taskSubmission` metas go in
`files`; other `file` fields' metas go in `answers[fieldName]`.

## 7. Auth gating

If the student is signed out on any `/recruitment/*` page, redirect to the
site's sign-in page with `?next=<current path>` and return them after login.
Use the site's existing Firebase auth flow.

## 8. Smooth-journey checklist (all required)

- [ ] Live settings + role snapshots (tab visibility, banner, mid-form closure).
- [ ] Loading skeletons (list + role pages), empty states (no open roles).
- [ ] File pre-validation before any upload; per-field progress/spinner;
      retry on network failure; remove/reselect chip.
- [ ] Submit button disabled while in flight; no double-submit.
- [ ] Successful submit keeps state; failure keeps all entered + uploaded data.
- [ ] Distinct duplicate/domain/closed/max fan-outs; friendly copy.
- [ ] Keyboard: return→next, correct input types, autocorrect off for email/tel.
- [ ] a11y: labels, error semantics, ≥44dp targets, contrast.
- [ ] Deep links `/recruitment/<id>` from anywhere; correct gate when ineligible.
- [ ] Low connectivity: timeouts with friendly retry, cached last settings.

## 9. Deployment checklist

- [ ] Deploy Firestore rules once from gdg_admin (`firebase deploy --only
      firestore:rules`) — application create rule present.
- [ ] Set env vars (client web config + Admin service account) in the host.
- [ ] Create one burnable test role with a `file` field in the admin portal
      (folder link set), then apply for it here end-to-end.
- [ ] Verify: file appears in the Drive folder, email arrives, application
      shows in the portal Applications tab (and CSV export).
- [ ] Confirm the Notify route returns `{ok:true}` and Settings test buttons in
      the portal still green (scripts untouched — same deployment URLs, now
      invoked from this app's server).

## 10. Notes / gotchas

- Apps Script web apps return HTTP 200 even on failure — ALWAYS inspect the
  JSON body (`{ok:true}` vs `{error}`) as in §5.
- `dedupeKey` must be built from the EXACT token email (case-sensitive server
  rule); do not lowercase the key.
- Route Handlers default body limits apply; CSS first validate client-side that
  files are ≤ allowed sizes to avoid wasted uploads.
- The admin portal keeps its OWN upload endpoint for the admin "Open" preview
  and Settings tests; that URL is internal to gdg_admin and not needed here.