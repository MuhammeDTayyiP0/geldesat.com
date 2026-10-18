import { saveSiteSettings } from "@/lib/server/account";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { cleanPhone } from "@/lib/utils";
import { toast } from "sonner";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — TAB 7: SİTE AYARLARI. */
export function SiteSettingsTab({ panel }: { panel: AdminPanel }) {
  const {
    company,
    setCompany,
    supportEmail,
    setSupportEmail,
    supportPhone,
    setSupportPhone,
    bankName,
    setBankName,
    accountHolder,
    setAccountHolder,
    iban,
    setIban,
    savingSite,
    setSavingSite,
  } = panel;
  return (
    <form
      className="max-w-2xl space-y-6 rounded-xl border border-border bg-surface p-6 shadow-xs"
      onSubmit={(e) => {
        e.preventDefault();
        setSavingSite(true);
        saveSiteSettings({
          data: {
            company_name: company.trim() || "GeldeSat",
            iban: iban.trim(),
            bank_name: bankName.trim(),
            account_holder: accountHolder.trim(),
            support_email: supportEmail.trim() || "destek@geldesat.com",
            support_phone: cleanPhone(supportPhone),
          },
        })
          .then(() => toast.success("Site ayarları başarıyla kaydedildi."))
          .catch((err) => toast.error(err instanceof Error ? err.message : "Kaydedilemedi."))
          .finally(() => setSavingSite(false));
      }}
    >
      <div>
        <h3 className="text-base font-semibold">Platform & İletişim Bilgileri</h3>
        <p className="text-xs text-muted mt-0.5">
          Bu bilgiler web sitesinin alt bilgi, iletişim ve destek alanlarında görüntülenir.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Firma / Platform Unvanı</Label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={80}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Destek E-Posta Adresi</Label>
          <Input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            maxLength={80}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Destek Telefon Numarası</Label>
          <PhoneInput
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="border-t border-border pt-5 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-fg">Banka & Havale Bilgileri (İsteğe Bağlı)</h4>
          <p className="text-xs text-muted mt-0.5">
            Doping havale/EFT ödemeleri için kullanıcılara gösterilecek resmi banka hesap
            bilgilerini buradan güncelleyebilirsiniz.
          </p>
        </div>

        <div className="space-y-3.5">
          <div>
            <Label>Banka Adı (Opsiyonel)</Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Örn: Ziraat Bankası"
              maxLength={80}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Hesap Sahibi (Opsiyonel)</Label>
            <Input
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Örn: GeldeSat Bilişim A.Ş."
              maxLength={80}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>IBAN Numarası (Opsiyonel)</Label>
            <Input
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="TR..."
              maxLength={40}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={savingSite} className="w-full sm:w-auto">
        {savingSite ? "Kaydediliyor…" : "Ayarları Kaydet"}
      </Button>
    </form>
  );
}
