import nodemailer, { type Transporter } from "nodemailer";

// Gmail SMTP. Configure with an App Password (never the account password):
//   SMTP_USER=somartt.co@gmail.com
//   SMTP_PASS=<16-character Google App Password>
//   SMTP_FROM=optional "SOMART <somartt.co@gmail.com>"
// Until those exist, emails are logged to the server console instead of sent,
// so the whole flow stays testable. The sender can also be overridden per-send
// (Settings → business email), which is how a second address is supported.

let transporter: Transporter | null = null;

export function emailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!emailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const BRAND = {
  name: "SOMART",
  tagline: "Eyewear · Watches · Accessories",
  signerName: process.env.FOUNDER_NAME || "Mohamed Ali Dahir",
  signerTitle: "Founder & CEO",
};

// ── Branded document-style shell ──────────────────────────────────────────
// Deep navy header, blue→purple accent and a signed-off footer, matching the
// SOMART storefront. Table-based + inline styles for email-client support.
function documentShell(opts: { heading: string; intro: string; body: string }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0b1220;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(11,18,32,.08);">

        <tr><td style="background:#080c1a;padding:26px 32px;">
          <div style="font-size:22px;font-weight:800;letter-spacing:.14em;color:#ffffff;">${BRAND.name}</div>
          <div style="margin-top:4px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#93a1bd;">${BRAND.tagline}</div>
        </td></tr>

        <tr><td style="height:4px;background:linear-gradient(90deg,#2563eb,#7c3aed);"></td></tr>

        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:21px;font-weight:700;color:#0b1220;">${opts.heading}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#41506b;">${opts.intro}</p>
          ${opts.body}
        </td></tr>

        <tr><td style="padding:0 32px 30px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-size:14px;line-height:1.6;color:#41506b;">
            Kind regards,
            <div style="margin-top:12px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-style:italic;color:#2563eb;">${BRAND.signerName}</div>
            <div style="margin-top:2px;font-size:13px;font-weight:600;color:#0b1220;">${BRAND.signerTitle} — ${BRAND.name}</div>
          </div>
        </td></tr>

        <tr><td style="background:#f4f6fb;padding:16px 32px;text-align:center;font-size:11px;color:#7b89a3;">
          This is an automated message from the ${BRAND.name} business system. Please don't reply.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function codeBlock(code: string, minutes: number) {
  return `
  <div style="margin:8px 0 18px;padding:22px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;text-align:center;">
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7b89a3;">Your verification code</div>
    <div style="margin-top:10px;font-size:36px;font-weight:800;letter-spacing:.34em;color:#2563eb;">${code}</div>
    <div style="margin-top:10px;font-size:12px;color:#7b89a3;">Expires in ${minutes} minutes</div>
  </div>
  <p style="margin:0;font-size:13px;line-height:1.6;color:#7b89a3;">
    If you didn't request this, you can safely ignore this email — no changes will be made.
  </p>`;
}

type SendResult = { sent: boolean; devCode?: string };

async function send(to: string, subject: string, html: string, fromOverride?: string): Promise<boolean> {
  const t = getTransporter();
  const from = fromOverride || process.env.SMTP_FROM || `${BRAND.name} <${process.env.SMTP_USER}>`;
  if (!t) {
    console.warn(`[email] SMTP not configured — "${subject}" for ${to} was not sent.`);
    return false;
  }
  try {
    await t.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

export async function sendOtpEmail(
  to: string,
  name: string,
  code: string,
  purpose: "register" | "reset",
  minutes: number,
  from?: string
): Promise<SendResult> {
  const registering = purpose === "register";
  const heading = registering ? "Confirm your email address" : "Reset your password";
  const intro = registering
    ? `Hello ${name || "there"}, welcome to the ${BRAND.name} team. Use the code below to verify your email and set your password.`
    : `Hello ${name || "there"}, we received a request to reset your ${BRAND.name} password. Use the code below to continue.`;
  const html = documentShell({ heading, intro, body: codeBlock(code, minutes) });
  const sent = await send(to, `${BRAND.name} — ${registering ? "Verify your email" : "Password reset"} code`, html, from);
  if (!sent) console.warn(`[email] OTP for ${to} (${purpose}): ${code}`);
  return { sent, devCode: sent ? undefined : code };
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  roleLabel: string,
  loginUrl: string,
  from?: string
) {
  const body = `
  <div style="margin:8px 0 20px;padding:20px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7b89a3;">Your position</div>
    <div style="margin-top:6px;font-size:18px;font-weight:700;color:#0b1220;">${roleLabel}</div>
  </div>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#41506b;">
    Your account is now active. You can sign in any time with your email address and the password you just created.
  </p>
  <a href="${loginUrl}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:linear-gradient(120deg,#2563eb,#7c3aed);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">Sign in to SOMART</a>`;
  const html = documentShell({
    heading: `Welcome to ${BRAND.name}, ${name || "there"}!`,
    intro: `We're glad to have you on board. Your ${BRAND.name} account has been created and is ready to use.`,
    body,
  });
  return send(to, `Welcome to ${BRAND.name}`, html, from);
}

export async function sendInviteEmail(
  to: string,
  name: string,
  roleLabel: string,
  registerUrl: string,
  from?: string
) {
  const body = `
  <div style="margin:8px 0 20px;padding:20px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7b89a3;">Your position</div>
    <div style="margin-top:6px;font-size:18px;font-weight:700;color:#0b1220;">${roleLabel}</div>
  </div>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#41506b;">
    You've been added to the ${BRAND.name} business system. Click below to register with this email address —
    we'll send you a verification code so you can create your password.
  </p>
  <a href="${registerUrl}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:linear-gradient(120deg,#2563eb,#7c3aed);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">Create my account</a>`;
  const html = documentShell({
    heading: `You've been invited to ${BRAND.name}`,
    intro: `Hello ${name || "there"}, an account has been prepared for you on the ${BRAND.name} business system.`,
    body,
  });
  return send(to, `You've been invited to ${BRAND.name}`, html, from);
}
