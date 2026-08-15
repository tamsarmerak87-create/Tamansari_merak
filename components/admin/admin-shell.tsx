"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileClock,
  FileDown,
  FileText,
  History,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Newspaper,
  Printer,
  QrCode,
  Scale,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { getCurrentAdminPortalUser, logoutAdminPortal, type AdminPortalProfile } from "@/services/admin-auth.service";
import { subscribeToTable } from "@/services/supabase";
import { cn } from "@/utils/cn";

type Row = Record<string, any>;
type Toast = { type: "success" | "error" | "loading"; text: string } | null;
type PendingWarga = {
  id: string;
  nama_lengkap?: string | null;
  nik?: string | null;
  email?: string | null;
  created_at?: string | null;
  status_verifikasi?: string | null;
  alasan_penolakan?: string | null;
};
const statuses = [
  "Menunggu Verifikasi",
  "Disetujui",
  "Selesai",
  "Ditolak",
];
const workflowRoles = ["staff_pelayanan", "petugas_lapangan", "kepala_seksi", "seklur", "lurah"] as const;
const roleStatus: Record<string, string> = {
  staff_pelayanan: "MENUNGGU_STAFF",
  petugas_lapangan: "MENUNGGU_PETUGAS_LAPANGAN",
  kepala_seksi: "MENUNGGU_KASI",
  seklur: "MENUNGGU_SEKLUR",
  lurah: "MENUNGGU_LURAH",
};

function roleLabel(role?: string | null) {
  const labels: Record<string, string> = {
    admin: "Administrator",
    staff_pelayanan: "Staff Pelayanan",
    petugas_lapangan: "Petugas Lapangan",
    kepala_seksi: "Kepala Seksi",
    seklur: "Seklur",
    lurah: "Lurah",
  };
  return labels[String(role ?? "")] ?? String(role ?? "Petugas");
}

function normalizeStatus(value?: string | null) {
  if (!value) return "Menunggu Verifikasi";
  const workflowLabels: Record<string, string> = {
    MENUNGGU_STAFF: "MENUNGGU_STAFF",
    MENUNGGU_PETUGAS_LAPANGAN: "MENUNGGU_PETUGAS_LAPANGAN",
    MENUNGGU_KASI: "MENUNGGU_KASI",
    MENUNGGU_SEKLUR: "MENUNGGU_SEKLUR",
    MENUNGGU_LURAH: "MENUNGGU_LURAH",
    REVISI: "REVISI",
    DITOLAK: "Ditolak",
    SELESAI: "Selesai",
  };
  if (workflowLabels[value]) return workflowLabels[value];
  if (value === "Sedang Diproses") return "Diproses";
  return value;
}

function normalizedWorkflowStatus(row: Row) {
  const raw = String(row.workflow_status ?? row.status ?? "").toUpperCase().replace(/\s+/g, "_");
  if (raw === "MENUNGGU_VERIFIKASI" || !raw) return "MENUNGGU_STAFF";
  if (raw === "DISETUJUI") return "SELESAI";
  return raw;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function serviceName(row: Row) {
  return row.layanan?.nama ?? row.jenis_surat ?? row.layanan_nama ?? "-";
}

function petugasName(row: Row) {
  return row.petugas?.full_name ?? row.petugas?.nama_lengkap ?? row.petugas?.nama ?? row.petugas_nama ?? row.admin?.full_name ?? row.admin?.nama ?? "-";
}

function verificationStages(row: Row) {
  return Array.isArray(row.verifikasi_pengajuan) ? [...row.verifikasi_pengajuan].sort((a: Row, b: Row) => Number(a.tahap ?? 0) - Number(b.tahap ?? 0)) : [];
}

function activeStage(row: Row) {
  return verificationStages(row).find((stage: Row) => ["Menunggu", "Diproses"].includes(String(stage.status))) ?? null;
}

function officerName(stage?: Row | null) {
  return stage?.petugas?.nama_lengkap ?? stage?.petugas?.username ?? stage?.petugas_nama ?? "Belum diproses";
}

function tableOfficerName(stage?: Row | null) {
  if (!stage || !["Disetujui", "Ditolak"].includes(String(stage.status))) return "-";
  return stage.petugas?.nama_lengkap ?? stage.petugas?.username ?? stage.nama_petugas ?? stage.petugas_nama ?? "-";
}

const stepDefinitions = [
  { tahap: 1, short: "Staff", label: "Staff Pelayanan" },
  { tahap: 2, short: "Lapangan", label: "Petugas Lapangan" },
  { tahap: 3, short: "Kasi", label: "Kasi" },
  { tahap: 4, short: "Seklur", label: "Seklur" },
  { tahap: 5, short: "Lurah", label: "Lurah" },
  { tahap: 6, short: "Terbit", label: "Surat Terbit" },
] as const;

function stageByNumber(row: Row, tahap: number) {
  return verificationStages(row).find((stage: Row) => Number(stage.tahap) === tahap);
}

function stepState(row: Row, tahap: number) {
  const current = normalizedWorkflowStatus(row);
  if (tahap === 6) return current === "SELESAI" ? "done" : "pending";
  const stage = stageByNumber(row, tahap);
  if (stage?.status === "Ditolak") return "rejected";
  if (stage?.status === "Disetujui") return "done";
  if (["Menunggu", "Diproses"].includes(String(stage?.status)) && current !== "DITOLAK") return "active";
  return "pending";
}

function WorkflowMini({ row }: { row: Row }) {
  return <div className="flex min-w-[210px] flex-wrap gap-1.5">
    {stepDefinitions.map((step) => {
      const state = stepState(row, step.tahap);
      return <span key={step.tahap} className={cn("rounded-full px-2 py-1 text-[11px] font-black", state === "done" ? "bg-emerald-100 text-emerald-800" : state === "active" ? "bg-accent-200 text-gov-950 ring-1 ring-accent-300" : state === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}>
        {state === "done" ? "✓" : state === "active" ? "●" : state === "rejected" ? "×" : "○"} {step.short}
      </span>;
    })}
  </div>;
}

function WorkflowStepper({ row }: { row: Row }) {
  return <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100 bg-white p-4">
    <div className="flex min-w-[720px] items-center gap-2">
      {stepDefinitions.map((step, index) => {
        const state = stepState(row, step.tahap);
        return <div key={step.tahap} className="flex flex-1 items-center gap-2">
          <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3", state === "done" ? "bg-emerald-50 text-emerald-800" : state === "active" ? "bg-accent-100 text-gov-950 ring-1 ring-accent-300" : state === "rejected" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500")}>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-black", state === "done" ? "bg-emerald-500 text-white" : state === "active" ? "bg-accent-400 text-gov-950" : state === "rejected" ? "bg-red-600 text-white" : "bg-white text-slate-400")}>{state === "done" ? "✓" : state === "active" ? "●" : state === "rejected" ? "×" : "○"}</span>
            <span className="truncate text-sm font-black">{step.short}</span>
          </div>
          {index < stepDefinitions.length - 1 && <span className="text-slate-300">→</span>}
        </div>;
      })}
    </div>
  </div>;
}

function canProcessStage(row: Row, profile?: AdminPortalProfile | null) {
  const stage = activeStage(row);
  const role = profile?.role;
  if (role === "admin") return Boolean(stage && ["Menunggu", "Diproses"].includes(String(stage.status)) && roleStatus[String(stage.role_petugas)] === normalizedWorkflowStatus(row));
  return Boolean(stage && role === stage.role_petugas && roleStatus[String(role)] === normalizedWorkflowStatus(row) && workflowRoles.includes(role as typeof workflowRoles[number]));
}

function isIssued(row: Row) {
  return normalizedWorkflowStatus(row) === "SELESAI" || normalizeStatus(row.status) === "Selesai";
}

function actionLabel(row: Row) {
  const stage = activeStage(row);
  if (!stage) return "Verifikasi";
  if (stage.tahap === 1) return "Verifikasi";
  if (stage.tahap === 2) return "Verifikasi Lapangan";
  if (stage.tahap === 3) return "Setujui";
  if (stage.tahap === 4) return "Ajukan ke Lurah";
  return "Validasi & Terbitkan";
}

