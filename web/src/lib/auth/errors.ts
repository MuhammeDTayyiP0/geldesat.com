/** Better Auth answers in English; these are the messages members can run into. */
type AuthError = { code?: string; message?: string; status?: number };

const BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-posta adresi veya şifre hatalı.",
  USER_ALREADY_EXISTS: "Bu e-posta adresiyle kayıtlı bir hesap zaten var.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu e-posta adresiyle kayıtlı bir hesap zaten var.",
  PASSWORD_TOO_SHORT: "Şifre en az 8 karakter olmalı.",
  PASSWORD_TOO_LONG: "Şifre çok uzun.",
  INVALID_EMAIL: "Geçerli bir e-posta adresi girin.",
  EMAIL_NOT_VERIFIED: "E-posta adresinizi doğrulayın. Size gönderdiğimiz bağlantıya tıklayın.",
  INVALID_PASSWORD: "Mevcut şifreniz hatalı.",
  INVALID_TOKEN: "Bu bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyin.",
  TOKEN_EXPIRED: "Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.",
};

export function authErrorText(error: AuthError | null | undefined, fallback = "İşlem tamamlanamadı. Bilgilerinizi kontrol edin."): string {
  if (!error) return fallback;
  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;
  if (error.status === 429) return "Çok fazla deneme yaptınız. Lütfen biraz bekleyin.";
  if (error.message && /[ğüşıöçĞÜŞİÖÇ]/.test(error.message)) return error.message; // already Turkish, e.g. a suspended account
  if (error.status && error.status >= 500) return "Sunucu şu an yanıt veremiyor. Lütfen tekrar deneyin.";
  return fallback;
}

/** `?error=` codes Better Auth adds when it redirects back after a failed link or Google sign-in. */
export function authRedirectErrorText(code: string): string {
  const upper = code.toUpperCase();
  if (upper === "ACCOUNT_NOT_LINKED") {
    return "Bu e-postayla açılmış bir hesap var ama adresi henüz doğrulanmamış. Şifrenizle giriş yapın veya e-postanızdaki doğrulama bağlantısına tıklayın.";
  }
  if (upper === "ACCESS_DENIED") return "Google ile giriş iptal edildi.";
  return BY_CODE[upper] ?? "Giriş tamamlanamadı. Lütfen tekrar deneyin.";
}
