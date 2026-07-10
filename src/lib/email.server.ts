import { Resend } from "resend";
import { createServerFn } from "@tanstack/react-start";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY env var");
  return new Resend(key);
}

export async function sendLicenseKeyEmail(params: {
  to: string;
  companyName: string;
  licenseKey: string;
  adminName: string;
  adminEmail: string;
  planName: string;
}) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: "Habico Licenses <licenses@habico.ug>",
    to: [params.to],
    subject: `Your Habico License Key — ${params.companyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e293b; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Habico Portal</h1>
        </div>
        <div style="padding: 32px 24px; background: #fff;">
          <h2 style="margin-top: 0; color: #1e293b;">Your company is registered!</h2>
          <p style="color: #475569; line-height: 1.6;">Hi <strong>${params.adminName}</strong>,</p>
          <p style="color: #475569; line-height: 1.6;">
            <strong>${params.companyName}</strong> has been registered on the <strong>${params.planName}</strong> plan.
          </p>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #92400e;">Your License Key</p>
            <code style="display: block; font-size: 18px; letter-spacing: 2px; color: #78350f; word-break: break-all;">
              ${params.licenseKey}
            </code>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 4px; color: #475569;"><strong>Email:</strong> ${params.adminEmail}</p>
            <p style="margin: 0; color: #475569;"><strong>Company:</strong> ${params.companyName}</p>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">What to do next</p>
            <ol style="margin: 0; padding-left: 20px; color: #166534; line-height: 1.8;">
              <li>Go to <a href="https://www.habico.ug" style="color: #2563eb;">habico.ug</a></li>
              <li>Click <strong>"Activate company license"</strong> on the sign-in page</li>
              <li>Enter your license key to set up your admin account</li>
              <li>Log in and start managing your properties</li>
            </ol>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
            If you didn't register for Habico, please ignore this email.<br/>
            &copy; 2026 Habico Property Managers
          </p>
        </div>
      </div>
    `,
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
    html: params.html,
  });

  if (error) throw new Error(error.message);
  return data;
}

export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { to: string }) => input)
  .handler(async ({ data }) => {
    const resend = getResend();
    const { data: result, error } = await resend.emails.send({
      from: "Habico Licenses <licenses@habico.ug>",
      to: [data.to],
      subject: "Test email from Habico — Resend is working",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #1e293b;">✅ Resend is connected!</h1>
          <p style="color: #475569; line-height: 1.6;">
            This is a test email sent from Habico via Resend.
            Your email setup is working correctly.
          </p>
          <p style="color: #94a3b8; font-size: 12px;">Habico Property Managers · Kampala</p>
        </div>
      `,
    });

    if (error) return { success: false as const, message: error.message };
    return { success: true as const, id: result?.id };
  });
