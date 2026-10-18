import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional e-mail over SMTP (password reset, address verification).
 * Configure with SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_FROM.
 */
const env = (key: string): string | undefined => process.env[key]?.trim() || undefined;

export const mailConfigured = Boolean(env("SMTP_HOST") && env("SMTP_FROM"));

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(env("SMTP_PORT") ?? 587);
    const user = env("SMTP_USER");
    transporter = nodemailer.createTransport({
      host: env("SMTP_HOST"),
      port,
      secure: port === 465,
      auth: user ? { user, pass: env("SMTP_PASS") ?? "" } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** Send a short message with one call-to-action link. */
export async function sendActionMail(input: {
  to: string;
  subject: string;
  intro: string;
  actionLabel: string;
  url: string;
}): Promise<void> {
  if (!mailConfigured) throw new Error("E-posta gönderimi yapılandırılmamış.");
  const text = `${input.intro}\n\n${input.actionLabel}: ${input.url}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.\n— GeldeSat`;
  const html = `<p>${escapeHtml(input.intro)}</p>
<p><a href="${escapeHtml(input.url)}">${escapeHtml(input.actionLabel)}</a></p>
<p style="color:#666;font-size:13px">Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.<br>— GeldeSat</p>`;
  await getTransporter().sendMail({ from: env("SMTP_FROM"), to: input.to, subject: input.subject, text, html });
}
