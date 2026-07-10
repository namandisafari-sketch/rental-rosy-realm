import { Resend } from "resend";
import { createServerFn } from "@tanstack/react-start";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY env var");
  return new Resend(key);
}

const HABICO_ADDRESS = "Plot 123, Acacia Avenue, Kololo, Kampala, Uganda";
const HABICO_PHONE = "+256 700 000 000";
const HABICO_TAX_ID = "URA-TIN-123456789";

function brandedWrapper(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:36px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;width:40px;height:40px;background:#fff;border-radius:8px;text-align:center;line-height:40px;font-size:20px;font-weight:800;color:#1e293b;vertical-align:middle;">H</div>
                    <span style="margin-left:10px;font-size:20px;font-weight:700;color:#fff;letter-spacing:2px;vertical-align:middle;">HABICO</span>
                  </td>
                  <td align="right" style="font-size:11px;color:#94a3b8;vertical-align:middle;">PROPERTY<br/>MANAGERS</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title bar -->
          <tr><td style="padding:0 40px;background:#f8fafc;border-bottom:1px solid #e2e8f0;"><p style="margin:0;padding:14px 0;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:1px;">${title}</p></td></tr>

          <!-- Body -->
          <tr><td style="padding:36px 40px 24px;">${body}</td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:11px;color:#94a3b8;line-height:1.6;">
                    <strong style="color:#64748b;">Habico Property Managers</strong><br/>
                    ${HABICO_ADDRESS}<br/>
                    ${HABICO_PHONE} · Tax ID: ${HABICO_TAX_ID}
                  </td>
                  <td align="right" style="font-size:10px;color:#94a3b8;">
                    &copy; ${new Date().getFullYear()} Habico<br/>
                    All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function licenseCertificateHtml(params: {
  companyName: string;
  licenseKey: string;
  adminName: string;
  adminEmail: string;
  planName: string;
  amount?: number;
  paymentDate?: string;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @page { margin: 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter','Segoe UI',system-ui,sans-serif; background: #fff; color: #1e293b; padding: 48px; }
  .certificate { max-width: 700px; margin: 0 auto; border: 2px solid #1e293b; border-radius: 16px; padding: 48px; position: relative; }
  .certificate::before { content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 1px solid #e2e8f0; border-radius: 10px; pointer-events: none; }
  .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 24px; margin-bottom: 24px; }
  .header h1 { font-size: 28px; font-weight: 800; letter-spacing: 3px; color: #1e293b; }
  .header p { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
  .badge { display: inline-block; background: #1e293b; color: #fff; padding: 8px 24px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px; }
  .field { margin-bottom: 20px; }
  .field-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
  .field-value { font-size: 15px; color: #1e293b; font-weight: 500; }
  .license-key { background: #f1f5f9; border-radius: 8px; padding: 16px 20px; font-family: 'SF Mono','Consolas','Monaco',monospace; font-size: 20px; letter-spacing: 3px; color: #0f172a; text-align: center; border: 1px dashed #cbd5e1; margin: 24px 0; }
  .grid-2 { display: flex; gap: 24px; margin-bottom: 20px; }
  .grid-2 > div { flex: 1; }
  .invoice-table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }
  .invoice-table th { text-align: left; padding: 8px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .invoice-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  .invoice-table .total { font-weight: 700; font-size: 15px; border-top: 2px solid #1e293b; border-bottom: none; }
  .terms { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; line-height: 1.6; }
  .seal { text-align: center; margin-top: 32px; opacity: 0.6; }
  .seal svg { width: 48px; height: 48px; }
</style>
</head>
<body>
<div class="certificate">
  <div class="header">
    <h1>HABICO</h1>
    <p>Property Managers · Kampala, Uganda</p>
  </div>

  <div style="text-align:center;"><span class="badge">License Certificate</span></div>

  <p style="font-size:13px;color:#475569;margin-bottom:24px;text-align:center;line-height:1.6;">
    This certifies that <strong>${params.companyName}</strong> is licensed to use the Habico Portal under the terms and conditions set forth below.
  </p>

  <div class="grid-2">
    <div class="field">
      <div class="field-label">Company</div>
      <div class="field-value">${params.companyName}</div>
    </div>
    <div class="field">
      <div class="field-label">Plan</div>
      <div class="field-value">${params.planName}</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="field">
      <div class="field-label">Registered By</div>
      <div class="field-value">${params.adminName}</div>
    </div>
    <div class="field">
      <div class="field-label">Admin Email</div>
      <div class="field-value">${params.adminEmail}</div>
    </div>
  </div>

  ${params.paymentDate ? `
  <div class="grid-2">
    <div class="field">
      <div class="field-label">Registration Date</div>
      <div class="field-value">${params.paymentDate}</div>
    </div>
    <div class="field">
      <div class="field-label">License Status</div>
      <div class="field-value" style="color:#059669;">Active</div>
    </div>
  </div>` : ""}

  <div class="field-label" style="margin-bottom:8px;">License Key</div>
  <div class="license-key">${params.licenseKey}</div>

  ${params.amount ? `
  <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-top:32px;margin-bottom:12px;">Invoice</h3>
  <table class="invoice-table">
    <tr><th>Description</th><th>Plan</th><th align="right">Amount</th></tr>
    <tr><td>Habico Portal — Initial Registration</td><td>${params.planName}</td><td align="right">UGX ${params.amount.toLocaleString()}</td></tr>
    <tr class="total"><td colspan="2" style="text-align:right;">Total Paid</td><td align="right">UGX ${params.amount.toLocaleString()}</td></tr>
  </table>
  <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Payment Date: ${params.paymentDate} · Receipt: auto-generated</div>
  ` : ""}

  <div class="terms">
    <strong>Terms &amp; Conditions</strong><br/>
    This license is granted to ${params.companyName} for the ${params.planName} plan. It is non-transferable and subject to the terms of service agreed upon during registration. For support, contact <a href="mailto:support@habico.ug" style="color:#2563eb;">support@habico.ug</a>.
  </div>

  <div class="seal">
    <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#1e293b"/><path d="M12 10h6v14h12V10h6v28h-6V26H18v12h-6V10z" fill="#fff"/></svg>
    <p style="font-size:8px;color:#94a3b8;margin-top:4px;letter-spacing:1px;">HABICO · OFFICIAL LICENSE</p>
  </div>
</div>
</body>
</html>`;
}

function licenseEmailBody(params: {
  adminName: string;
  companyName: string;
  planName: string;
  licenseKey: string;
  amount?: number;
  paymentDate?: string;
}) {
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="font-size:14px;color:#475569;line-height:1.7;">
      <p style="margin:0 0 16px;">Dear <strong style="color:#1e293b;">${params.adminName}</strong>,</p>

      <p style="margin:0 0 16px;">
        Welcome to <strong>Habico</strong>. We are pleased to confirm that
        <strong style="color:#1e293b;">${params.companyName}</strong> has been successfully registered on the
        <strong style="color:#1e293b;">${params.planName}</strong> plan.
      </p>

      <p style="margin:0 0 16px;">Your license key and invoice summary are provided below. A formal license certificate is attached to this email for your records.</p>

      <!-- License Key Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin:24px 0;">
        <tr>
          <td style="padding:20px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:1px;">License Key</p>
            <p style="margin:0;font-family:'SF Mono','Consolas',monospace;font-size:18px;letter-spacing:3px;color:#78350f;word-break:break-all;">${params.licenseKey}</p>
          </td>
        </tr>
      </table>

      <!-- Company & Plan Details -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td width="50%" style="padding:12px 16px;background:#f8fafc;border-radius:8px 0 0 8px;border-right:1px solid #e2e8f0;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Company</p>
            <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${params.companyName}</p>
          </td>
          <td width="50%" style="padding:12px 16px;background:#f8fafc;border-radius:0 8px 8px 0;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Plan</p>
            <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${params.planName}</p>
          </td>
        </tr>
      </table>

      ${params.amount ? `
      <!-- Invoice -->
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin:28px 0 12px;">Invoice Summary</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Description</td>
          <td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Amount</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#475569;">Habico Portal — ${params.planName} Plan (Monthly)</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;">UGX ${params.amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:12px;border-top:2px solid #1e293b;font-weight:700;font-size:14px;color:#1e293b;">Total</td>
          <td style="padding:12px;border-top:2px solid #1e293b;font-weight:700;font-size:14px;color:#1e293b;">UGX ${params.amount.toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">Payment Date: ${params.paymentDate} · Status: <span style="color:#059669;font-weight:600;">Paid</span></p>
      ` : ""}

      <!-- Next Steps -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:28px 0;">
        <tr>
          <td style="padding:20px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:1px;">Getting Started</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="28" style="vertical-align:top;padding:0 8px 10px 0;"><span style="display:inline-block;width:20px;height:20px;background:#166534;color:#fff;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;">1</span></td>
                <td style="font-size:13px;color:#166534;line-height:1.5;">Visit <a href="https://www.habico.ug" style="color:#2563eb;font-weight:500;">habico.ug</a> and click <strong>"Activate company license"</strong></td>
              </tr>
              <tr>
                <td width="28" style="vertical-align:top;padding:0 8px 10px 0;"><span style="display:inline-block;width:20px;height:20px;background:#166534;color:#fff;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;">2</span></td>
                <td style="font-size:13px;color:#166534;line-height:1.5;">Enter your license key to create your admin account</td>
              </tr>
              <tr>
                <td width="28" style="vertical-align:top;padding:0 8px 0 0;"><span style="display:inline-block;width:20px;height:20px;background:#166534;color:#fff;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;">3</span></td>
                <td style="font-size:13px;color:#166534;line-height:1.5;">Log in and start managing your properties</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
        If you have any questions, please reply to this email or contact our support team at
        <a href="mailto:support@habico.ug" style="color:#2563eb;">support@habico.ug</a>.
      </p>
      <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Best regards,<br/><strong style="color:#475569;">The Habico Team</strong></p>
    </td>
  </tr>
</table>`;
}

export async function sendLicenseKeyEmail(params: {
  to: string;
  companyName: string;
  licenseKey: string;
  adminName: string;
  adminEmail: string;
  planName: string;
  amount?: number;
  paymentDate?: string;
}) {
  const resend = getResend();

  const certHtml = licenseCertificateHtml({
    companyName: params.companyName,
    licenseKey: params.licenseKey,
    adminName: params.adminName,
    adminEmail: params.adminEmail,
    planName: params.planName,
    amount: params.amount,
    paymentDate: params.paymentDate,
  });

  const { data, error } = await resend.emails.send({
    from: "Habico Licenses <licenses@habico.ug>",
    to: [params.to],
    subject: `License Certificate & Invoice — ${params.companyName} · Habico Portal`,
    html: brandedWrapper(
      `License Confirmation`,
      licenseEmailBody(params),
    ),
    attachments: [
      {
        filename: `Habico-License-Certificate-${params.companyName.replace(/[^a-zA-Z0-9]/g, "-")}.html`,
        content: Buffer.from(certHtml).toString("base64"),
      },
    ],
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function sendReminderEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: "Habico Reminders <reminder@habico.ug>",
    to: [params.to],
    subject: params.subject,
    html: brandedWrapper("Notification", params.html),
  });

  if (error) throw new Error(error.message);
  return data;
}

export const sendSampleLicenseEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { to: string }) => input)
  .handler(async ({ data }) => {
    const result = await sendLicenseKeyEmail({
      to: data.to,
      companyName: "Nama Holdings Ltd.",
      licenseKey: "XK7M2AB9Q3",
      adminName: "Nama Safari",
      adminEmail: "namandisafari@gmail.com",
      planName: "Full Suite",
      amount: 150000,
      paymentDate: "10 July 2026",
    });

    return { success: true, id: result?.id };
  });
