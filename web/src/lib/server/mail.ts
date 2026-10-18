import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional e-mail over SMTP (address verification, password reset,
 * unread-message digest). Configure with SMTP_HOST, SMTP_PORT (587),
 * SMTP_USER, SMTP_PASS, SMTP_FROM.
 */
const env = (key: string): string | undefined => process.env[key]?.trim() || undefined;

export const mailConfigured = Boolean(env("SMTP_HOST") && env("SMTP_FROM"));

const SITE = "https://www.geldesat.com";
const BRAND = "#1a4fd8";

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

async function send(to: string, subject: string, html: string, text: string) {
  if (!mailConfigured) throw new Error("E-posta gönderimi yapılandırılmamış.");
  await getTransporter().sendMail({ from: env("SMTP_FROM"), to, subject, text, html });
}

/**
 * Shared branded layout. Table-based with inline styles so it renders the same
 * in Gmail, Outlook and phone mail apps; light background, one button, and
 * the link written out for clients that block buttons.
 */
function layout(input: {
  preheader: string;
  title: string;
  /** Already-escaped HTML paragraphs. */
  bodyHtml: string;
  button?: { label: string; url: string };
  noteHtml?: string;
  footerHtml?: string;
}): string {
  const button = input.button
    ? `<tr><td style="padding:8px 0 4px">
         <table role="presentation" cellspacing="0" cellpadding="0"><tr>
           <td style="border-radius:10px;background:${BRAND}">
             <a href="${escapeHtml(input.button.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(input.button.label)}</a>
           </td>
         </tr></table>
       </td></tr>
       <tr><td style="padding:16px 0 0;font-size:12px;line-height:18px;color:#8a929e">
         Buton çalışmıyorsa bu bağlantıyı tarayıcınıza yapıştırın:<br>
         <a href="${escapeHtml(input.button.url)}" style="color:${BRAND};word-break:break-all">${escapeHtml(input.button.url)}</a>
       </td></tr>`
    : "";
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#12151c">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
    <tr><td style="padding:0 4px 20px">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td style="width:40px;height:40px"><img src="${SITE}/email-logo.png" width="40" height="40" alt="GeldeSat" style="display:block;width:40px;height:40px;border:0;border-radius:10px;box-shadow:0 1px 2px rgba(13,17,23,0.12)"></td>
        <td style="padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0d1117">GeldeSat</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #d8dee6;border-radius:16px;padding:32px 28px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="font-size:22px;line-height:30px;font-weight:700;padding-bottom:12px">${escapeHtml(input.title)}</td></tr>
        <tr><td style="font-size:15px;line-height:24px;color:#3a414c;padding-bottom:20px">${input.bodyHtml}</td></tr>
        ${button}
        ${input.noteHtml ? `<tr><td style="padding-top:24px;margin-top:24px;border-top:1px solid #eef1f5;font-size:13px;line-height:20px;color:#5a6270">${input.noteHtml}</td></tr>` : ""}
      </table>
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:#8a929e;text-align:center">
      ${input.footerHtml ?? ""}
      <a href="${SITE}" style="color:#8a929e">geldesat.com</a> · Ücretsiz ilan ver, güvenle al sat.<br>
      Bu e-posta GeldeSat hesabınızla ilgili olduğu için gönderildi.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const hello = (name?: string | null) => (name?.trim() ? `Merhaba ${escapeHtml(name.trim())},` : "Merhaba,");

/** "Confirm your address" after sign-up or when requested from settings. */
export async function sendVerificationMail(input: { to: string; name?: string | null; url: string }): Promise<void> {
  const subject = "E-posta adresinizi doğrulayın – GeldeSat";
  const html = layout({
    preheader: "Hesabınızı tamamlamak için tek bir adım kaldı.",
    title: "E-posta adresinizi doğrulayın",
    bodyHtml: `${hello(input.name)}<br><br>GeldeSat'a hoş geldiniz! Hesabınızı tamamlamak için aşağıdaki butona dokunarak <strong>${escapeHtml(input.to)}</strong> adresinin size ait olduğunu onaylayın.`,
    button: { label: "E-postamı doğrula", url: input.url },
    noteHtml: `<strong style="color:#12151c">Doğrulanmış hesapla:</strong><br>
      ✓ Şifrenizi unuttuğunuzda hesabınızı kurtarabilirsiniz<br>
      ✓ Okunmamış mesajlarınızdan e-postayla haberdar olursunuz<br>
      ✓ Google ile güvenle giriş yapabilirsiniz<br><br>
      Bağlantı 1 saat geçerlidir. Bu hesabı siz açmadıysanız bu e-postayı yok sayabilirsiniz.`,
  });
  const text = `${input.name ? `Merhaba ${input.name},` : "Merhaba,"}\n\nGeldeSat'a hoş geldiniz! E-posta adresinizi doğrulamak için bu bağlantıyı açın (1 saat geçerli):\n${input.url}\n\nBu hesabı siz açmadıysanız bu e-postayı yok sayabilirsiniz.\n— GeldeSat`;
  await send(input.to, subject, html, text);
}

/** Password reset link. */
export async function sendPasswordResetMail(input: { to: string; name?: string | null; url: string }): Promise<void> {
  const subject = "Şifre sıfırlama isteğiniz – GeldeSat";
  const html = layout({
    preheader: "Yeni şifrenizi belirlemek için bağlantı içeride.",
    title: "Şifrenizi sıfırlayın",
    bodyHtml: `${hello(input.name)}<br><br>GeldeSat hesabınız için şifre sıfırlama isteği aldık. Yeni şifrenizi belirlemek için aşağıdaki butona dokunun.`,
    button: { label: "Yeni şifre belirle", url: input.url },
    noteHtml: `Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir. Şifreniz değişince diğer cihazlardaki oturumlarınız kapatılır.<br><br>
      <strong style="color:#12151c">Bu isteği siz yapmadıysanız</strong> bu e-postayı yok sayın; şifreniz değişmez. GeldeSat sizden şifrenizi asla e-posta veya mesajla istemez.`,
  });
  const text = `${input.name ? `Merhaba ${input.name},` : "Merhaba,"}\n\nŞifrenizi sıfırlamak için bu bağlantıyı açın (1 saat geçerli):\n${input.url}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayın.\n— GeldeSat`;
  await send(input.to, subject, html, text);
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
  const subject = input.total === 1 ? "1 okunmamış mesajınız var – GeldeSat" : `${input.total} okunmamış mesajınız var – GeldeSat`;
  const rows = input.items
    .map(
      (i) => `<tr><td style="padding:12px 0;border-bottom:1px solid #eef1f5">
  <div style="font-weight:700;color:#12151c">${escapeHtml(i.from)}${i.count > 1 ? ` <span style="color:${BRAND};font-weight:600">· ${i.count} mesaj</span>` : ""}</div>
  <div style="font-size:13px;color:#8a929e">${escapeHtml(i.listing)}</div>
  <div style="margin-top:4px;color:#3a414c">${escapeHtml(i.preview)}</div>
</td></tr>`,
    )
    .join("");
  const html = layout({
    preheader: `${input.items[0]?.from ?? "Bir alıcı"}: ${input.items[0]?.preview ?? ""}`,
    title: input.total === 1 ? "1 yeni mesajınız var" : `${input.total} yeni mesajınız var`,
    bodyHtml: `${hello(input.name)}<br><br>Siz yokken gelen mesajlar cevabınızı bekliyor:
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px">${rows}</table>`,
    button: { label: "Mesajları oku", url: input.inboxUrl },
    noteHtml: "Güvenliğiniz için ürünü görmeden kapora göndermeyin ve yazışmayı GeldeSat dışına taşımayın.",
    footerHtml: `Bu e-postaları almak istemiyorsanız <a href="${escapeHtml(input.settingsUrl)}" style="color:#8a929e">bildirim tercihlerinizden</a> kapatabilirsiniz.<br>`,
  });
  const lines = input.items.map((i) => `• ${i.from} (${i.listing})${i.count > 1 ? ` — ${i.count} mesaj` : ""}: ${i.preview}`);
  const text = `Merhaba ${input.name},\n\nSiz yokken gelen mesajlar:\n\n${lines.join("\n")}\n\nMesajlarınızı okuyun: ${input.inboxUrl}\n\nBu e-postaları kapatmak için: ${input.settingsUrl}\n— GeldeSat`;
  await send(input.to, subject, html, text);
}
