/**
 * GDG VitB — Recruitment confirmation email webhook.
 *
 * Called server-to-server by the admin portal at submit time. Do NOT embed
 * this in the client app or Firestore; deploy it as a standalone web app.
 *
 * Deploy: Extensions > Apps Script > paste this file.
 *         Authorize (Gmail access needed).
 *         Deploy > New deployment > Type: Web app >
 *           Execute as: Me  |  Who has access: Anyone  |  Deploy.
 *         Copy the /exec URL into Recruitment > Settings > "Email script".
 *
 * Request JSON (from the portal):
 *   { "to": "a@vishnu.edu.in", "fullName": "Alice", "roleTitle": "Flutter Dev",
 *     "applicationId": "...", "subject": "Application received — Flutter Dev",
 *     "submittedAtIso": "...", "ccEmails": ["team@vishnu.edu.in"] }
 *
 * Response JSON contract (Apps Script always returns HTTP 200):
 *   success -> { "ok": true }
 *   failure -> { "error": "human readable reason" }
 *   ping    -> { "ok": true }          (used by the Settings "Test" button)
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ error: "Missing request body" });
    }

    const data = JSON.parse(e.postData.contents);

    if (data.action === "ping") {
      return json({ ok: true });
    }

    // Accept both the portal's fields and your original names.
    const recipientEmail = data.to || data.recipientEmail || data.email;
    const name = data.fullName || data.name;
    const role = data.roleTitle || data.role;
    const subject = data.subject || `Application Received - ${role}`;
    const ccEmails = Array.isArray(data.ccEmails) ? data.ccEmails : [];

    if (!recipientEmail || !name || !role) {
      return json({
        error: "Missing required fields: to/recipientEmail, fullName/name, roleTitle/role",
      });
    }

    const htmlBody = getApplicationEmailTemplate(name, role);

    const emailOptions = {
      htmlBody: htmlBody,
      name: "GDG VIT Bhimavaram",
    };
    if (ccEmails.length > 0) {
      emailOptions.cc = ccEmails.join(",");
    }

    GmailApp.sendEmail(recipientEmail, subject, "", emailOptions);

    return json({ ok: true, message: "Confirmation email sent to " + recipientEmail });
  } catch (err) {
    return json({ error: err.toString() });
  }
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns the HTML template string with dynamic values.
 */
function getApplicationEmailTemplate(name, role) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Submitted</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #202124;">
  
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #E0E0E0; border-collapse: separate; overflow: hidden; box-shadow: 0 1px 3px rgba(60,64,67,0.08);">
          
          <!-- Google Pastel Green Header Banner -->
          <tr>
            <td style="background-color: #E6F4EA; padding: 36px 32px; text-align: center;">
              <!-- Custom Circular Logo Header -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                <tr>
                  <td align="center" style="vertical-align: middle; width: 64px; height: 64px; border-radius: 50%; overflow: hidden;">
                    <img src="https://res.cloudinary.com/dlupkibvq/image/upload/v1772770486/tclybmavbwbjen3tnuzg.png" alt="Logo" width="64" height="64" style="display: block; width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; font-size: 24px; font-weight: 500; color: #137333; letter-spacing: -0.2px;">Application Received</h1>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px 32px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #3C4043;">
                Hi <strong style="color: #202124;">${name}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #5F6368;">
                Thank you for applying! We\u2019ve successfully received your application for the <strong style="color: #202124;">${role}</strong> position.
              </p>

              <!-- Application Summary Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; border-radius: 12px; padding: 16px 20px; border: 1px solid #F1F3F4;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #70757A;">Application Details</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; line-height: 1.5; color: #3C4043;">
                    <strong>Role:</strong> ${role}<br>
                    <strong>Status:</strong> <span style="color: #137333; font-weight: 500;">Submitted</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <hr style="border: none; border-top: 1px solid #F1F3F4; margin: 0;">
            </td>
          </tr>

          <!-- GDGVITB Footer Content -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; background-color: #FFFFFF;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 500; color: #3C4043;">
                GDG VIT Bhimavaram \u00a9 2026
              </p>
              <p style="margin: 0; font-size: 12px; color: #70757A;">
                Visit us at <a href="https://gdgvitb.in" target="_blank" style="color: #1A73E8; text-decoration: none; font-weight: 500;">gdgvitb.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}