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
  Scale,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
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
  if (value === "Sedang Diproses") return "Diproses";
  return value;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function canProcessStage(row: Row, profile?: AdminPortalProfile | null) {
  const stage = activeStage(row);
  const role = profile?.role;
  return Boolean(stage && role === stage.role_petugas && workflowRoles.includes(role as typeof workflowRoles[number]));
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
  if (normalized === "Selesai") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (normalized === "Disetujui") return "bg-cyan-100 text-cyan-800 ring-cyan-200";
  if (normalized === "Diproses") return "bg-blue-100 text-blue-800 ring-blue-200";
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
  ["Dashboard", "/admin/dashboard", LayoutDashboard],
  ["Verifikasi Warga", "/admin/verifikasi", BadgeCheck],
  ["Pengajuan Surat", "/admin/pengajuan", FileText],
  ["Tracking", "/admin/tracking", FileClock],
  ["POSBANKUM", "/admin/posbankum", Scale],
  ["Berita", "/admin/berita", Newspaper],
  ["Master Layanan", "/admin/layanan", Settings],
  ["Petugas", "/admin/petugas", UserCog],
  ["Pengguna", "/admin/pengguna", Users],
  ["Laporan", "/admin/laporan", LineChart],
  ["Pengaturan", "/admin/pengaturan", Settings],
] as const;

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
  const updateStatus = async (row: Row, action: "proses_tahap" | "verifikasi" | "setujui" | "selesai" | "tolak", extra?: { catatan_petugas?: string; alasan_penolakan?: string }) => {
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
      setToast({ type: "success", text: action === "tolak" ? "Pengajuan berhasil ditolak." : action === "selesai" ? "Pengajuan berhasil diselesaikan." : "Tahap verifikasi berhasil diproses." });
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
      "Nomor Pengajuan,Tanggal,Nama Pemohon,NIK,Jenis Layanan,Status,Tahap Saat Ini,Petugas Saat Ini",
      ...filtered.map((r) =>
        [
          r.nomor_pengajuan,
          formatDate(r.created_at),
          r.nama_lengkap,
          r.nik,
          serviceName(r),
          normalizeStatus(r.status),
          activeStage(r)?.nama_tahap ?? (normalizeStatus(r.status) === "Selesai" ? "Selesai" : "-"),
          officerName(activeStage(r)),
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
          {nav.map(([label, href, Icon]) => (
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
          <Panel title="Data Pengajuan">
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
              onReject={rejectSubmission}
              adminProfile={adminProfile}
            />
            {selectedSubmission && (
              <VerificationDialog
                row={selectedSubmission}
                onClose={() => setSelectedSubmission(null)}
                onSave={(catatan) => updateStatus(selectedSubmission, "proses_tahap", { catatan_petugas: catatan })}
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
          <Placeholder title="Tracking" text="Panel monitoring perjalanan status pengajuan surat warga secara realtime." />
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
  adminProfile,
  onReject,
}: {
  rows: Row[];
  onDetail: (r: Row) => void;
  onVerify: (r: Row) => void;
  adminProfile: AdminPortalProfile | null;
  onReject: (r: Row) => void;
}) {
  return (
    <div>
      <div className="hidden overflow-x-auto rounded-[1.5rem] border border-slate-100 lg:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Nomor</th>
              <th>Tanggal</th>
              <th>Tahap Saat Ini</th>
              <th>Petugas Saat Ini</th>
              <th>Nama</th>
              <th>NIK</th>
              <th>Layanan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td>
                  <Link
                    className="font-black text-gov-950"
                    href={`/admin/pengajuan/${r.id}`}
                  >
                    {r.nomor_pengajuan}
                  </Link>
                </td>
                <td>{formatDate(r.created_at)}</td>
                <td className="min-w-52">
                  <p className="font-black text-gov-950">{activeStage(r)?.nama_tahap ?? (normalizeStatus(r.status) === "Selesai" ? "Selesai" : "Tidak ada tahap aktif")}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{roleLabel(activeStage(r)?.role_petugas)}</p>
                </td>
                <td>{officerName(activeStage(r))}</td>
                <td>{r.nama_lengkap}</td>
                <td>{r.nik}</td>
                <td>{serviceName(r)}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onDetail(r)} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-700 hover:bg-slate-200"><Eye className="inline" size={14} /> Detail</button>
                    {canProcessStage(r, adminProfile) ? (
                      <>
                        <button type="button" onClick={() => onVerify(r)} className="rounded-xl bg-gov-950 px-3 py-2 font-black text-white hover:bg-gov-800"><ShieldCheck className="inline" size={14} /> {activeStage(r)?.tahap === 5 ? "Setujui" : "Proses Tahap Ini"}</button>
                        <button type="button" onClick={() => onReject(r)} className="rounded-xl bg-red-600 px-3 py-2 font-black text-white hover:bg-red-700"><XCircle className="inline" size={14} /> Tolak</button>
                      </>
                    ) : (
                      <span className={cn("rounded-xl px-3 py-2 text-xs font-black", adminProfile?.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700")}>{accessLabel(r, adminProfile)}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black text-gov-950">{r.nomor_pengajuan}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{formatDate(r.created_at)} - {r.nama_lengkap}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600">
              <p><b className="text-gov-950">Tahap:</b> {activeStage(r)?.nama_tahap ?? (normalizeStatus(r.status) === "Selesai" ? "Selesai" : "Tidak ada tahap aktif")}</p>
              <p><b className="text-gov-950">Petugas:</b> {officerName(activeStage(r))}</p>
              <p><b className="text-gov-950">NIK:</b> {r.nik}</p>
              <p><b className="text-gov-950">Layanan:</b> {serviceName(r)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onDetail(r)} className="rounded-xl bg-white px-3 py-2 font-black text-slate-700 shadow-sm"><Eye className="inline" size={14} /> Detail</button>
              {canProcessStage(r, adminProfile) ? (
                <>
                  <button type="button" onClick={() => onVerify(r)} className="rounded-xl bg-gov-950 px-3 py-2 font-black text-white"><ShieldCheck className="inline" size={14} /> {activeStage(r)?.tahap === 5 ? "Setujui" : "Proses"}</button>
                  <button type="button" onClick={() => onReject(r)} className="rounded-xl bg-red-600 px-3 py-2 font-black text-white"><XCircle className="inline" size={14} /> Tolak</button>
                </>
              ) : (
                <span className={cn("rounded-xl px-3 py-2 text-xs font-black", adminProfile?.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700")}>{accessLabel(r, adminProfile)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="py-8 text-center">Belum ada data.</p>}
    </div>
  );
}

function VerificationDialog({
  row,
  onClose,
  onSave,
}: {
  row: Row;
  onClose: () => void;
  onSave: (catatan: string) => void;
}) {
  const [catatan, setCatatan] = useState(`Berkas pengajuan ${row.nomor_pengajuan ?? ""} telah diverifikasi petugas.`.trim());
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/40 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-accent-700">Verifikasi Berkas</p>
            <h3 className="mt-2 text-2xl font-black text-gov-950">{row.nomor_pengajuan ?? "Pengajuan"}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.nama_lengkap ?? "Pemohon"} • {serviceName(row)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200" aria-label="Tutup dialog"><X size={18} /></button>
        </div>
        <label className="mt-5 block text-sm font-black text-gov-950">
          Catatan petugas
          <textarea
            value={catatan}
            onChange={(event) => setCatatan(event.target.value)}
            className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none focus:border-accent-400 focus:bg-white"
            placeholder="Tambahkan catatan verifikasi..."
          />
        </label>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-5 py-3 font-black text-slate-700 hover:bg-slate-200">Batal</button>
          <button type="button" onClick={() => onSave(catatan.trim() || "Berkas telah diverifikasi petugas.")} className="rounded-2xl bg-accent-400 px-5 py-3 font-black text-gov-950 hover:bg-accent-300"><ShieldCheck className="inline" size={16} /> Simpan Verifikasi</button>
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
  const current = normalizeStatus(row.status);
  const trackingRows = Array.isArray(row.tracking_pengajuan) ? row.tracking_pengajuan : [];
  const outputDoc = (Array.isArray(row.dokumen_pengajuan) ? row.dokumen_pengajuan : []).find((doc: Row) => String(doc.jenis ?? "").toLowerCase().includes("hasil") || String(doc.nama_file ?? "").toLowerCase().includes("surat"));
  const outputUrl = outputDoc ? fileUrl(outputDoc) : "";
  const mayProcessStage = canProcessStage(row, adminProfile);
  const mayComplete = current === "Disetujui";
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071a33,#0B2C6A)] text-white shadow-[0_24px_80px_rgba(7,26,51,.25)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-accent-200">Detail Pengajuan Surat</p>
            <h1 className="mt-3 text-3xl font-black md:text-4xl">{row.nomor_pengajuan ?? "Nomor Pengajuan"}</h1>
            <p className="mt-2 max-w-2xl font-bold text-white/70">{serviceName(row)} • {row.nama_lengkap ?? "Pemohon"}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <StatusBadge status={row.status} />
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/15">Diajukan {formatDate(row.created_at)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/15">Petugas {petugasName(row)}</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:w-80 lg:grid-cols-1">
            {mayProcessStage ? <button onClick={() => onVerify(row)} className="rounded-2xl bg-white px-5 py-3 font-black text-gov-950 shadow-lg transition hover:-translate-y-0.5"><ShieldCheck className="inline" size={17} /> {activeStage(row)?.tahap === 5 ? "Setujui" : "Proses Tahap Ini"}</button> : <p className="rounded-2xl bg-white/10 p-4 text-sm font-black text-white ring-1 ring-white/15">{accessLabel(row, adminProfile)}</p>}
            {mayComplete && <button onClick={() => onComplete(row)} className="rounded-2xl bg-emerald-500 px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5"><CheckCircle2 className="inline" size={17} /> Selesai</button>}
            {mayProcessStage && <button onClick={() => onReject(row)} className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5"><XCircle className="inline" size={17} /> Tolak</button>}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-6">
          <SubmissionTimeline row={row} />
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailCard icon={UserRound} title="Identitas Pemohon">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Nama Lengkap" value={row.nama_lengkap} />
                <DetailField label="NIK" value={row.nik} />
                <DetailField label="No HP" value={row.nomor_hp ?? row.no_hp} />
                <DetailField label="Email" value={row.email} />
                <DetailField label="Alamat" value={row.alamat} />
                <DetailField label="RT/RW" value={[row.rt, row.rw].filter(Boolean).join("/") || row.rt_rw} />
              </div>
            </DetailCard>
            <DetailCard icon={ClipboardList} title="Data Permohonan">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Nomor Pengajuan" value={row.nomor_pengajuan} />
                <DetailField label="Jenis Layanan" value={serviceName(row)} />
                <DetailField label="Tanggal Pengajuan" value={formatDate(row.created_at)} />
                <DetailField label="Status" value={current} />
                <DetailField label="Keperluan" value={row.keperluan ?? row.keterangan} />
                <DetailField label="Catatan Admin" value={row.catatan_admin} />
              </div>
              {row.alasan_penolakan && <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700"><AlertTriangle className="inline" size={16} /> {row.alasan_penolakan}</p>}
            </DetailCard>
          </div>
          <DocumentsPanel row={row} />
        </div>
        <aside className="space-y-6">
          <DetailCard icon={FileDown} title="Output Surat">
            {current === "Selesai" ? (
              <div className="space-y-3">
                <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Status sudah Selesai. Surat dapat dicetak atau diunduh dalam format PDF jika file hasil tersedia.</p>
                <a href={outputUrl || "#"} target="_blank" rel="noreferrer" className={cn("flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-black", outputUrl ? "bg-gov-950 text-white hover:bg-gov-800" : "pointer-events-none bg-slate-200 text-slate-400")}><Printer size={17} /> Cetak Surat</a>
                <a href={outputUrl || "#"} download className={cn("flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-black", outputUrl ? "bg-accent-400 text-gov-950 hover:bg-accent-300" : "pointer-events-none bg-slate-200 text-slate-400")}><FileDown size={17} /> Download PDF</a>
                {!outputUrl && <p className="text-xs font-bold text-slate-500">Upload dokumen hasil surat terlebih dahulu melalui panel Dokumen Pendukung.</p>}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 font-bold text-slate-500">Tombol Cetak Surat dan Download PDF akan aktif setelah status pengajuan menjadi Selesai.</p>
            )}
            <Upload id={row.id} setToast={setToast} />
          </DetailCard>
          <ActivityHistory rows={trackingRows} />
          <DetailCard icon={ExternalLink} title="Akses Cepat">
            <Link href="/admin/pengajuan" className="block rounded-2xl bg-slate-50 p-4 text-sm font-black text-gov-950 hover:bg-accent-50">← Kembali ke daftar pengajuan</Link>
          </DetailCard>
        </aside>
      </div>
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
