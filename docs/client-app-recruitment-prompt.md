# Client App — Recruitment Module Implementation Prompt (GDG VITB)

Paste this into your Flutter build context. It describes exactly how the
client app must render the recruitment module and keep the user journey smooth.
The backend ("admin portal") is already built; this app is a **reader + submitter**
only — it never writes `recruitment_roles`, `recruitment_settings`, or
`recruitment_field_templates`, and it **never calls any Apps Script URL**.

---

## 0. Roles & boundaries

- **Read** `recruitment_roles`, `recruitment_settings/global` via the Firebase
  client SDK (real-time snapshots).
- **Write** only `recruitment_applications` (+ its `status_history` seed) with
  the signed-in user's client SDK, subject to the security rules.
- **Upload files** through the admin portal's HTTP API
  `POST {PORTAL}/api/recruitment/upload` (multipart), NOT Apps Script, NOT
  Cloudinary. `PORTAL` is the admin portal origin (configurable).
- **Emails** are sent by the admin portal's server-side webhook on submit. Show
  the user a success note; do not attempt to send anything.

## 1. Where config comes from (never hardcode)

`FirebaseFirestore.instance.collection('recruitment_settings').doc('global')`:

| Field | Meaning |
|---|---|
| `isRecruitmentActive` | master on/off. When `false`: hide/disable the journey, show `globalMessage`. |
| `globalMessage` | banner/message when inactive (or always show as banner when set). |
| `allowedEmailDomain` | only emails ending with this domain may apply (e.g. `@vishnu.edu.in`). Pre-validate on email input and surface inline. |
| `maxResumeSizeMB`, `maxTaskFileSizeMB`, `allowedResumeTypes`, `allowedTaskTypes` | fallback size/type limits for `resume`/`taskSubmission`. |
| `emailScriptUrl`, `driveUploadScriptUrl` | present for reference only — **do not call them from the client.** |

The admin portal's Apps Script mail webhook is already deployed and configured
server-side. Do not embed, distribute, or call that URL in the app.

## 2. Navigation & visibility

- Add a **"Recruitment"** entry point (e.g. in the home navigation).
- Subscribe with `snapshots()` to `recruitment_settings/global` (no polling).
  - `isRecruitmentActive == false` → hide the entry entirely (or show it
    disabled with `globalMessage`). Listen live so admins can switch it on without an app update.
- Student-facing pages:
  1. **Recruitment landing** — list of roles with `status` in
     `['open','closing-soon']` (order by `status`, then title). Cards show icon,
     title, description, deadline, "Closing soon" badge, "Open" badge, and a
     live `applicationCount` vs `maxApplications` hint when relevant.
  2. **Role detail** — the application form (below). Deep-linkable as
     `/recruitment/<roleId>`.
  3. **Success screen** — after submit.

## 3. Role detail page / form rendering

Render **exactly the role's schema** — nothing hardcoded:

`role.sections[].{number,title,description?,borderColor}` group the questions.
Render each section as a card; render fields in `role.order` order:

| `type` | Widget + validation |
|---|---|
| `text` | single-line `TextField`, optional `placeholder`, `helpText`, min/max length, `pattern` (with `patternMessage`) |
| `email` | email keyboard + regex; also check `settings.allowedEmailDomain` on the *identity* email |
| `tel` | phone keyboard |
| `url` | URL keyboard + parse validation |
| `number` | number keyboard, numeric validation |
| `select` | dropdown built from `options[].{label,value}` (value is what gets stored) |
| `checkbox` | checkbox tile using `checkboxLabel ?? label`; store bool |
| `file` | file picker (see §4) |

Identity fields (`fullName`, `email`, `phone`, `branch`, `yearOfStudy`):
- If the role **defines** a field whose (case-insensitive) name matches one of
  these, render it from the schema and treat it as identity.
- If the role omits `fullName` or `email`, render a small built-in block with
  those two only (they are required by the backend).
- Do **not** render a hardcoded full identity block when the schema already
  covers it (no duplicates). No hardcoded "Links" section.

Use required-asterisks, inline error text under each field, and mark fields
with `helpText`.

## 4. File upload UX (the smoothest part matters most)

Each `file` field:

1. **Pre-validate before uploading:**
   - extension against `field.allowedExtensions` (or `field.accept`) and the
     `settings.allowed*Types` fallback for `resume`/`taskSubmission`;
   - size against `field.maxSizeMB` fallback `settings.maxResumeSizeMB` /
     `settings.maxTaskFileSizeMB` (hard cap 50 MB on server).
   - Show failure inline under the field ("Unsupported file type", "File must
     be under X MB") **before** any HTTP call.
2. **Upload** via
   `POST {PORTAL}/api/recruitment/upload` with multipart fields `file`,
   `roleId` (= role id), `fieldName` (= field `name`).
   Response 200: `{ success, url, driveFileId, originalName, mimeType, sizeBytes }`.
   - Show a per-field upload progress/spinner. Disable only that field while
     uploading, not the whole form.
   - On failure: remove the spinner, show a friendly retry affordance; do **not**
     block other fields. Network errors → "Couldn't upload. Check your
     connection and try again."
3. **After success:** show the chip with file name + size + a remove (X) to
   reselect. Storing a file's meta (url + driveFileId) is part of the
   application payload (below); `driveUploadScriptUrl` is resolved server-side
   from the role field, so the client never picks a folder.
4. **Before submit:** if any `file` field is required and missing a meta,
   collect it and block submit with a highlighted inline message.

## 5. Submitting an application

Only allow submit when the role page's live state is "open": role `status` in
`['open','closing-soon']`, within `applicationStart`/`applicationEnd` (use the
role doc snapshot — admins may change it live), below `maxApplications`, and
`isRecruitmentActive == true`.

Payload (Firestore `add` to `recruitment_applications`):

```
roleId, userId: currentUser.uid,
userEmail: currentUser!.email,           // EXACT token email, do not transform
applicant: { fullName, email, phone, branch, yearOfStudy },  // identity values; email lowercase
socialLinks: { linkedin?, github?, portfolio?, gitRepoLink? }, // optional
files: { resume: meta, taskSubmission?: meta } // only for those two reserved names
answers: { fieldName: value, ... },      // per §3; file fields != resume/taskSubmission → their meta {url, driveFileId, originalName, mimeType, sizeBytes}, number → num, checkbox → bool, others → string
status: 'submitted',
currentReviewer: null, shortlistedAt: null, reviewedAt: null,
acceptedAt: null, rejectedAt: null, rejectedReason: null,
dedupeKey: '${roleId}_${currentUser!.email}',     // VERBATIM email — case sensitive
agreeToTerms: true, confirmInfo: true,
isRead: false, isStarred: false, notes: '',
submittedAt: FieldValue.serverTimestamp(),
updatedAt: FieldValue.serverTimestamp(),
```
then seed subcollection:
`recruitment_applications/<newId>/status_history` add
`{ fromStatus: 'none', toStatus: 'submitted', changedBy: 'system', reason: 'Application submitted', createdAt: serverTimestamp }`.

**User journey around submit:**
- Disable the submit button while in flight (show progress on the button).
- Handle server errors distinctly:
  - duplicated (`"You have already applied"`) → friendly "You've already
    applied for this role" screen with a "View my applications" path;
  - domain reject (`"Only @vishnu.edu.in emails are allowed"`);
  - role closed/deadline passed / max reached → read-only notice (no more
    attempts);
  - network → allow retry, keep the entered + uploaded state intact (never
    wipe the form on a failed submit).
- Success screen: big check, "Application submitted!", your name, role title,
  reference id, and **"We've sent a confirmation email to <email>."** Confirmation
  emails are sent automatically by the admin portal; do not attempt to send the
  email in the app.

## 6. Smooth-journey checklist (implement all)

- [ ] Loading states (role cards skeleton, role page skeleton) — never blank flicker.
- [ ] Empty states (no open roles right now → friendly message + fallback image).
- [ ] Inline field validation; clear error on edit.
- [ ] Real-time: settings snapshot (tab visibility/message) + role snapshot
      (status/deadline/maxApplications changes mid-form → banner + block submit).
- [ ] Optimistic-free submit (server confirms before success screen).
- [ ] File upload: progress, retry, remove, size/type pre-check (no HTTP on bad file).
- [ ] Scroll-to-first-error on submit.
- [ ] Keyboard: return→next focus, appropriate input types/autocorrect off for email/tel.
- [ ] Accessibility: labels for every input, aria/semantics for the file chip
      and error text, sufficient contrast, tappable targets ≥44dp.
- [ ] Deep link `/recruitment/<roleId>` works from anywhere (and shows the form
      only when eligible, else the correct gating message).
- [ ] Signed-in required: if the user opens recruitment signed out, prompt to
      sign in (rules require the token) and return them to the same role.
- [ ] Low-connectivity: timeouts with friendly retry, cache last-known settings.
- [ ] No application-count promises: show `maxApplications` as informational;
      the authoritative check is the server's create rule.

## 7. Reference contracts (already implemented server-side)

- Portal upload API: `POST {PORTAL}/api/recruitment/upload` (multipart
  `file`+`roleId`+`fieldName` → 200 `{success,url,driveFileId,originalName,mimeType,sizeBytes}`; CORS enabled for the portal origin; admin session not required).
- Apps Script mail webhook: **already deployed and configured** in
  `recruitment_settings/global.emailScriptUrl`. Backend invokes it per
  successful application with `{to, fullName, roleTitle, applicationId, subject,
  submittedAtIso, ccEmails?}`. Client role is only to show "confirmation email
  sent." Keep the deployed URL out of the client bundle.
- Full Firestore contract: `docs/recruitment-client-contract.md`.