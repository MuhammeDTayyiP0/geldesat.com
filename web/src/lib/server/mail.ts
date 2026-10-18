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

export type DigestItem = { from: string; listing: string; preview: string; count: number };

/** "You have N unread messages" summary with up to a few chats and a link to the inbox. */
export async function sendMessageDigestMail(input: {
  to: string;
  name: string;
  total: number;
  items: DigestItem[];
  inboxUrl: string;
  settingsUrl: string;
}): Promise<void> {
  if (!mailConfigured) throw new Error("E-posta gönderimi yapılandırılmamış.");
  const subject = input.total === 1 ? "GeldeSat'ta 1 okunmamış mesajınız var" : `GeldeSat'ta ${input.total} okunmamış mesajınız var`;
  const lines = input.items.map(
    (i) => `• ${i.from} (${i.listing})${i.count > 1 ? ` — ${i.count} mesaj` : ""}: ${i.preview}`,
  );
  const text = `Merhaba ${input.name},\n\n${subject.replace("GeldeSat'ta ", "")}:\n\n${lines.join("\n")}\n\nMesajlarınızı okuyun: ${input.inboxUrl}\n\nBu e-postaları almak istemiyorsanız: ${input.settingsUrl}\n— GeldeSat`;
  const rows = input.items
    .map(
      (i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">
  <div style="font-weight:600">${escapeHtml(i.from)}${i.count > 1 ? ` <span style="color:#1a4fd8">· ${i.count} mesaj</span>` : ""}</div>
  <div style="color:#666;font-size:13px">${escapeHtml(i.listing)}</div>
  <div style="margin-top:4px">${escapeHtml(i.preview)}</div>
</td></tr>`,
    )
    .join("");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#12151c">
<p>Merhaba ${escapeHtml(input.name)},</p>
<p>Siz yokken yeni mesajlar geldi:</p>
<table style="width:100%;border-collapse:collapse">${rows}</table>
<p style="margin:20px 0"><a href="${escapeHtml(input.inboxUrl)}" style="background:#1a4fd8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Mesajları oku</a></p>
<p style="color:#888;font-size:12px">Güvenliğiniz için ürünü görmeden kapora göndermeyin.<br>
Bu e-postaları almak istemiyorsanız <a href="${escapeHtml(input.settingsUrl)}" style="color:#888">bildirim tercihlerinizden</a> kapatabilirsiniz.<br>— GeldeSat</p>
</div>`;
  await getTransporter().sendMail({ from: env("SMTP_FROM"), to: input.to, subject, text, html });
}
