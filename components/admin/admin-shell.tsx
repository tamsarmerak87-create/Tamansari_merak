"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { cn } from "@/utils/cn";

type Row = Record<string, any>;
type Toast = { type: "success" | "error" | "loading"; text: string } | null;
const statuses = [
  "Menunggu Verifikasi",
  "Sedang Diproses",
  "Selesai",
  "Ditolak",
  "Dibatalkan",
];
const nav = [
  ["Dashboard", "/admin/dashboard", LayoutDashboard],
  ["Pengajuan", "/admin/pengajuan", FileText],
  ["Layanan", "/admin/layanan", SlidersHorizontal],
  ["Riwayat", "/admin/pengajuan", FileClock],
  ["Pengaturan", "/admin/pengaturan", Settings],
] as const;

function useAdminData() {
  const [submissions, setSubmissions] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!client) throw new Error("Supabase belum dikonfigurasi.");
      const [{ data: p, error: pe }, { data: l, error: le }] =
        await Promise.all([
          client
            .from("pengajuan_surat")
            .select("*, layanan(*)")
            .order("created_at", { ascending: false }),
          client
            .from("layanan")
            .select("*")
            .order("nama_layanan", { ascending: true }),
        ]);
      if (pe) throw pe;
      if (le) throw le;
      setSubmissions(p ?? []);
      setServices(l ?? []);
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
      .subscribe();
    return () => {
      void client.removeChannel(ch);
    };
  }, [client, load]);
  return { client, submissions, services, loading, toast, setToast, load };
}

export function AdminShell({
  view,
  id,
}: {
  view: "dashboard" | "pengajuan" | "detail" | "layanan" | "pengaturan";
  id?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [now] = useState(() => Date.now());
  const { client, submissions, services, loading, toast, setToast, load } =
    useAdminData();
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
    ["Total Pengajuan", submissions.length],
    ["Menunggu Verifikasi", stat("Menunggu Verifikasi")],
    ["Sedang Diproses", stat("Sedang Diproses") + stat("Diproses")],
    ["Selesai", stat("Selesai")],
    ["Ditolak", stat("Ditolak")],
    [
      "Hari Ini",
      submissions.filter((r) => String(r.created_at).startsWith(today)).length,
    ],
    [
      "Minggu Ini",
      submissions.filter(
        (r) => now - new Date(r.created_at).getTime() < 604800000,
      ).length,
    ],
    [
      "Bulan Ini",
      submissions.filter(
        (r) => new Date(r.created_at).getMonth() === new Date().getMonth(),
      ).length,
    ],
  ];
  const updateStatus = async (row: Row, next: string) => {
    if (!client) return;
    setToast({ type: "loading", text: "Menyimpan perubahan..." });
    const note =
      next === "Sedang Diproses"
        ? "Pengajuan sedang diproses petugas."
        : `Status pengajuan diubah menjadi ${next}.`;
    const { error } = await client
      .from("pengajuan_surat")
      .update({ status: next, catatan_admin: note })
      .eq("id", row.id);
    if (!error)
      await client
        .from("tracking_pengajuan")
        .insert({
          id_pengajuan: row.id,
          status: next,
          progress: next === "Selesai" ? 5 : next === "Ditolak" ? 0 : 3,
          catatan: note,
        });
    setToast(
      error
        ? { type: "error", text: error.message }
        : { type: "success", text: "Status berhasil diperbarui" },
    );
    await load();
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
          r.layanan?.nama_layanan ?? r.jenis_surat,
          r.nomor_hp,
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
  return (
    <main className="min-h-screen bg-[#edf4f1] text-slate-900">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] w-72 bg-gov-950 p-5 text-white transition lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <b className="text-xl">Admin Tamansari</b>
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
                pathname === href
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
              Sistem Layanan Online
            </p>
            <h1 className="text-2xl font-black text-gov-950">
              Dashboard Admin Kelurahan Tamansari
            </h1>
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
            </div>
          </>
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
                    {s.nama_layanan}
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
              <td>{r.layanan?.nama_layanan ?? r.jenis_surat}</td>
              <td>{r.nomor_hp}</td>
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
                    <option key={s}>{s}</option>
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
    const f = e.target.files?.[0];
    if (!f || !client) return;
    const path = `dokumen-pengajuan/${id}/${Date.now()}-${f.name}`;
    const { error } = await client.storage
      .from("public-assets")
      .upload(path, f, { upsert: true });
    if (!error) {
      const url = client.storage.from("public-assets").getPublicUrl(path)
        .data.publicUrl;
      await client
        .from("dokumen_pengajuan")
        .insert({ id_pengajuan: id, jenis_dokumen: f.name, file_url: url });
    }
    setToast(
      error
        ? { type: "error", text: error.message }
        : { type: "success", text: "Dokumen berhasil diupload" },
    );
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
      .insert({ nama_layanan: name, is_active: true });
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
          a={s.nama_layanan}
          b={s.is_active === false ? "Nonaktif" : "Aktif"}
        />
      ))}
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
