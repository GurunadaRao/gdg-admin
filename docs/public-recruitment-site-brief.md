# Public Recruitment Site — Build Brief

The GDG VITB main website lives in a **separate repository** extended to host
recruitment. The `gdg_admin` repo already exposes everything the public site
needs; do **not** mirror admin logic into the site repo.

## Data access model

| What                          | Where it lives                                   | Auth model            |
| ----------------------------- | ------------------------------------------------ | --------------------- |
| Recruiting tab visibility     | `recruitment_settings/global` (Firestore)        | public read           |
| Role list + per-role page     | `recruitment_roles` (Firestore)                  | signed-in read only   |
| Application submission        | Firestore `recruitment_applications` create      | signed-in (rules enforce) |
| File upload                   | `POST {PORTAL}/api/recruitment/upload`           | public, CORS-enabled  |

The portal origin is the deployment URL of `gdg_admin`. Configure
`PUBLIC_SITE_ORIGIN` there (comma-separated) to mirror the CORS headers; when
unset the portal replies with `Access-Control-Allow-Origin: *`.
The site never writes to `recruitment_settings` or `recruitment_roles`.

## Pages

1. `/recruitment` — landing. Shows roles where `status ∈ {open, closing-soon}`
   (subscribe or snapshot; `orderBy('status')`). Respect the
   `applicationStart`/`applicationEnd` windows client-side and display
   `recruitment_settings.globalMessage`. Hide the nav entry entirely when
   `recruitment_settings.isRecruitmentActive == false` (real-time snapshot, no
   polling — same guidance as the app).
2. `/recruitment/[roleId]` — role page + form. Groups `role.fields` by
   `role.sections`. Renders the standard "Your details" block (fullName,
   email, phone, branch, yearOfStudy) + built-in reserved questions as on
   Flash Cards, plus one widget per field type.
3. Submission success + failure states (include "You'll get a confirmation
   email" — sent by the portal's email webhook when configured).

## Upload contract

Before submitting, for each `file` field:

1. `POST {PORTAL}/api/recruitment/upload` with `multipart/form-data`:
   `file`, `roleId`, `fieldName`.
2. On 200 you get `{ success, url, driveFileId, originalName, mimeType,
   sizeBytes }`. Store as `RecruitmentFileMeta`.

```ts
const fd = new FormData();
fd.append("file", fileBlob);
fd.append("roleId", roleId);
fd.append("fieldName", fieldName);
const res = await fetch(`${PORTAL}/api/recruitment/upload`, {
  method: "POST", body: fd,
});
// res.ok -> { success, url, driveFileId, originalName, mimeType, sizeBytes }
```

Client pre-validations (server enforces too): size ≤ `field.maxSizeMB` (fall
back to global `maxResumeSizeMB`/`maxTaskFileSizeMB`; hard cap 50 MB), and
extension against `field.allowedExtensions` / `settings.allowed*Types`, and
the `accept` string.

## Submission contract

`dedupeKey` MUST be built from the **exact** signed-in email (case-sensitive
rule): `"${roleId}_${auth.currentUser!.email}"`. Application fields match
`docs/recruitment-client-contract.md` §3. Values for the five standard
applicant fields go in `applicant`; `resume`/`taskSubmission` metas go in
`files`; every other `file` field's meta goes in `answers[fieldName]`; other
fields go into `answers[fieldName]` per type (string / number / select value /
checkbox bool).

Workflow summary for the submit handler:
1. `isRecruitmentActive` true, else show `globalMessage`.
2. Role `status` is `open` or `closing-soon` and inside the start/end window.
3. Validations pass (standard fields + per-field rules + terms checkbox +
   info-confirmation checkbox).
4. Upload all file fields (abort form if any fails).
5. `add()` the application + `status_history` subcollection seed.
6. On Firestore success show the confirmation state.

## Real-time notes

- Tab visibility & global message: `onSnapshot` on `recruitment_settings/global`.
- Role pages: use a document snapshot per role (`onSnapshot`) so `status` /
  `maxApplications` changes reflect live; disable the submit button when
  `maxApplications` is reached (server enforces the real cap).
- Do not build a client-side "number of applications" counter beyond an
  informational hint; the authoritative check is server-side.

## Contact / ownership

- Portal APIs: owned by `gdg_admin`. Any contract change is reflected in
  `docs/recruitment-client-contract.md` (this brief derives from it).
- Apps Script webhooks (Drive upload + email) are managed from the portal's
  Recruitment → Settings tab (deployment URLs pasted there, "Test" buttons
  verify them).