function stageShort(row: Row) {
  if (isIssued(row)) return "Terbit";
  const stage = activeStage(row);
  const step = stepDefinitions.find((item) => item.tahap === Number(stage?.tahap));
  return step?.short ?? (normalizeStatus(row.status) === "Ditolak" ? "Ditolak" : "-");
}

function workflowStatusLabel(row: Row) {
  const current = normalizedWorkflowStatus(row);
  const labels: Record<string, string> = {
    MENUNGGU_STAFF: "Menunggu Staff Pelayanan",
    MENUNGGU_PETUGAS_LAPANGAN: "Menunggu Petugas Lapangan",
    MENUNGGU_KASI: "Menunggu Kasi",
    MENUNGGU_SEKLUR: "Menunggu Seklur",
    MENUNGGU_LURAH: "Menunggu Lurah",
    REVISI: "Revisi",
    DITOLAK: "Ditolak",
    SELESAI: "Selesai",
  };
  return labels[current] ?? normalizeStatus(row.status);
}

function workflowStatusDisplay(row: Row) {
  const current = normalizedWorkflowStatus(row);
  const labels: Record<string, string> = {
    MENUNGGU_STAFF: "MENUNGGU STAFF PELAYANAN",
    MENUNGGU_PETUGAS_LAPANGAN: "MENUNGGU PETUGAS LAPANGAN",
    MENUNGGU_KASI: "MENUNGGU KASI",
    MENUNGGU_SEKLUR: "MENUNGGU SEKLUR",
    MENUNGGU_LURAH: "MENUNGGU LURAH",
    REVISI: "REVISI",
    DITOLAK: "DITOLAK",
    SELESAI: "SELESAI",
  };
  return labels[current] ?? String(normalizeStatus(row.status)).toUpperCase();
}

function accessLabel(row: Row, profile?: AdminPortalProfile | null) {
  const stage = activeStage(row);
  if (profile?.role === "admin") return "Administrator - Monitoring";
  if (!stage) return normalizeStatus(row.status) === "Selesai" ? "Selesai" : "Tidak ada tahap aktif";
  if (stage.tahap === 5 && profile?.role !== "lurah") return "Menunggu Persetujuan Lurah";
  if (profile?.role === stage.role_petugas) return stage.tahap === 5 ? "Setujui / Tolak" : "Proses Tahap Ini";
  return `Menunggu ${roleLabel(stage.role_petugas)}`;
}

function fileUrl(row: Row) {
  return row.url_file ?? row.file_url ?? row.url ?? row.public_url ?? row.path ?? "";
}

function statusBadgeClass(status?: string | null) {
  const normalized = normalizeStatus(status);
  const raw = String(status ?? "").toUpperCase();
  if (raw.includes("MENUNGGU") || normalized === "Menunggu") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (normalized === "Selesai") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (normalized === "Disetujui") return "bg-cyan-100 text-cyan-800 ring-cyan-200";
  if (normalized === "Diproses") return "bg-gov-100 text-blue-800 ring-blue-200";
  if (normalized === "Terverifikasi") return "bg-cyan-100 text-cyan-800 ring-cyan-200";
  if (normalized === "Ditolak") return "bg-red-100 text-red-800 ring-red-200";
  return "bg-amber-100 text-amber-800 ring-amber-200";
}

function StatusBadge({ status }: { status?: string | null }) {
  return <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1", statusBadgeClass(status))}><span className="size-2 rounded-full bg-current" />{normalizeStatus(status)}</span>;
}

