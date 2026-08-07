"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  FileClock,
  FileText,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Newspaper,
  Scale,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { getCurrentAdminPortalUser, type AdminPortalProfile } from "@/services/admin-auth.service";
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
  "Sedang Diproses",
  "Selesai",
  "Ditolak",
  "Dibatalkan",
];
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
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!client) throw new Error("Supabase belum dikonfigurasi.");
      const [{ data: p, error: pe }, { data: l, error: le }, { data: w, error: we }, { data: allWarga, error: awe }] =
        await Promise.all([
          client
            .from("pengajuan_surat")
            .select("*, layanan(*)")
            .order("created_at", { ascending: false }),
          client
            .from("layanan")
            .select(`
              id,
              nama,
              deskripsi,
              aktif,
              persyaratan,
              alur,
              dasar_hukum,
              output,
              kanal,
              created_at
            `)
            .order("nama", { ascending: true }),
          client
            .from("warga_profiles")
            .select("id,nama_lengkap,nik,email,created_at,status_verifikasi,alasan_penolakan")
            .eq("status_verifikasi", "Belum Terverifikasi")
            .order("created_at", { ascending: true }),
          client
            .from("warga_profiles")
            .select("id,nama_lengkap,nik,email,created_at,status_verifikasi,alasan_penolakan")
            .order("created_at", { ascending: false }),
        ]);
      if (pe) throw pe;
      if (le) throw le;
      if (we) throw we;
      if (awe) throw awe;
      setSubmissions(p ?? []);
      setServices(l ?? []);
      setPendingWarga((w ?? []) as PendingWarga[]);
      setWargaProfiles((allWarga ?? []) as PendingWarga[]);
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Gagal memuat data",
      });
    } finally {
      setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    if (!client) return;
    const ch = client
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pengajuan_surat" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "layanan" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warga_profiles" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(ch);
    };
  }, [client, load]);
  return { client, submissions, services, pendingWarga, setPendingWarga, wargaProfiles, setWargaProfiles, loading, toast, setToast, load };
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
  const [now] = useState(() => Date.now());
  const [adminProfile, setAdminProfile] = useState<AdminPortalProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { client, submissions, services, pendingWarga, setPendingWarga, wargaProfiles, setWargaProfiles, loading, toast, setToast, load } =
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
  const filtered = submissions
    .filter((r) =>
      [r.nomor_pengajuan, r.nama_lengkap, r.nik, r.nomor_hp]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter((r) => !status || r.status === status)
    .filter((r) => !service || r.layanan_id === service);
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
  const updateStatus = async (row: Row, next: string) => {
    try {
      setToast({ type: "loading", text: "Menyimpan perubahan..." });
      const normalized = next === "Sedang Diproses" ? "Diproses" : next;
      const note = normalized === "Diproses" ? "Pengajuan sedang diproses petugas." : `Status pengajuan diubah menjadi ${normalized}.`;
      const res = await fetch("/api/surat-online/admin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, status: normalized, catatan: note, petugas: "Admin Kelurahan" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Gagal memperbarui status");
      setToast({ type: "success", text: "Status berhasil diperbarui" });
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "Gagal memperbarui status" });
    } finally {
      await load();
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
      "Nomor,Tanggal,Nama,NIK,Layanan,No HP,Status",
      ...filtered.map((r) =>
        [
          r.nomor_pengajuan,
          r.created_at,
          r.nama_lengkap,
          r.nik,
          r.layanan?.nama ?? r.jenis_surat,
          r.nomor_hp ?? r.no_hp,
          r.status,
        ].join(","),
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
            <p className="mt-1 text-xs font-bold uppercase tracking-[.18em] text-accent-200">{adminProfile.role}</p>
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
              await client?.auth.signOut();
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
            <div className="mb-4 grid gap-3 md:grid-cols-5">
              <div className="md:col-span-2 rounded-2xl bg-slate-50 px-3 py-2">
                <Search size={16} className="inline" />{" "}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="bg-transparent outline-none"
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
              <button
                onClick={exportCsv}
                className="rounded-2xl bg-accent-400 p-3 font-black"
              >
                Export CSV
              </button>
            </div>
            <Table rows={filtered} onStatus={updateStatus} />
          </Panel>
        ) : view === "detail" ? (
          <Panel title="Detail Pengajuan">
            {detail ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Info row={detail} />
                <div className="space-y-3">
                  <h3 className="font-black">Aksi Admin</h3>
                  {statuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(detail, s)}
                      className="mr-2 rounded-xl bg-gov-950 px-4 py-2 text-white"
                    >
                      {s}
                    </button>
                  ))}
                  <Upload client={client} id={detail.id} setToast={setToast} />
                </div>
              </div>
            ) : (
              "Data tidak ditemukan"
            )}
          </Panel>
        ) : view === "layanan" ? (
          <Layanan
            services={services}
            client={client}
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
  onStatus,
}: {
  rows: Row[];
  onStatus: (r: Row, s: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Nomor</th>
            <th>Tanggal</th>
            <th>Nama</th>
            <th>NIK</th>
            <th>Layanan</th>
            <th>No HP</th>
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
              <td>{String(r.created_at).slice(0, 10)}</td>
              <td>{r.nama_lengkap}</td>
              <td>{r.nik}</td>
              <td>{r.layanan?.nama ?? r.jenis_surat}</td>
              <td>{r.nomor_hp ?? r.no_hp}</td>
              <td>
                <span className="rounded-full bg-accent-100 px-3 py-1 font-bold">
                  {r.status}
                </span>
              </td>
              <td>
                <select
                  onChange={(e) => onStatus(r, e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Ubah
                  </option>
                  {statuses.map((s) => (
                    <option key={s} value={s === "Sedang Diproses" ? "Diproses" : s}>{s}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-8 text-center">Belum ada data.</p>}
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
  client,
  id,
  setToast,
}: {
  client: any;
  id: string;
  setToast: (t: Toast) => void;
}) {
  const up = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = e.target.files?.[0];
      if (!f || !client) return;
      const path = `pendukung/${id}-${Date.now()}-${f.name}`;
      const { error } = await client.storage.from("surat").upload(path, f, { upsert: true });
      if (error) throw error;
      const url = client.storage.from("surat").getPublicUrl(path).data.publicUrl;
      const { error: insertError } = await client
        .from("dokumen_pengajuan")
        .insert({ pengajuan_id: id, nama_file: f.name, jenis: "Hasil Surat", url_file: url });
      if (insertError) throw insertError;
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
function Layanan({
  services,
  client,
  reload,
  setToast,
}: {
  services: Row[];
  client: any;
  reload: () => void;
  setToast: (t: Toast) => void;
}) {
  const [name, setName] = useState("");
  const save = async () => {
    const { error } = await client
      .from("layanan")
      .insert({ nama: name, aktif: true });
    setToast(
      error
        ? { type: "error", text: error.message }
        : { type: "success", text: "Layanan tersimpan" },
    );
    setName("");
    reload();
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
