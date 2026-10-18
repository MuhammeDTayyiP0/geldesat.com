import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate, formatPhone } from "@/lib/utils";
import { toast } from "sonner";
import { ExternalLink, Search, Trash2, Phone, Mail } from "lucide-react";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — TAB 3: KULLANICI YÖNETİMİ (ÜYE SİLME & ROL DEĞİŞİMİ). */
export function UsersTab({ panel }: { panel: AdminPanel }) {
  const {
    user,
    setTab,
    setListingSearch,
    userSearch,
    setUserSearch,
    userRoleFilter,
    setUserRoleFilter,
    setDeletingUser,
    setRoleChangeTarget,
    isSubmittingAction,
    filteredUsers,
  } = panel;
  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              userRoleFilter === "ALL"
                ? "bg-ink text-surface"
                : "text-muted hover:text-fg hover:bg-elevated"
            }`}
            onClick={() => setUserRoleFilter("ALL")}
          >
            Tüm Roller
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              userRoleFilter === "ADMIN"
                ? "bg-ink text-surface"
                : "text-muted hover:text-fg hover:bg-elevated"
            }`}
            onClick={() => setUserRoleFilter("ADMIN")}
          >
            Yöneticiler (ADMIN)
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              userRoleFilter === "USER"
                ? "bg-ink text-surface"
                : "text-muted hover:text-fg hover:bg-elevated"
            }`}
            onClick={() => setUserRoleFilter("USER")}
          >
            Normal Üyeler (USER)
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="İsim, e-posta, telefon veya şehir ara..."
            className="pl-8 h-8.5 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted px-1">
        <span>Toplam {filteredUsers.length} üye listeleniyor</span>
        {userSearch && (
          <button
            type="button"
            onClick={() => setUserSearch("")}
            className="text-primary hover:underline"
          >
            Aramayı Temizle
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted bg-elevated/40">
            <tr>
              <th className="p-3.5">Kullanıcı</th>
              <th className="p-3.5">İletişim</th>
              <th className="p-3.5">Rol</th>
              <th className="p-3.5">İlan Sayısı</th>
              <th className="p-3.5">Şehir</th>
              <th className="p-3.5">Kayıt Tarihi</th>
              <th className="p-3.5 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted">
                  Arama kriterlerinize uygun kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isSelf = u.user_id === user?.id;
                return (
                  <tr key={u.user_id} className="transition-colors hover:bg-elevated/40">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-ink/10 text-ink flex items-center justify-center font-bold text-xs shrink-0">
                          {u.display_name ? u.display_name.slice(0, 2).toUpperCase() : "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to="/satici/$id"
                              params={{ id: u.user_id }}
                              target="_blank"
                              className="font-medium hover:underline text-fg text-xs inline-flex items-center gap-1"
                            >
                              <span className="truncate max-w-[150px]">
                                {u.display_name || "İsimsiz Üye"}
                              </span>
                              <ExternalLink className="size-2.5 text-muted" />
                            </Link>
                            {isSelf && (
                              <Badge tone="ink" className="text-[10px] px-1.5 py-0">
                                Siz
                              </Badge>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-muted block">
                            ID: {u.user_id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 text-xs">
                      <div className="space-y-0.5">
                        {u.email ? (
                          <div className="flex items-center gap-1 text-fg">
                            <Mail className="size-3 text-muted" />
                            <span>{u.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted">E-posta yok</span>
                        )}
                        {u.phone && (
                          <div className="flex items-center gap-1 text-muted">
                            <Phone className="size-3 text-subtle" />
                            <span className="font-mono tabular-nums">{formatPhone(u.phone)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <Badge tone={u.role === "ADMIN" ? "ink" : "muted"}>
                        {u.role === "ADMIN" ? "Yönetici (ADMIN)" : "Üye (USER)"}
                      </Badge>
                    </td>

                    <td className="p-3.5 text-xs">
                      {u.listing_count > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTab("ilan");
                            setListingSearch(u.display_name);
                          }}
                          className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <span>{u.listing_count} İlan</span>
                        </button>
                      ) : (
                        <span className="text-muted">0 İlan</span>
                      )}
                    </td>

                    <td className="p-3.5 text-xs text-muted">{u.city || "—"}</td>

                    <td className="p-3.5 text-xs text-muted tabular-nums">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Rol Değiştir */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          disabled={isSelf}
                          title={isSelf ? "Kendi yetkinizi değiştiremezsiniz" : "Rol Değiştir"}
                          onClick={() => {
                            setRoleChangeTarget({
                              userId: u.user_id,
                              displayName: u.display_name,
                              currentRole: u.role,
                              newRole: u.role === "ADMIN" ? "USER" : "ADMIN",
                            });
                          }}
                        >
                          {u.role === "ADMIN" ? "Yöneticilikten Al" : "Yönetici Yap"}
                        </Button>

                        {/* Üyeyi Sil */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                          disabled={isSelf || isSubmittingAction}
                          title={isSelf ? "Kendinizi silemezsiniz" : "Üyeyi Kalıcı Olarak Sil"}
                          onClick={() => {
                            if (u.role === "ADMIN") {
                              toast.error(
                                "Yönetici rolündeki hesaplar doğrudan silinemez. Önce rolünü 'USER' yapınız.",
                              );
                              return;
                            }
                            setDeletingUser({
                              userId: u.user_id,
                              displayName: u.display_name,
                              listingCount: u.listing_count,
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