function csvCell(value: unknown) {
  const text = String(value ?? "-").replace(/"/g, '""');
  return /[",\n\r]/.test(text) ? `"${text}"` : text;
}

const nav = [
  ["Dashboard", "/admin/dashboard", LayoutDashboard, false],
  ["Master Layanan", "/admin/layanan", Settings, true],
  ["Verifikasi Warga", "/admin/verifikasi-warga", ShieldCheck, true],
  ["Pengajuan", "/admin/pengajuan", ClipboardList, false],
  ["Tracking", "/admin/tracking", QrCode, false],
  ["POSBANKUM", "/admin/posbankum", Scale, false],
  ["Berita", "/admin/berita", Newspaper, true],
  ["Petugas", "/admin/petugas", UserCog, true],
  ["Pengguna", "/admin/pengguna", Users, true],
  ["Laporan", "/admin/laporan", LineChart, true],
  ["Pengaturan", "/admin/pengaturan", Settings, true],
] as const;

const adminOnlyViews = new Set(["layanan", "verifikasi-warga", "berita", "petugas", "pengguna", "laporan", "pengaturan"]);

function useAdminData() {
  const [submissions, setSubmissions] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  const [pendingWarga, setPendingWarga] = useState<PendingWarga[]>([]);
  const [wargaProfiles, setWargaProfiles] = useState<PendingWarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/data", { credentials: "include", cache: "no-store" });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; data?: { submissions?: Row[]; services?: Row[]; pendingWarga?: PendingWarga[]; wargaProfiles?: PendingWarga[] } } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error ?? "Gagal memuat data admin.");
      setSubmissions(result.data?.submissions ?? []);
      setServices(result.data?.services ?? []);
      setPendingWarga(result.data?.pendingWarga ?? []);
      setWargaProfiles(result.data?.wargaProfiles ?? []);
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Gagal memuat data",
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  return { submissions, services, pendingWarga, setPendingWarga, wargaProfiles, setWargaProfiles, loading, toast, setToast, load };
}

export function AdminShell({
  view,
  id,
}: {
  view: "dashboard" | "verifikasi" | "verifikasi-warga" | "pengajuan" | "detail" | "layanan" | "tracking" | "posbankum" | "berita" | "laporan" | "pengguna" | "pengaturan";
  id?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<Row | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminPortalProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { submissions, services, pendingWarga, setPendingWarga, wargaProfiles, setWargaProfiles, loading, toast, setToast, load } =
    useAdminData();
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getCurrentAdminPortalUser();
        if (!active) return;
        if (!current.user || !current.profile) {
          router.replace("/admin/login");
          return;
        }
        setAdminProfile(current.profile);
      } catch (error) {
        console.error(error);
        router.replace("/admin/login");
      } finally {
        if (active) setAuthLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);
  useEffect(() => {
    if (toast?.type !== "loading") {
      const t = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(t);
    }
  }, [toast, setToast]);
  useEffect(() => {
    if (!adminProfile) return;
    const channel = subscribeToTable("pengajuan_surat", () => {
      void load();
      setToast({ type: "success", text: "Data pengajuan diperbarui realtime." });
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [adminProfile, load, setToast]);
  const filtered = useMemo(() => submissions
    .filter((r) =>
      [r.nomor_pengajuan, r.nama_lengkap, r.nik, r.nomor_hp, r.no_hp]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter((r) => !status || normalizeStatus(r.status) === status)
    .filter((r) => !service || r.layanan_id === service)
    .filter((r) => !dateStart || String(r.created_at).slice(0, 10) >= dateStart)
    .filter((r) => !dateEnd || String(r.created_at).slice(0, 10) <= dateEnd), [submissions, query, status, service, dateStart, dateEnd]);
  const stat = (s: string) => submissions.filter((r) => r.status === s).length;
  const today = new Date().toISOString().slice(0, 10);
  const cards = [
    ["Total Warga", wargaProfiles.length],
    ["Belum Terverifikasi", wargaProfiles.filter((w) => w.status_verifikasi === "Belum Terverifikasi").length],
    ["Sudah Terverifikasi", wargaProfiles.filter((w) => w.status_verifikasi === "Terverifikasi").length],
    [
      "Pengajuan Hari Ini",
      submissions.filter((r) => String(r.created_at).startsWith(today)).length,
    ],
    ["Pengajuan Selesai", stat("Selesai")],
    ["Pengajuan Ditolak", stat("Ditolak")],
  ];
  const updateStatus = async (row: Row, action: "proses_tahap" | "verifikasi" | "setujui" | "selesai" | "tolak" | "revisi", extra?: { catatan_petugas?: string; alasan_penolakan?: string; hasil_verifikasi?: string; dokumentasi_url?: string; checklist?: Record<string, boolean> }) => {
    try {
      setToast({ type: "loading", text: "Menyimpan perubahan..." });
      const res = await fetch("/api/admin/pengajuan", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: row.id, action, ...extra }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Gagal memperbarui status");
      setToast({ type: "success", text: action === "tolak" ? "Pengajuan berhasil ditolak." : action === "revisi" ? "Pengajuan dikembalikan untuk revisi." : action === "selesai" ? "Surat berhasil diterbitkan." : "Tahap verifikasi berhasil diproses." });
      setSelectedSubmission(null);
      setRejectTarget(null);
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "Gagal memperbarui status" });
    } finally {
      await load();
    }
  };
  const rejectSubmission = async (row: Row) => {
    setRejectTarget(row);
  };
  const deleteSubmission = async (row: Row) => {
    const confirmed = window.confirm("Hapus pengajuan ini?\n\nPengajuan dan seluruh data terkait akan dihapus permanen.");
    if (!confirmed) return;

    try {
      setToast({ type: "loading", text: "Menghapus pengajuan..." });
      const res = await fetch(`/api/admin/pengajuan/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Gagal menghapus pengajuan");
      setToast({ type: "success", text: "Pengajuan berhasil dihapus." });
      await load();
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "Gagal menghapus pengajuan" });
    }
  };
  const verifyWarga = async (row: PendingWarga) => {
    try {
      setToast({ type: "loading", text: `Memverifikasi ${row.nama_lengkap ?? "warga"}...` });
      const res = await fetch("/api/admin/verifikasi", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wargaId: row.id, status_verifikasi: "Terverifikasi" }),
      });
      const json = await res.json().catch(() => null) as { ok?: boolean; error?: string; data?: PendingWarga[] } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Gagal memverifikasi warga");
      if (!json.data?.length) throw new Error("Tidak ada data warga yang diperbarui. Toast sukses dibatalkan.");
      setPendingWarga((prev) => prev.filter((item) => item.id !== row.id));
      setWargaProfiles((prev) => prev.map((item) => item.id === row.id ? { ...item, status_verifikasi: "Terverifikasi", alasan_penolakan: null } : item));
      setToast({ type: "success", text: "Warga berhasil diverifikasi. Akses dashboard warga sudah aktif." });
      await load();
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "Gagal memverifikasi warga" });
    }
  };
  const rejectWarga = async (row: PendingWarga) => {
    const reason = window.prompt(`Masukkan alasan penolakan untuk ${row.nama_lengkap ?? "warga"}:`);
    if (!reason?.trim()) return;
    try {
      setToast({ type: "loading", text: "Menyimpan penolakan..." });
      const res = await fetch("/api/admin/verifikasi", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wargaId: row.id, status_verifikasi: "Ditolak", alasan_penolakan: reason.trim() }),
      });
      const json = await res.json().catch(() => null) as { ok?: boolean; error?: string; data?: PendingWarga[] } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Gagal menolak verifikasi warga");
      if (!json.data?.length) throw new Error("Tidak ada data warga yang diperbarui. Toast sukses dibatalkan.");
      setPendingWarga((prev) => prev.filter((item) => item.id !== row.id));
      setWargaProfiles((prev) => prev.map((item) => item.id === row.id ? { ...item, status_verifikasi: "Ditolak", alasan_penolakan: reason.trim() } : item));
      setToast({ type: "success", text: "Status warga berhasil ditolak dengan alasan." });
      await load();
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "Gagal menolak verifikasi warga" });
    }
  };
  const exportCsv = () => {
    const csv = [
      "Nomor,Tanggal,Pemohon,Layanan,Tahap,Status",
      ...filtered.map((r) =>
        [
          r.nomor_pengajuan,
          formatDate(r.created_at),
          r.nama_lengkap,
          serviceName(r),
          workflowStageKey(r),
          trackingStatusLabel(r),
        ].map(csvCell).join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "pengajuan.csv";
    a.click();
  };
  const detail = submissions.find((r) => r.id === id);
  if (authLoading || !adminProfile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#071a33,#0B2C6A)] p-6 text-white">
        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
          <RefreshCw className="mx-auto size-8 animate-spin text-accent-300" />
          <p className="mt-4 font-black">Memverifikasi akses admin/petugas...</p>
        </div>
      </main>
    );
  }
  if (adminProfile.role !== "admin" && adminOnlyViews.has(view)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#071a33,#0B2C6A)] p-6 text-white">
        <div className="max-w-lg rounded-[2rem] border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
          <ShieldCheck className="mx-auto size-10 text-accent-300" />
          <h1 className="mt-4 text-2xl font-black">403 Forbidden</h1>
          <p className="mt-3 font-bold text-white/80">Fitur ini khusus Administrator. Akun petugas tetap dapat mengakses dashboard, pengajuan, tracking, dan menu operasional sesuai kewenangannya.</p>
          <button type="button" onClick={() => router.replace("/admin/dashboard")} className="mt-6 rounded-2xl bg-accent-400 px-5 py-3 font-black text-gov-950 hover:bg-accent-300">Kembali ke Dashboard</button>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc,#eef5ff_48%,#fff8e1)] text-slate-900">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] w-72 overflow-y-auto bg-[linear-gradient(180deg,#071a33,#0B2C6A)] p-5 text-white shadow-[18px_0_60px_rgba(7,26,51,.22)] transition lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <b className="text-xl">Admin Tamansari</b>
            <p className="mt-1 text-xs font-bold uppercase tracking-[.18em] text-accent-200">{adminProfile.role === "admin" ? "ADMINISTRATOR - Kontrol Sistem" : roleLabel(adminProfile.role)}</p>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden">
            <X />
          </button>
        </div>
        <nav className="mt-8 space-y-2">
          {nav.filter(([, href, , adminOnly]) => adminProfile.role === "admin" || !adminOnly).map(([label, href, Icon]) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 font-bold",
                pathname === href || pathname.startsWith(`${href}/`)
                  ? "bg-accent-400 text-gov-950"
                  : "hover:bg-white/10",
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <button
            onClick={async () => {
              await logoutAdminPortal();
              router.push("/admin/login");
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 font-bold hover:bg-white/10"
          >
            <LogOut size={18} />
            Logout
          </button>
        </nav>
      </aside>
      <section className="p-4 lg:ml-72 lg:p-8">
        <header className="mb-6 flex items-center justify-between rounded-[2rem] bg-white p-4 shadow-soft">
          <button onClick={() => setOpen(true)} className="lg:hidden">
            <Menu />
          </button>
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-accent-700">
              Portal Admin Terpisah
            </p>
            <h1 className="text-2xl font-black text-gov-950">
              Dashboard Admin Kelurahan Tamansari
            </h1>
            <p className="mt-1 text-sm font-bold text-slate-500">Masuk sebagai {adminProfile.full_name ?? adminProfile.email ?? "Petugas"}</p>
          </div>
          <button
            onClick={load}
            className="rounded-2xl bg-gov-950 px-4 py-3 font-bold text-white"
          >
            <RefreshCw className="inline" size={16} /> Refresh
          </button>
        </header>
        {toast && (
          <div
            className={cn(
              "fixed right-5 top-5 z-[80] rounded-2xl px-5 py-3 font-bold text-white shadow-xl",
              toast.type === "error"
                ? "bg-red-600"
                : toast.type === "loading"
                  ? "bg-slate-700"
                  : "bg-emerald-600",
            )}
          >
            {toast.text}
          </div>
        )}
        {loading ? (
          <Panel title="Loading">Memuat data Supabase...</Panel>
        ) : view === "dashboard" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map(([l, v]) => (
                <div
                  key={l}
                  className="rounded-[2rem] bg-white p-5 shadow-soft"
                >
                  <p className="text-sm font-bold text-slate-500">{l}</p>
                  <b className="mt-3 block text-4xl text-gov-950">{v}</b>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Panel title="Grafik Pengajuan">
                <div className="flex h-64 items-end gap-2">
                  {cards.slice(0, 6).map(([l, v]) => (
                    <div
                      key={l}
                      className="flex-1 rounded-t-xl bg-gradient-to-t from-gov-950 to-accent-400"
                      style={{ height: `${Math.max(12, Number(v) * 12)}px` }}
                    />
                  ))}
                </div>
              </Panel>
              <Panel title="Pengajuan terbaru">
                {submissions.slice(0, 6).map((r) => (
                  <RowLine key={r.id} a={r.nama_lengkap} b={r.status} />
                ))}
              </Panel>
              <Panel title="Aktivitas terbaru">
                {submissions.slice(0, 6).map((r) => (
                  <RowLine
                    key={r.id}
                    a={r.nomor_pengajuan}
                    b={r.catatan_admin ?? "Update pengajuan"}
                  />
                ))}
              </Panel>
              <Panel title="Verifikasi Warga Menunggu">
                {pendingWarga.slice(0, 6).map((w) => (
                  <RowLine key={w.id} a={w.nama_lengkap ?? "Warga"} b={w.status_verifikasi ?? "Belum Terverifikasi"} />
                ))}
                {pendingWarga.length === 0 && <p className="font-bold text-slate-500">Tidak ada warga yang menunggu verifikasi.</p>}
              </Panel>
            </div>
          </>
        ) : view === "verifikasi" || view === "verifikasi-warga" ? (
          <Panel title="Verifikasi Warga">
            <div className="mb-5 rounded-[1.5rem] bg-[linear-gradient(135deg,#071a33,#0B2C6A)] p-5 text-white">
              <ShieldCheck className="size-8 text-accent-300" />
              <h2 className="mt-3 text-2xl font-black">Antrean Verifikasi Akun Warga</h2>
              <p className="mt-2 text-sm font-bold text-white/70">Data diambil dari public.warga_profiles dengan status_verifikasi &quot;Belum Terverifikasi&quot;. Aksi verifikasi akan mengubah status menjadi Terverifikasi dan memicu realtime di halaman warga.</p>
            </div>
            <WargaVerificationTable rows={pendingWarga} onVerify={verifyWarga} onReject={rejectWarga} />
          </Panel>
        ) : view === "pengajuan" ? (
          <Panel title="Pengajuan Surat">
            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <div className="rounded-2xl bg-slate-50 px-3 py-2 xl:col-span-2">
                <Search size={16} className="inline" />{" "}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama / NIK / nomor"
                  className="w-[calc(100%-28px)] bg-transparent outline-none"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-2xl bg-slate-50 p-3"
              >
                <option value="">Semua Status</option>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="rounded-2xl bg-slate-50 p-3"
              >
                <option value="">Semua Layanan</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="rounded-2xl bg-slate-50 p-3" aria-label="Tanggal mulai" />
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="rounded-2xl bg-slate-50 p-3" aria-label="Tanggal akhir" />
              <button
                onClick={exportCsv}
                className="rounded-2xl bg-accent-400 p-3 font-black text-gov-950"
              >
                <Download className="inline" size={16} /> Export CSV
              </button>
            </div>
            <Table
              rows={filtered}
              onDetail={(row) => router.push(`/admin/pengajuan/${row.id}`)}
              onVerify={setSelectedSubmission}
              onDelete={deleteSubmission}
              adminProfile={adminProfile}
            />
            {selectedSubmission && (
              <VerificationDialog
                row={selectedSubmission}
                onClose={() => setSelectedSubmission(null)}
                onApprove={(payload) => updateStatus(selectedSubmission, activeStage(selectedSubmission)?.tahap === 5 ? "selesai" : "proses_tahap", payload)}
                onRevise={(reason) => updateStatus(selectedSubmission, "revisi", { alasan_penolakan: reason, catatan_petugas: reason })}
                onReject={(reason) => updateStatus(selectedSubmission, "tolak", { alasan_penolakan: reason, catatan_petugas: reason })}
              />
            )}
          </Panel>
        ) : view === "detail" ? (
          detail ? (
            <SubmissionDetail
              row={detail}
              onVerify={setSelectedSubmission}
              onProcess={setSelectedSubmission}
              onComplete={(row) => updateStatus(row, "selesai", { catatan_petugas: "Pengajuan telah selesai dan dokumen dapat dicetak/diunduh." })}
              onReject={rejectSubmission}
              setToast={setToast}
              adminProfile={adminProfile}
            />
          ) : (
            <Panel title="Detail Pengajuan">Data tidak ditemukan</Panel>
          )
        ) : view === "layanan" ? (
          <Layanan
            services={services}
            reload={load}
            setToast={setToast}
          />
        ) : view === "tracking" ? (
          <TrackingModule rows={submissions} services={services} query={query} setQuery={setQuery} status={status} setStatus={setStatus} service={service} setService={setService} dateStart={dateStart} setDateStart={setDateStart} dateEnd={dateEnd} setDateEnd={setDateEnd} onRefresh={load} onDetail={(row) => router.push(`/admin/pengajuan/${row.id}`)} />
        ) : view === "posbankum" ? (
          <Placeholder title="POSBANKUM" text="Ruang administrasi bantuan hukum Kelurahan Tamansari." />
        ) : view === "berita" ? (
          <Placeholder title="Berita" text="Manajemen publikasi berita dan informasi resmi kelurahan." />
        ) : view === "pengguna" ? (
          <Pengguna rows={wargaProfiles} />
        ) : view === "laporan" ? (
          <Laporan submissions={submissions} wargaProfiles={wargaProfiles} />
        ) : (
          <Pengaturan />
        )}
        {rejectTarget && (
          <RejectDialog
            row={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onSave={(reason) => updateStatus(rejectTarget, "tolak", { alasan_penolakan: reason, catatan_petugas: reason })}
          />
        )}
      </section>
    </main>
  );
}

function workflowStageKey(row: Row) {
  if (isIssued(row)) return "Terbit";
  const current = normalizedWorkflowStatus(row);
  const labels: Record<string, string> = {
    MENUNGGU_STAFF: "Staff",
    MENUNGGU_PETUGAS_LAPANGAN: "Lapangan",
    MENUNGGU_KASI: "Kasi",
    MENUNGGU_SEKLUR: "Seklur",
    MENUNGGU_LURAH: "Lurah",
  };
  return labels[current] ?? stageShort(row);
}

function trackingStatusLabel(row: Row) {
  const current = normalizedWorkflowStatus(row);
  if (current === "SELESAI") return "Selesai";
  if (current === "DITOLAK" || normalizeStatus(row.status) === "Ditolak") return "Ditolak";
  if (current === "REVISI") return "Revisi";
  const stage = activeStage(row);
  if (stage?.status === "Diproses") return "Diproses";
  if (stage?.status === "Disetujui") return "Disetujui";
  return "Menunggu";
}

function TrackingModule({ rows, services, query, setQuery, status, setStatus, service, setService, dateStart, setDateStart, dateEnd, setDateEnd, onRefresh, onDetail }: { rows: Row[]; services: Row[]; query: string; setQuery: (v: string) => void; status: string; setStatus: (v: string) => void; service: string; setService: (v: string) => void; dateStart: string; setDateStart: (v: string) => void; dateEnd: string; setDateEnd: (v: string) => void; onRefresh: () => void; onDetail: (r: Row) => void }) {
  const filteredRows = rows
    .filter((r) => [r.nomor_pengajuan, r.nama_lengkap, r.nik, serviceName(r)].join(" ").toLowerCase().includes(query.toLowerCase()))
    .filter((r) => !status || trackingStatusLabel(r) === status)
    .filter((r) => !service || r.layanan_id === service)
    .filter((r) => !dateStart || String(r.created_at).slice(0, 10) >= dateStart)
    .filter((r) => !dateEnd || String(r.created_at).slice(0, 10) <= dateEnd);

  return (
    <div className="mx-auto max-w-[1160px] space-y-4">
      <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Tracking Pengajuan</p>
            <h1 className="mt-2 text-2xl font-black text-gov-950">Workflow Pengajuan Surat</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">Membaca data workflow existing dari Supabase tanpa membuat approval baru.</p>
          </div>
          <button onClick={onRefresh} className="rounded-2xl bg-gov-950 px-4 py-3 font-black text-white"><RefreshCw className="inline" size={16} /> Refresh</button>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl bg-slate-50 px-3 py-2 xl:col-span-2"><Search size={16} className="inline" /> <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor / nama / NIK" className="w-[calc(100%-28px)] bg-transparent font-bold outline-none" /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl bg-slate-50 p-3 font-bold"><option value="">Semua Status</option>{["Menunggu", "Diproses", "Disetujui", "Revisi", "Ditolak", "Selesai"].map((x) => <option key={x}>{x}</option>)}</select>
          <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-2xl bg-slate-50 p-3 font-bold"><option value="">Semua Layanan</option>{services.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="rounded-2xl bg-slate-50 p-3 font-bold" aria-label="Tanggal mulai" />
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="rounded-2xl bg-slate-50 p-3 font-bold" aria-label="Tanggal akhir" />
          <button onClick={() => { setQuery(""); setStatus(""); setService(""); setDateStart(""); setDateEnd(""); }} className="rounded-2xl bg-slate-100 p-3 font-black text-slate-700"><RotateCcw className="inline" size={16} /> Reset</button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.14em] text-slate-500"><tr><th className="px-4 py-4">Nomor</th><th className="px-4 py-4">Tanggal</th><th className="px-4 py-4">Pemohon</th><th className="px-4 py-4">Layanan</th><th className="px-4 py-4">Tahap</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((r) => <tr key={r.id} className="align-top"><td className="px-4 py-4 font-black text-gov-950">{r.nomor_pengajuan ?? "-"}</td><td className="px-4 py-4 font-bold text-slate-700">{formatDate(r.created_at)}</td><td className="px-4 py-4 font-black text-gov-950">{r.nama_lengkap ?? "-"}</td><td className="px-4 py-4 font-bold text-slate-700">{serviceName(r)}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{workflowStageKey(r)}</span></td><td className="px-4 py-4"><StatusBadge status={trackingStatusLabel(r)} /></td><td className="px-4 py-4"><button type="button" onClick={() => onDetail(r)} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-700 hover:bg-slate-200"><Eye className="inline" size={14} /> Detail</button></td></tr>)}
          </tbody>
        </table>
        {filteredRows.length === 0 && <p className="py-8 text-center font-bold text-slate-500">Tidak ada pengajuan sesuai filter.</p>}
      </div>
    </div>
  );
}

function Panel(p: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-soft">
      <h2 className="mb-4 text-xl font-black text-gov-950">{p.title}</h2>
      {p.children}
    </section>
  );
}
function RowLine({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex justify-between border-t py-3">
      <b>{a}</b>
      <span className="text-slate-500">{b}</span>
    </div>
  );
}
function Table({
  rows,
  onDetail,
  onVerify,
  onDelete,
  adminProfile,
}: {
  rows: Row[];
  onDetail: (r: Row) => void;
  onVerify: (r: Row) => void;
  onDelete: (r: Row) => void;
  adminProfile: AdminPortalProfile | null;
}) {
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100 bg-white">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.14em] text-slate-500">
          <tr><th className="px-4 py-4">Nomor</th><th className="px-4 py-4">Tanggal</th><th className="px-4 py-4">Pemohon</th><th className="px-4 py-4">Layanan</th><th className="px-4 py-4">Tahap</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Action</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 align-top">
              <td className="px-4 py-4 font-black text-gov-950">{r.nomor_pengajuan ?? "-"}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{formatDate(r.created_at)}</td>
              <td className="px-4 py-4"><p className="font-black text-gov-950">{r.nama_lengkap ?? "-"}</p></td>
              <td className="px-4 py-4 font-bold text-slate-700">{serviceName(r)}</td>
              <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{workflowStageKey(r)}</span></td>
              <td className="px-4 py-4"><StatusBadge status={trackingStatusLabel(r)} /></td>
              <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onDetail(r)} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-700 hover:bg-slate-200"><Eye className="inline" size={14} /> Detail</button>{canProcessStage(r, adminProfile) && <button type="button" onClick={() => onVerify(r)} className="rounded-xl bg-gov-950 px-3 py-2 font-black text-white hover:bg-gov-800"><ShieldCheck className="inline" size={14} /> Verifikasi</button>}{adminProfile?.role === "admin" && <button type="button" onClick={() => onDelete(r)} className="rounded-xl bg-red-600 px-3 py-2 font-black text-white hover:bg-red-700"><Trash2 className="inline" size={14} /> Hapus</button>}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-8 text-center font-bold text-slate-500">Belum ada data.</p>}
    </div>
  );
}

function VerificationDialog({
  row,
  onClose,
  onApprove,
  onRevise,
  onReject,
}: {
  row: Row;
  onClose: () => void;
  onApprove: (payload: { catatan_petugas?: string; hasil_verifikasi?: string; dokumentasi_url?: string; checklist?: Record<string, boolean> }) => void;
  onRevise: (reason: string) => void;
  onReject: (reason: string) => void;
}) {
  const stage = activeStage(row);
  const tahap = Number(stage?.tahap ?? 1);
  const [catatan, setCatatan] = useState(tahap === 5 ? "Surat divalidasi dan diterbitkan oleh Lurah." : `Berkas pengajuan ${row.nomor_pengajuan ?? ""} telah diverifikasi.`.trim());
  const [reason, setReason] = useState("");
  const [hasil, setHasil] = useState("Sesuai");
  const [dokumentasi, setDokumentasi] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const title = tahap === 1 ? "VERIFIKASI STAFF PELAYANAN" : tahap === 2 ? "VERIFIKASI LAPANGAN" : tahap === 3 ? "VERIFIKASI KASI" : tahap === 4 ? "VERIFIKASI ADMINISTRASI SEKLUR" : "VALIDASI AKHIR LURAH";
  const checks = tahap === 1 ? ["Data pemohon sesuai", "NIK sesuai", "Dokumen lengkap", "Persyaratan sesuai layanan"] : tahap === 4 ? ["Data benar", "Dokumen lengkap", "Hasil verifikasi lapangan sesuai", "Rekomendasi Kasi sesuai", "Surat siap diajukan kepada Lurah"] : [];
  const approve = () => {
    if (tahap === 5 && !window.confirm("Apakah Anda yakin ingin memvalidasi dan menerbitkan surat ini?\n\nSetelah diterbitkan, surat akan menjadi dokumen resmi dan tercatat dalam audit trail.")) return;
    onApprove({ catatan_petugas: catatan.trim(), hasil_verifikasi: tahap === 2 ? hasil : undefined, dokumentasi_url: dokumentasi.trim() || undefined, checklist });
  };
  const rejectOrRevise = (kind: "revisi" | "tolak") => {
    const trimmed = reason.trim();
    if (!trimmed) return window.alert("Catatan/alasan wajib diisi untuk revisi atau penolakan.");
    return kind === "revisi" ? onRevise(trimmed) : onReject(trimmed);
  };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/40 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-accent-700">{roleLabel(stage?.role_petugas)}</p>
            <h3 className="mt-2 text-2xl font-black text-gov-950">{title}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.nama_lengkap ?? "Pemohon"} • {serviceName(row)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200" aria-label="Tutup dialog"><X size={18} /></button>
        </div>
        <div className="mt-5"><WorkflowStepper row={row} /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><DetailField label="Nomor Pengajuan" value={row.nomor_pengajuan} /><DetailField label="Tanggal Pengajuan" value={formatDate(row.created_at)} /><DetailField label="Nama Pemohon" value={row.nama_lengkap} /><DetailField label="NIK" value={row.nik} /><DetailField label="Nomor HP" value={row.nomor_hp ?? row.no_hp} /><DetailField label="Jenis Layanan" value={serviceName(row)} /><DetailField label="Keperluan" value={row.keperluan ?? row.keterangan} /><DetailField label="Alamat" value={row.alamat} /></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2"><DocumentsPanel row={row} /><VerificationHistory row={row} /></div>
        {tahap === 2 && <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="font-black text-gov-950">Hasil Verifikasi Lapangan</p><div className="mt-3 flex flex-wrap gap-3">{["Sesuai", "Tidak Sesuai", "Perlu Perbaikan"].map((item) => <label key={item} className="rounded-xl bg-white px-3 py-2 font-bold"><input type="radio" checked={hasil === item} onChange={() => setHasil(item)} /> {item}</label>)}</div><input value={dokumentasi} onChange={(e) => setDokumentasi(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-3 font-semibold" placeholder="URL dokumentasi/foto lapangan jika ada" /></div>}
        {checks.length > 0 && <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="font-black text-gov-950">Checklist Verifikasi</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{checks.map((item) => <label key={item} className="rounded-xl bg-white px-3 py-2 font-bold"><input type="checkbox" checked={Boolean(checklist[item])} onChange={(e) => setChecklist((prev) => ({ ...prev, [item]: e.target.checked }))} /> {item}</label>)}</div></div>}
        {tahap === 5 && <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="font-black text-emerald-800">PREVIEW SURAT</p><p className="mt-2 text-sm font-bold text-emerald-700">Surat untuk {row.nama_lengkap ?? "pemohon"} dengan layanan {serviceName(row)} akan diterbitkan, diberi nomor surat, QR Code, token verifikasi, dan PDF resmi.</p></div>}
        <label className="mt-5 block text-sm font-black text-gov-950">
          {tahap === 2 ? "Catatan Lapangan" : tahap === 3 ? "Catatan / Rekomendasi Kasi" : tahap === 4 ? "Catatan Seklur" : tahap === 5 ? "Catatan Validasi Lurah" : "Catatan Verifikasi"}
          <textarea
            value={catatan}
            onChange={(event) => setCatatan(event.target.value)}
            className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none focus:border-accent-400 focus:bg-white"
            placeholder="Tambahkan catatan verifikasi..."
          />
        </label>
        <label className="mt-4 block text-sm font-black text-gov-950">Catatan untuk Kembalikan/Tolak<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none focus:border-red-400 focus:bg-white" placeholder="Wajib diisi jika memilih revisi atau tolak" /></label>
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:justify-end">
          <button type="button" onClick={() => rejectOrRevise("revisi")} className="rounded-2xl bg-amber-500 px-5 py-3 font-black text-white hover:bg-amber-600"><RotateCcw className="inline" size={16} /> KEMBALIKAN / REVISI</button>
          <button type="button" onClick={() => rejectOrRevise("tolak")} className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700"><XCircle className="inline" size={16} /> TOLAK</button>
          <button type="button" onClick={approve} className={cn("rounded-2xl px-5 py-3 font-black text-white", tahap === 5 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gov-950 hover:bg-gov-800")}><ShieldCheck className="inline" size={16} /> {tahap === 5 ? "VALIDASI & TERBITKAN SURAT" : tahap === 4 ? "SETUJUI & AJUKAN KE LURAH" : tahap === 2 ? "VERIFIKASI LAPANGAN & LANJUTKAN" : "VERIFIKASI & LANJUTKAN"}</button>
        </div>
      </div>
    </div>
  );
}
function Info({ row }: { row: Row }) {
  return (
    <div className="grid gap-2">
      {Object.entries(row)
        .filter(([, v]) => typeof v !== "object")
        .map(([k, v]) => (
          <p key={k} className="rounded-xl bg-slate-50 p-3">
            <b>{k}:</b> {String(v ?? "-")}
          </p>
        ))}
    </div>
  );
}
function Upload({
  id,
  setToast,
}: {
  id: string;
  setToast: (t: Toast) => void;
}) {
  const up = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      const formData = new FormData();
      formData.set("pengajuan_id", id);
      formData.set("file", f);
      const response = await fetch("/api/admin/dokumen", { method: "POST", credentials: "include", body: formData });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error ?? "Dokumen gagal diupload");
      setToast({ type: "success", text: "Dokumen berhasil diupload" });
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "Dokumen gagal diupload" });
    }
  };
  return (
    <label className="mt-6 block rounded-2xl border-2 border-dashed p-6 font-bold">
      Upload PDF/DOCX/JPG/PNG
      <input
        type="file"
        accept=".pdf,.docx,.jpg,.jpeg,.png"
        onChange={up}
        className="mt-3 block"
      />
    </label>
  );
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-gov-950">{String(value ?? "-") || "-"}</p>
    </div>
  );
}

function DetailCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-gov-950 text-accent-300 shadow-lg shadow-gov-950/15">
          <Icon size={20} />
        </span>
        <h2 className="text-lg font-black text-gov-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SubmissionTimeline({ row }: { row: Row }) {
  const stages = verificationStages(row);
  const current = normalizeStatus(row.status);
  const rejected = current === "Ditolak";

  return (
    <DetailCard icon={CalendarClock} title="Timeline Verifikasi Berjenjang">
      <div className="space-y-3">
        {stages.map((stage: Row) => {
          const done = stage.status === "Disetujui";
          const active = ["Menunggu", "Diproses"].includes(String(stage.status)) && !rejected;
          const declined = stage.status === "Ditolak";
          return (
            <div key={stage.id ?? stage.tahap} className={cn("grid gap-4 rounded-2xl border p-4 sm:grid-cols-[auto_1fr]", done ? "border-emerald-200 bg-emerald-50" : declined ? "border-red-200 bg-red-50" : active ? "border-accent-200 bg-accent-50" : "border-slate-100 bg-slate-50")}>
              <span className={cn("grid size-11 place-items-center rounded-full text-lg font-black", done ? "bg-emerald-500 text-white" : declined ? "bg-red-600 text-white" : active ? "bg-accent-400 text-gov-950" : "bg-white text-slate-400")}>{done ? "✓" : declined ? "×" : active ? "●" : "○"}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-gov-950">{stage.nama_tahap}</p>
                  <StatusBadge status={stage.status} />
                </div>
                <p className="mt-1 text-sm font-bold text-slate-600">Petugas: {officerName(stage)}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Waktu: {stage.acted_at ? new Date(stage.acted_at).toLocaleString("id-ID") : "Menunggu tindakan"}</p>
                {stage.catatan && <p className="mt-2 rounded-xl bg-white/70 p-3 text-sm font-bold text-slate-700">Catatan: {stage.catatan}</p>}
              </div>
            </div>
          );
        })}
        <div className={cn("grid gap-4 rounded-2xl border p-4 sm:grid-cols-[auto_1fr]", current === "Selesai" ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50")}>
          <span className={cn("grid size-11 place-items-center rounded-full text-lg font-black", current === "Selesai" ? "bg-emerald-500 text-white" : "bg-white text-slate-400")}>{current === "Selesai" ? "✓" : "○"}</span>
          <div><p className="font-black text-gov-950">Selesai</p><p className="mt-1 text-sm font-bold text-slate-600">Dokumen final telah diproses.</p></div>
        </div>
      </div>
      {rejected && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800">
          <p className="font-black"><AlertTriangle className="inline" size={18} /> Pengajuan Ditolak</p>
          <p className="mt-1 text-sm font-bold">{row.alasan_penolakan ?? row.catatan_admin ?? "Alasan penolakan belum tersedia."}</p>
        </div>
      )}
    </DetailCard>
  );
}

function ActivityHistory({ rows }: { rows: Row[] }) {
  return (
    <DetailCard icon={History} title="Riwayat Aktivitas">
      <div className="space-y-3">
        {rows.map((item, index) => (
          <div key={item.id ?? `${item.status}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <span className="mt-1 size-3 rounded-full bg-accent-400 ring-4 ring-accent-100" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="text-xs font-black text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleString("id-ID") : "-"}</span>
              </div>
              <p className="mt-2 font-black text-gov-950">{item.keterangan ?? "Perubahan status pengajuan"}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">Petugas: {item.nama_petugas ?? item.petugas?.nama_lengkap ?? item.petugas_nama ?? "Petugas Kelurahan"}</p>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 font-bold text-slate-500">Belum ada riwayat aktivitas pada tabel tracking_pengajuan.</p>}
      </div>
    </DetailCard>
  );
}

function VerificationHistory({ row }: { row: Row }) {
  return (
    <DetailCard icon={History} title="RIWAYAT VERIFIKASI">
      <div className="space-y-3">
        {stepDefinitions.slice(0, 5).map((step) => {
          const stage = stageByNumber(row, step.tahap);
          const state = stepState(row, step.tahap);
          const time = stage?.approved_at ?? stage?.acted_at ?? stage?.updated_at;
          return (
            <div key={step.tahap} className={cn("rounded-2xl border p-4", state === "done" ? "border-emerald-100 bg-emerald-50" : state === "active" ? "border-accent-200 bg-accent-50" : state === "rejected" ? "border-red-100 bg-red-50" : "border-slate-100 bg-slate-50")}>
              <p className="font-black text-gov-950">{state === "done" ? "✓" : state === "active" ? "●" : state === "rejected" ? "×" : "○"} {step.label}</p>
              <p className="mt-1 text-sm font-black text-slate-700">{state === "active" ? "Menunggu validasi" : officerName(stage)}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{time ? new Date(time).toLocaleString("id-ID") : "Belum ada tindakan"}</p>
              <p className="mt-1 text-sm font-bold text-slate-600">{stage?.status ?? (state === "active" ? "Menunggu" : "Belum diproses")}</p>
              {stage?.catatan && <p className="mt-2 rounded-xl bg-white/80 p-3 text-sm font-bold text-slate-700">Catatan: {stage.catatan}</p>}
            </div>
          );
        })}
      </div>
    </DetailCard>
  );
}

function DocumentsPanel({ row }: { row: Row }) {
  const docs = Array.isArray(row.dokumen_pengajuan) ? row.dokumen_pengajuan : [];
  return (
    <DetailCard icon={FileArchive} title="Dokumen Pendukung">
      <div className="space-y-3">
        {docs.map((doc: Row, index: number) => {
          const url = fileUrl(doc);
          return (
            <div key={doc.id ?? index} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-black text-gov-950">{doc.nama_file ?? doc.nama_dokumen ?? doc.jenis ?? `Dokumen ${index + 1}`}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[.14em] text-slate-400">{doc.jenis ?? doc.tipe ?? "Dokumen Pengajuan"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={url || "#"} target="_blank" rel="noreferrer" className={cn("rounded-xl px-4 py-2 text-sm font-black", url ? "bg-white text-gov-950 shadow-sm hover:bg-accent-100" : "pointer-events-none bg-slate-200 text-slate-400")}><Eye className="inline" size={15} /> Lihat</a>
                <a href={url || "#"} download className={cn("rounded-xl px-4 py-2 text-sm font-black", url ? "bg-gov-950 text-white hover:bg-gov-800" : "pointer-events-none bg-slate-200 text-slate-400")}><Download className="inline" size={15} /> Download</a>
              </div>
            </div>
          );
        })}
        {docs.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 font-bold text-slate-500">Belum ada dokumen pada tabel dokumen_pengajuan.</p>}
      </div>
    </DetailCard>
  );
}


function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-black uppercase tracking-[.16em] text-gov-950">{title}</h2>{children}</section>;
}

function SimpleTable({ children, minWidth = "620px" }: { children: React.ReactNode; minWidth?: string }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full text-sm" style={{ minWidth }}><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>;
}

function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={cn("px-4 py-3 align-top", strong ? "w-48 bg-slate-50 font-black text-gov-950" : "font-bold text-slate-700")}>{children}</td>;
}

function stageTableStatus(row: Row, tahap: number) {
  const state = stepState(row, tahap);
  if (state === "done") return "✓ Disetujui";
  if (state === "active") return "● Menunggu";
  if (state === "rejected") return "× Ditolak";
  return "○ Belum";
}

function SubmissionDetail({
  row,
  onVerify,
  onProcess,
  onComplete,
  onReject,
  setToast,
  adminProfile,
}: {
  row: Row;
  onVerify: (row: Row) => void;
  onProcess: (row: Row) => void;
  onComplete: (row: Row) => void;
  onReject: (row: Row) => void;
  setToast: (t: Toast) => void;
  adminProfile: AdminPortalProfile | null;
}) {
  const docs = Array.isArray(row.dokumen_pengajuan) ? row.dokumen_pengajuan : [];
  const generatedPdfUrl = row.verification_token ? `/api/surat/${row.verification_token}/pdf` : "";
  const verifyUrl = row.verification_token ? `/verifikasi/${row.verification_token}` : "";
  const active = activeStage(row);
  const stageRows = stepDefinitions.slice(0, 5).map((step) => {
    const stage = stageByNumber(row, step.tahap);
    return { step, stage };
  });
  const notes = stageRows.filter(({ stage }) => stage?.catatan);
  const canAct = canProcessStage(row, adminProfile);

  const primaryLabel = active?.role_petugas === "lurah" ? "✓ VALIDASI & TERBITKAN" : active?.role_petugas === "seklur" ? "✓ AJUKAN KE LURAH" : active?.role_petugas === "kepala_seksi" ? "✓ SETUJUI" : active?.role_petugas === "petugas_lapangan" ? "✓ VERIFIKASI LAPANGAN" : "✓ VERIFIKASI";

  return (
    <div className="mx-auto max-w-[1160px] space-y-4">
      <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.2em] text-slate-500">PENGAJUAN SURAT</p>
        <h1 className="mt-2 text-2xl font-black text-gov-950">{row.nomor_pengajuan ?? "-"}</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">Jenis layanan</p>
            <p className="mt-1 font-black text-gov-950">{serviceName(row)}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">Status</p>
            <p className={cn("mt-1 inline-flex rounded-full px-3 py-1 text-xs font-black ring-1", statusBadgeClass(workflowStatusDisplay(row)))}>{workflowStatusDisplay(row)}</p>
          </div>
        </div>
      </section>

      <WorkflowStepper row={row} />

      <SectionBox title="DATA PEMOHON">
        <SimpleTable minWidth="640px">
          <tr><Td strong>Nama</Td><Td>{row.nama_lengkap ?? "-"}</Td></tr>
          <tr><Td strong>NIK</Td><Td>{row.nik ?? "-"}</Td></tr>
          <tr><Td strong>No. HP</Td><Td>{row.nomor_hp ?? row.no_hp ?? "-"}</Td></tr>
          <tr><Td strong>Alamat</Td><Td>{row.alamat ?? "-"}</Td></tr>
          <tr><Td strong>Layanan</Td><Td>{serviceName(row)}</Td></tr>
          <tr><Td strong>Tanggal Pengajuan</Td><Td>{formatDate(row.created_at)}</Td></tr>
        </SimpleTable>
      </SectionBox>

      <SectionBox title="DOKUMEN PERSYARATAN">
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Dokumen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((doc: Row, index: number) => {
                const url = fileUrl(doc);
                return (
                  <tr key={doc.id ?? index}>
                    <td className="px-4 py-3 font-black text-gov-950">{doc.nama_file ?? doc.nama_dokumen ?? doc.jenis ?? `Dokumen ${index + 1}`}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">✓ Ada</td>
                    <td className="px-4 py-3">
                      <a href={url || "#"} target="_blank" rel="noreferrer" className={cn("rounded-xl px-3 py-2 text-sm font-black", url ? "bg-slate-100 text-gov-950 hover:bg-slate-200" : "pointer-events-none bg-slate-100 text-slate-400")}>Lihat</a>
                    </td>
                  </tr>
                );
              })}
              {docs.length === 0 && <tr><td className="px-4 py-3 font-bold text-slate-500" colSpan={3}>Belum ada dokumen.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionBox>

      <SectionBox title="VERIFIKASI BERJENJANG">
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Tahap</th>
                <th className="px-4 py-3">Petugas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stageRows.map(({ step, stage }) => {
                const time = stage?.approved_at ?? stage?.acted_at ?? stage?.updated_at;
                return (
                  <tr key={step.tahap}>
                    <td className="px-4 py-3 font-black text-gov-950">{step.label}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{tableOfficerName(stage)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{stageTableStatus(row, step.tahap)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{formatDateTime(time)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionBox>

      {notes.length > 0 && (
        <SectionBox title="CATATAN">
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tahap</th>
                  <th className="px-4 py-3">Petugas</th>
                  <th className="px-4 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notes.map(({ step, stage }) => (
                  <tr key={step.tahap}>
                    <td className="px-4 py-3 font-black text-gov-950">{step.short}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{tableOfficerName(stage)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{stage?.catatan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionBox>
      )}

      <SectionBox title="ACTION">
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
          {isIssued(row) ? (
            <>
              <a href={generatedPdfUrl || "#"} target="_blank" rel="noreferrer" className={cn("rounded-2xl px-5 py-3 text-center font-black", generatedPdfUrl ? "bg-gov-950 text-white" : "pointer-events-none bg-slate-200 text-slate-400")}>📄 LIHAT SURAT</a>
              <a href={generatedPdfUrl || "#"} download className={cn("rounded-2xl px-5 py-3 text-center font-black", generatedPdfUrl ? "bg-accent-400 text-gov-950" : "pointer-events-none bg-slate-200 text-slate-400")}>⬇ DOWNLOAD PDF</a>
              <a href={verifyUrl || "#"} target="_blank" rel="noreferrer" className={cn("rounded-2xl px-5 py-3 text-center font-black", verifyUrl ? "bg-emerald-600 text-white" : "pointer-events-none bg-slate-200 text-slate-400")}>🔳 VERIFIKASI QR</a>
            </>
          ) : canAct ? (
            <>
              <button type="button" onClick={() => onProcess(row)} className="rounded-2xl bg-amber-500 px-5 py-3 font-black text-white">KEMBALIKAN</button>
              <button type="button" onClick={() => onReject(row)} className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white">TOLAK</button>
              <button type="button" onClick={() => onVerify(row)} className="rounded-2xl bg-gov-950 px-5 py-3 font-black text-white">{primaryLabel}</button>
            </>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 font-black text-slate-600">{accessLabel(row, adminProfile)}</p>
          )}
        </div>
      </SectionBox>
    </div>
  );
}

function RejectDialog({ row, onClose, onSave }: { row: Row; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Alasan penolakan wajib diisi sebelum status dapat disimpan.");
      return;
    }
    onSave(trimmed);
  };
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/40 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-red-600">Tolak Pengajuan</p>
            <h3 className="mt-2 text-2xl font-black text-gov-950">{row.nomor_pengajuan ?? "Pengajuan"}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">Alasan akan disimpan ke kolom alasan_penolakan dan dicatat pada tracking_pengajuan.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200" aria-label="Tutup modal"><X size={18} /></button>
        </div>
        <label className="mt-5 block text-sm font-black text-gov-950">
          Alasan Penolakan <span className="text-red-600">*</span>
          <textarea value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} className="mt-2 min-h-36 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none focus:border-red-400 focus:bg-white" placeholder="Contoh: Dokumen KTP tidak terbaca / persyaratan belum lengkap..." />
        </label>
        {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle className="inline" size={16} /> {error}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-5 py-3 font-black text-slate-700 hover:bg-slate-200">Batal</button>
          <button type="button" onClick={submit} className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700"><XCircle className="inline" size={16} /> Simpan Penolakan</button>
        </div>
      </div>
    </div>
  );
}
function Layanan({
  services,
  reload,
  setToast,
}: {
  services: Row[];
  reload: () => void;
  setToast: (t: Toast) => void;
}) {
  const [name, setName] = useState("");
  const save = async () => {
    try {
      const response = await fetch("/api/admin/layanan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nama: name, aktif: true }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error ?? "Layanan gagal tersimpan");
      setToast({ type: "success", text: "Layanan tersimpan" });
      setName("");
      reload();
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "Layanan gagal tersimpan" });
    }
  };
  return (
    <Panel title="CRUD Layanan">
      <div className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-2xl bg-slate-50 p-3"
          placeholder="Nama layanan"
        />
        <button
          onClick={save}
          className="rounded-2xl bg-gov-950 px-5 text-white"
        >
          Tambah
        </button>
      </div>
      {services.map((s) => (
        <RowLine
          key={s.id}
          a={s.nama}
          b={s.aktif === false ? "Nonaktif" : "Aktif"}
        />
      ))}
    </Panel>
  );
}
function Pengguna({ rows }: { rows: PendingWarga[] }) {
  return (
    <Panel title="Manajemen Pengguna">
      <div className="grid gap-3 md:grid-cols-3">
        {rows.slice(0, 12).map((row) => (
          <div key={row.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <p className="font-black text-gov-950">{row.nama_lengkap ?? "Warga"}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.email ?? row.nik ?? "-"}</p>
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">
              {row.status_verifikasi ?? "Belum Terverifikasi"}
            </span>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="font-bold text-slate-500">Belum ada data pengguna.</p>}
    </Panel>
  );
}
function Laporan({ submissions, wargaProfiles }: { submissions: Row[]; wargaProfiles: PendingWarga[] }) {
  return (
    <Panel title="Laporan Pelayanan Digital">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard label="Total Warga" value={wargaProfiles.length} />
        <ReportCard label="Total Pengajuan" value={submissions.length} />
        <ReportCard label="Selesai" value={submissions.filter((r) => r.status === "Selesai").length} />
        <ReportCard label="Ditolak" value={submissions.filter((r) => r.status === "Ditolak").length} />
      </div>
      <p className="mt-5 rounded-[1.5rem] bg-slate-50 p-5 font-bold leading-7 text-slate-600">
        Modul laporan siap dikembangkan menjadi export PDF/CSV rekap warga, pengajuan surat, POSBANKUM, dan performa pelayanan petugas.
      </p>
    </Panel>
  );
}
function ReportCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#071a33,#0B2C6A)] p-5 text-white shadow-soft">
      <p className="text-xs font-black uppercase tracking-[.18em] text-accent-200">{label}</p>
      <b className="mt-3 block text-4xl">{value}</b>
    </div>
  );
}
function WargaVerificationTable({
  rows,
  onVerify,
  onReject,
}: {
  rows: PendingWarga[];
  onVerify: (row: PendingWarga) => void;
  onReject: (row: PendingWarga) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.14em] text-slate-500">
          <tr>
            <th className="px-4 py-4">Nama</th>
            <th className="px-4 py-4">NIK</th>
            <th className="px-4 py-4">Email</th>
            <th className="px-4 py-4">Tanggal Daftar</th>
            <th className="px-4 py-4">Status</th>
            <th className="px-4 py-4">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 align-top">
              <td className="px-4 py-4 font-black text-gov-950">{row.nama_lengkap ?? "-"}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{row.nik ?? "-"}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{row.email ?? "-"}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{row.created_at ? new Date(row.created_at).toLocaleDateString("id-ID") : "-"}</td>
              <td className="px-4 py-4">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                  {row.status_verifikasi ?? "Belum Terverifikasi"}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onVerify(row)} className="rounded-xl bg-emerald-600 px-4 py-2 font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700">
                    Verifikasi
                  </button>
                  <button onClick={() => onReject(row)} className="rounded-xl bg-red-600 px-4 py-2 font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-700">
                    Tolak
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-10 text-center">
          <ShieldCheck className="mx-auto size-10 text-emerald-500" />
          <p className="mt-3 text-lg font-black text-gov-950">Tidak ada antrean verifikasi.</p>
          <p className="mt-1 font-bold text-slate-500">Semua warga yang masuk antrean sudah diproses.</p>
        </div>
      )}
    </div>
  );
}
function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <Panel title={title}>
      <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#071a33,#0B2C6A)] p-8 text-white">
        <p className="text-xs font-black uppercase tracking-[.18em] text-accent-200">Modul Admin</p>
        <h2 className="mt-3 text-3xl font-black">{title}</h2>
        <p className="mt-3 max-w-2xl font-bold leading-7 text-white/70">{text}</p>
      </div>
    </Panel>
  );
}
function Pengaturan() {
  return (
    <Panel title="Pengaturan Kelurahan">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          "Nama Kelurahan",
          "Alamat",
          "No Telp",
          "Email",
          "Logo",
          "Jam Operasional",
        ].map((x) => (
          <input
            key={x}
            placeholder={x}
            className="rounded-2xl bg-slate-50 p-3"
          />
        ))}
        <button className="rounded-2xl bg-gov-950 p-3 font-bold text-white">
          Simpan Pengaturan
        </button>
      </div>
    </Panel>
  );
}
