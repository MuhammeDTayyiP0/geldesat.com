import { useEffect, useMemo, useState } from "react";
import {
  adminCreditOrders,
  adminDeleteUser,
  adminListings,
  adminOverview,
  adminReports,
  adminUsers,
  deleteListing,
  resolveCreditOrder,
  setListingStatus,
  setUserRole,
} from "@/lib/server/account";
import { getSiteSettings, listCategories } from "@/lib/server/catalog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { maskPhone10 } from "@/lib/utils";
import { toast } from "sonner";
import type { CategoryRow } from "@/lib/server/helpers";
import type {
  Tab,
  ListingStatusFilter,
  UserRoleFilter,
  CreditOrderStatusFilter,
  ReportStatusFilter,
} from "./shared";

/** All admin console state, data loading and actions; the tab components only render. */
export function useAdminPanel() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("ozet");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  // Listings state
  const [listings, setListings] = useState<Awaited<ReturnType<typeof adminListings>>>([]);
  const [listingFilter, setListingFilter] = useState<ListingStatusFilter>("ALL");
  const [listingSearch, setListingSearch] = useState("");

  // Users state
  const [users, setUsers] = useState<Awaited<ReturnType<typeof adminUsers>>>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>("ALL");

  // Finance / Credit orders state
  const [creditOrders, setCreditOrders] = useState<Awaited<ReturnType<typeof adminCreditOrders>>>(
    [],
  );
  const [creditOrderFilter, setCreditOrderFilter] = useState<CreditOrderStatusFilter>("ALL");

  // Reports state
  const [reports, setReports] = useState<Awaited<ReturnType<typeof adminReports>>>([]);
  const [reportFilter, setReportFilter] = useState<ReportStatusFilter>("ALL");

  // Categories & Settings
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [company, setCompany] = useState("GeldeSat");
  const [supportEmail, setSupportEmail] = useState("destek@geldesat.com");
  const [supportPhone, setSupportPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [savingSite, setSavingSite] = useState(false);

  const [err, setErr] = useState("");

  // Modal / Action target states
  const [rejectingListing, setRejectingListing] = useState<
    Awaited<ReturnType<typeof adminListings>>[number] | null
  >(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const [deletingListing, setDeletingListing] = useState<
    Awaited<ReturnType<typeof adminListings>>[number] | null
  >(null);
  const [previewListing, setPreviewListing] = useState<
    Awaited<ReturnType<typeof adminListings>>[number] | null
  >(null);

  const [deletingUser, setDeletingUser] = useState<{
    userId: string;
    displayName: string;
    listingCount: number;
  } | null>(null);

  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    userId: string;
    displayName: string;
    currentRole: string;
    newRole: "ADMIN" | "USER";
  } | null>(null);

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  async function loadOverview() {
    try {
      const s = await adminOverview();
      setStats(s as Record<string, number>);
      setErr("");
    } catch {
      setErr("Yönetici değilsiniz veya oturumunuz sonlandı.");
    }
  }

  const userId = user?.id;
  useEffect(() => {
    if (userId) void loadOverview();
  }, [userId]);

  function fetchListings(statusFilter: ListingStatusFilter) {
    const statusParam = statusFilter === "ALL" ? undefined : statusFilter;
    return adminListings({ data: { status: statusParam } }).then(setListings);
  }

  useEffect(() => {
    if (!userId || err) return;
    if (tab === "ozet") {
      void loadOverview();
      void fetchListings("PENDING");
      void adminReports().then(setReports);
      void adminCreditOrders().then(setCreditOrders);
    } else if (tab === "ilan") {
      void fetchListings(listingFilter);
    } else if (tab === "uye") {
      void adminUsers().then(setUsers);
    } else if (tab === "finans") {
      void adminCreditOrders().then(setCreditOrders);
    } else if (tab === "sikayet") {
      void adminReports().then(setReports);
    } else if (tab === "kategori") {
      void listCategories().then((d) => setCats(d.categories));
    } else if (tab === "site") {
      void getSiteSettings().then((s) => {
        setCompany(s.company_name);
        setSupportEmail(s.support_email);
        setSupportPhone(maskPhone10(s.support_phone));
        setBankName(s.bank_name || "");
        setAccountHolder(s.account_holder || "");
        setIban(s.iban || "");
      });
    }
  }, [tab, userId, err, listingFilter]);

  // Approve listing handler
  async function handleApproveListing(id: string) {
    setIsSubmittingAction(true);
    try {
      await setListingStatus({ data: { id, status: "ACTIVE" } });
      toast.success("İlan başarıyla onaylandı ve yayına alındı.");
      await fetchListings(listingFilter);
      void loadOverview();
      if (previewListing?.id === id) {
        setPreviewListing((prev) => (prev ? { ...prev, status: "ACTIVE" } : null));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Onaylama sırasında bir hata oluştu.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Reject listing handler
  async function handleConfirmReject() {
    if (!rejectingListing) return;
    const finalReason =
      customReason.trim() || selectedReason || "İlan yayın politikalarına uygun bulunmadı.";
    setIsSubmittingAction(true);
    try {
      await setListingStatus({
        data: {
          id: rejectingListing.id,
          status: "REJECTED",
          reason: finalReason,
        },
      });
      toast.success("İlan reddedildi ve satıcıya gerekçeli bildirim gönderildi.");
      if (previewListing?.id === rejectingListing.id) {
        setPreviewListing((prev) => (prev ? { ...prev, status: "REJECTED" } : null));
      }
      setRejectingListing(null);
      setSelectedReason("");
      setCustomReason("");
      await fetchListings(listingFilter);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reddetme sırasında bir hata oluştu.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Delete listing handler
  async function handleConfirmDeleteListing() {
    if (!deletingListing) return;
    setIsSubmittingAction(true);
    try {
      await deleteListing({ data: { id: deletingListing.id } });
      toast.success("İlan kalıcı olarak silindi.");
      if (previewListing?.id === deletingListing.id) {
        setPreviewListing(null);
      }
      setDeletingListing(null);
      await fetchListings(listingFilter);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İlan silinemedi.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Delete user handler
  async function handleConfirmDeleteUser() {
    if (!deletingUser) return;
    setIsSubmittingAction(true);
    try {
      await adminDeleteUser({
        data: {
          userId: deletingUser.userId,
          deleteListings: true,
        },
      });
      toast.success(`${deletingUser.displayName} adlı kullanıcı ve tüm verileri silindi.`);
      setDeletingUser(null);
      await adminUsers().then(setUsers);
      await fetchListings(listingFilter);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kullanıcı silinemedi.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Role change handler
  async function handleConfirmRoleChange() {
    if (!roleChangeTarget) return;
    setIsSubmittingRole(true);
    try {
      await setUserRole({
        data: {
          userId: roleChangeTarget.userId,
          role: roleChangeTarget.newRole,
        },
      });
      toast.success(
        `${roleChangeTarget.displayName} kullanıcısının rolü ${roleChangeTarget.newRole} olarak güncellendi.`,
      );
      setRoleChangeTarget(null);
      await adminUsers().then(setUsers);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rol değiştirilemedi.");
    } finally {
      setIsSubmittingRole(false);
    }
  }

  // Credit order resolve handler
  async function handleResolveCreditOrder(id: string, status: "PAID" | "REJECTED") {
    setIsSubmittingAction(true);
    try {
      await resolveCreditOrder({ data: { id, status } });
      toast.success(
        status === "PAID" ? "Havale onaylandı ve doping kredisi yüklendi." : "Talep reddedildi.",
      );
      await adminCreditOrders().then(setCreditOrders);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  // Filtered listings
  const filteredListings = useMemo(() => {
    const q = listingSearch.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => {
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchId = l.id.toLowerCase().includes(q);
      const matchSeller = (l.seller_name || "").toLowerCase().includes(q);
      const matchCat = (l.category_name || "").toLowerCase().includes(q);
      return matchTitle || matchId || matchSeller || matchCat;
    });
  }, [listings, listingSearch]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) return false;
      if (!q) return true;
      const matchName = u.display_name.toLowerCase().includes(q);
      const matchEmail = (u.email || "").toLowerCase().includes(q);
      const matchPhone = (u.phone || "").toLowerCase().includes(q);
      const matchCity = (u.city || "").toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchCity;
    });
  }, [users, userSearch, userRoleFilter]);

  // Filtered credit orders
  const filteredCreditOrders = useMemo(() => {
    if (creditOrderFilter === "ALL") return creditOrders;
    return creditOrders.filter((o) => o.status === creditOrderFilter);
  }, [creditOrders, creditOrderFilter]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (reportFilter === "ALL") return reports;
    return reports.filter((r) => r.status === reportFilter);
  }, [reports, reportFilter]);

  const pendingListingsCount = stats?.pending ?? 0;
  const openReportsCount = stats?.reports ?? 0;
  const pendingOrdersCount = stats?.credit_orders ?? 0;

  return {
    user,
    isPending,
    tab,
    setTab,
    mobileMenuOpen,
    setMobileMenuOpen,
    stats,
    setStats,
    listings,
    setListings,
    listingFilter,
    setListingFilter,
    listingSearch,
    setListingSearch,
    users,
    setUsers,
    userSearch,
    setUserSearch,
    userRoleFilter,
    setUserRoleFilter,
    creditOrders,
    setCreditOrders,
    creditOrderFilter,
    setCreditOrderFilter,
    reports,
    setReports,
    reportFilter,
    setReportFilter,
    cats,
    setCats,
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
    err,
    setErr,
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
    setIsSubmittingAction,
    isSubmittingRole,
    setIsSubmittingRole,
    loadOverview,
    userId,
    fetchListings,
    handleApproveListing,
    handleConfirmReject,
    handleConfirmDeleteListing,
    handleConfirmDeleteUser,
    handleConfirmRoleChange,
    handleResolveCreditOrder,
    filteredListings,
    filteredUsers,
    filteredCreditOrders,
    filteredReports,
    pendingListingsCount,
    openReportsCount,
    pendingOrdersCount,
  };
}

export type AdminPanel = ReturnType<typeof useAdminPanel>;
