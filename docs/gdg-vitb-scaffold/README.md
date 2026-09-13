# gdg-vitb — Recruitment Module Scaffold

Paste-ready starting point for the student-facing (public) Next.js app. It
implements the full student journey against the **same Firestore backend** as the
`gdg_admin` portal:

1. List open roles → 2. Per-role application form rendered **exactly** from that
   role's `sections`/`fields` → 3. File upload proxied server-side through
   Apps Script into Drive → 4. Application written with the user's client SDK
   (enforced by security rules) → 5. Confirmation email fired server-side via
   the Apps Script mail webhook.

## Architecture rules (do not deviate)

- The **browser never calls Apps Script URLs** directly. Both webhooks are
  called server-side only (these Route Handlers).
- `driveUploadScriptUrl` and `emailScriptUrl` are read from Firestore at
  runtime — never hardcoded or bundled.
- Application writes happen client-side with the signed-in user's SDK so the
  existing Firestore rules hold (`userEmail == auth.email`, dedupeKey
  `roleId_email` verbatim, `status == "submitted"`). The notify route only
  verifies the token and re-reads the doc.
- Script URLs must be readable by the client (rules already grant read on
  `recruitment_settings/global`; the notify/upload routes read server-side via
  Admin SDK regardless).

## Files

```
.env.example                     # copy to .env.local
lib/firebase/client.ts           # Firebase web SDK init
lib/firebase/admin.ts            # Firebase Admin init (server-only)
lib/recruitment/types.ts         # RecruitmentRole/RoleField/Settings/file meta
lib/recruitment/hooks.ts         # useSettings / useRole / useOpenRoles (onSnapshot)
lib/recruitment/validation.ts    # fieldError, extensionOk, maxSizeMB
lib/recruitment/upload.ts        # uploadFile -> POST /api/recruitment/upload
lib/recruitment/submit.ts        # submitApplication (addDoc + status_history) + hasAppliedFor
app/recruitment/page.tsx         # open-roles landing + closed banner + auth gate
app/recruitment/[roleId]/page.tsx# gating (active/status/window/count) -> RoleForm
components/recruitment/RoleForm.tsx # exact-schema form, uploads, success screen
app/api/recruitment/upload/route.ts # server proxy to Drive Apps Script (Node runtime)
app/api/recruitment/notify/route.ts # server fire of email webhook (verifies token)
```

## Setup

1. `.env.local` (see `.env.example`): the admin app's service account + web API
   keys, plus the public site domain for your Firebase project.
2. Copy the two Apps Script web apps from `gdg_admin/scripts/apps-script/`
   (`drive-upload-proxy.gs`, `email-confirmation.gs`) into separate Apps Script
   projects, deploy as **Web Apps** ("Execute as: Me", "Who has access: Anyone"),
   and paste the `/exec` URLs into Admin → Recruitment → Settings
   (`driveUploadScriptUrl`, `emailScriptUrl`). Both must respond to `{"action":"ping"}`.
3. Firestore: ensure `recruitment_settings/global` is readable and
   `recruitment_roles` query-on-status is allowed by rules, and
   `recruitment_applications` allows globally-created apps per the portal's rule
   file. See `gdg_admin/firestore.rules`.
4. Each role must have a `driveFolderId` on file fields created in the portal
   (Admin → Recruitment → Roles). The upload route will 400 otherwise.

## UI adaptation

Components import shadcn/ui-style primitives (`@/components/ui/card`,
`button`, `input`, `label`, `checkbox`, `select`, `skeleton`) and `lucide-react`
icons. Map these to whatever UI kit gdg-vitb already uses — the logic is
isolated in `lib/recruitment/*`.

- Auth: pages redirect to `/auth/login?next=...`. Change to gdg-vitb's own login
  route. `submitApplication` reads `auth.currentUser`; the email used is the
  **exact** token email (never lowercased) to match the dedupeKey contract.
- Identity fields (`fullName`, `email`, …) render from the role schema when the
  schema defines them; a minimal Full name + Email fallback is added only when
  the schema omits them.

## Local Rules Recap

- Apps Script always returns HTTP 200 — errors travel in-band as `{error}`;
  both routes map those to 4xx/5xx for the client.
- Upload payload: `{fileName, mimeType, base64, folderId}` → `{fileUrl,fileId,fileName}`.
- Notify payload: `{to, fullName, roleTitle, applicationId, subject, submittedAtIso, ccEmails?}`.
- 50 MB hard cap enforced server-side in the upload route.