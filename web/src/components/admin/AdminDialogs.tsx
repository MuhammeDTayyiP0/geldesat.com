import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatPrice, listingStatusLabel } from "@/lib/utils";
import { ExternalLink, AlertTriangle, Check, X, Trash2 } from "lucide-react";
import { QUICK_REJECT_REASONS } from "./shared";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — preview, reject, delete and role-change dialogs. */
export function AdminDialogs({ panel }: { panel: AdminPanel }) {
  const {
    rejectingListing,
    setRejectingListing,
    selectedReason,
    setSelectedReason,
    customReason,
    setCustomReason,
    deletingListing,
    setDeletingListing,
    previewListing,
    setPreviewListing,
    deletingUser,
    setDeletingUser,
    roleChangeTarget,
    setRoleChangeTarget,
    isSubmittingAction,
    isSubmittingRole,
    handleApproveListing,
    handleConfirmReject,
    handleConfirmDeleteListing,
    handleConfirmDeleteUser,
    handleConfirmRoleChange,
  } = panel;
  return (
    <>
      {/* ========================================================================= */}
      {/* MODALS & DIALOGS */}
      {/* ========================================================================= */}

      {/* 1. HIZLI İLAN ÖNİZLEME MODALI */}
      <Dialog
        open={Boolean(previewListing)}
        onOpenChange={(open) => {
          if (!open) setPreviewListing(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <Badge
                tone={
                  previewListing?.status === "ACTIVE"
                    ? "ok"
                    : previewListing?.status === "PENDING"
                      ? "warn"
                      : previewListing?.status === "REJECTED"
                        ? "danger"
                        : "muted"
                }
              >
                {previewListing ? listingStatusLabel(previewListing.status) : ""}
              </Badge>
              <span className="text-xs font-mono text-muted">ID: {previewListing?.id}</span>
            </div>
            <DialogTitle className="text-lg font-bold mt-2 text-left">
              {previewListing?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-left">
              Kategori: <strong className="text-fg">{previewListing?.category_name || "—"}</strong>{" "}
              · Fiyat:{" "}
              <strong className="text-fg">
                {previewListing ? formatPrice(previewListing.price) : ""}
              </strong>{" "}
              · Şehir:{" "}
              <strong className="text-fg">
                {previewListing?.city || "—"} / {previewListing?.district || "—"}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {/* Photos gallery */}
          <div className="space-y-3 py-2">
            {previewListing?.images && previewListing.images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {previewListing.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt=""
                    className="h-28 w-full object-cover rounded-lg border border-border"
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted border border-dashed rounded-lg">
                Fotoğraf yüklenmemiş.
              </div>
            )}

            {/* Description */}
            <div className="rounded-lg bg-elevated/50 p-3.5 border border-border text-xs space-y-1">
              <span className="font-semibold text-fg block">İlan Açıklaması:</span>
              <p className="text-muted whitespace-pre-wrap leading-relaxed">
                {previewListing?.description || "Açıklama girilmemiş."}
              </p>
            </div>

            {/* Attributes */}
            {previewListing?.attrs && Object.keys(previewListing.attrs).length > 0 && (
              <div className="rounded-lg border border-border p-3 text-xs space-y-1.5">
                <span className="font-semibold text-fg block">Özellikler:</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(previewListing.attrs).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between border-b border-border/50 pb-1"
                    >
                      <span className="text-muted">{k}:</span>
                      <span className="font-medium text-fg">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seller Contact */}
            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <span>
                Satıcı: <strong className="text-fg">{previewListing?.seller_name || "Üye"}</strong>
              </span>
              <Link
                to="/ilan/$slug"
                params={{ slug: previewListing?.slug || "" }}
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>İlanı Sitede Aç</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPreviewListing(null)}>
              Kapat
            </Button>
            {previewListing && previewListing.status !== "ACTIVE" && (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isSubmittingAction}
                onClick={() => void handleApproveListing(previewListing.id)}
              >
                <Check className="size-3.5 mr-1" /> Onayla ve Yayına Al
              </Button>
            )}
            {previewListing && previewListing.status !== "REJECTED" && (
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={isSubmittingAction}
                onClick={() => {
                  setRejectingListing(previewListing);
                  setSelectedReason(QUICK_REJECT_REASONS[0]);
                  setCustomReason("");
                }}
              >
                <X className="size-3.5 mr-1" /> Reddet
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. İLAN REDDETME DİYALOĞU */}
      <Dialog
        open={Boolean(rejectingListing)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingAction) {
            setRejectingListing(null);
            setSelectedReason("");
            setCustomReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2 text-left">
              <AlertTriangle className="size-5 shrink-0" />
              İlanı Reddet
            </DialogTitle>
            <DialogDescription className="text-xs text-left">
              "{rejectingListing?.title}" başlıklı ilan reddedilecek. İlan sahibine gerekçeyi
              belirten bir bildirim iletilecektir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold text-muted">
              Hazır Reddetme Gerekçesi Seçin:
            </Label>
            <div className="space-y-1.5">
              {QUICK_REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedReason(r)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs border transition-colors ${
                    selectedReason === r
                      ? "border-rose-500 bg-rose-50 text-rose-900 font-medium dark:bg-rose-950 dark:text-rose-200"
                      : "border-border hover:bg-elevated text-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <Label className="text-xs font-semibold text-muted">
                Özel Açıklama / Not (İsteğe Bağlı):
              </Label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Satıcıya iletmek istediğiniz detaylı red açıklamasını buraya yazabilirsiniz..."
                className="mt-1.5 text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectingListing(null)}
              disabled={isSubmittingAction}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => void handleConfirmReject()}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction ? "İşleniyor…" : "Reddet ve Bildir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. İLAN SİLME ONAY MODALI */}
      <AlertDialog
        open={Boolean(deletingListing)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingAction) setDeletingListing(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="size-5 shrink-0" />
              İlanı Silmek İstediğinize Emin misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              <strong>"{deletingListing?.title}"</strong> (No: {deletingListing?.id.slice(0, 8)})
              başlıklı ilan sistemden ve veritabanından kalıcı olarak silinecektir. Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingAction}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isSubmittingAction}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteListing();
              }}
            >
              {isSubmittingAction ? "Siliniyor…" : "Evet, İlanı Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 4. ÜYE SİLME ONAY MODALI */}
      <AlertDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingAction) setDeletingUser(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="size-5 shrink-0" />
              Kullanıcı Hesabını Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2 leading-relaxed">
              <p>
                <strong>"{deletingUser?.displayName}"</strong> adlı kullanıcıyı kalıcı olarak silmek
                üzeresiniz.
              </p>
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-700 dark:text-red-400">
                <p className="font-semibold mb-1">Bu işlem kapsamında:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Kullanıcının hesabı ve giriş oturumları kapatılacaktır.</li>
                  <li>
                    Kullanıcıya ait {deletingUser?.listingCount ?? 0} adet ilan ve fotoğraflar
                    silinecektir.
                  </li>
                  <li>Mesajlar, bildirimler ve favoriler veritabanından temizlenecektir.</li>
                </ul>
              </div>
              <p className="text-muted">
                Bu işlem kesin ve geri alınamaz. Devam etmek istiyor musunuz?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingAction}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isSubmittingAction}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteUser();
              }}
            >
              {isSubmittingAction ? "Kullanıcı Siliniyor…" : "Evet, Hesabı ve Verileri Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 5. KULLANICI ROL DEĞİŞİMİ MODALI */}
      <AlertDialog
        open={Boolean(roleChangeTarget)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingRole) setRoleChangeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcı Rolü Değiştirilsin mi?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              <strong>{roleChangeTarget?.displayName}</strong> adlı kullanıcının mevcut yetkisi{" "}
              <strong>{roleChangeTarget?.currentRole}</strong> iken{" "}
              <strong>{roleChangeTarget?.newRole}</strong> olarak güncellenecektir. Bu işlemi
              onaylıyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingRole}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmittingRole}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRoleChange();
              }}
            >
              {isSubmittingRole ? "Güncelleniyor…" : "Evet, Rolü Değiştir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
