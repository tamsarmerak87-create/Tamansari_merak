"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, ChevronRight, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { QRCodePelayanan } from "@/components/pengajuan/qr-code-pelayanan";
import { BackButton } from "@/components/warga/back-button";
import { getMyPengajuan, type WargaPengajuan } from "@/services/warga-pengajuan.service";

const filters = ["Semua", "Menunggu", "Diproses", "Selesai"];
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-"; }
function docName(item: WargaPengajuan) { return item.layanan?.nama ?? item.keperluan ?? "Nama layanan tidak tersedia"; }
function agenda(item: WargaPengajuan) { return item.nomor_pengajuan ?? item.id; }
function statusClass(status?: string | null) { const s = (status || "").toLowerCase(); if (s.includes("selesai") || s.includes("setuju")) return "bg-emerald-100 text-emerald-700"; if (s.includes("proses")) return "bg-[#FFF3BF] text-[#A16207]"; return "bg-[#FFF8DB] text-[#B7791F]"; }
function matchFilter(item: WargaPengajuan, filter: string) { const s = (item.status || "").toLowerCase(); if (filter === "Semua") return true; if (filter === "Menunggu") return /menunggu|verifikasi|pending|diajukan/.test(s); if (filter === "Diproses") return /proses|diproses/.test(s); return /selesai|setuju|disetujui/.test(s); }

export default function SemuaPengajuanPage() {
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();
    const [items, setItems] = useState<WargaPengajuan[]>([]);
    const [fetching, setFetching] = useState(true);
    const [filter, setFilter] = useState("Semua");
    const [query, setQuery] = useState("");
    const [barcodeItem, setBarcodeItem] = useState<WargaPengajuan | null>(null);
    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user || !profile) { if (!loading) void Promise.resolve().then(() => setFetching(false)); return; } void (async () => { try { setFetching(true); setItems(await getMyPengajuan(profile)); } catch (error) { console.error(error); } finally { setFetching(false); } })(); }, [loading, user, profile]);
    const filtered = useMemo(() => items.filter((item) => matchFilter(item, filter)).filter((item) => `${docName(item)} ${agenda(item)} ${item.status}`.toLowerCase().includes(query.toLowerCase())), [items, filter, query]);
    if (loading || !user) return <main className="min-h-screen bg-[#F7F8F5] p-10 font-black text-[#172033]">Memuat pengajuan...</main>;
    return <main className="min-h-screen bg-[#F7F8F5] px-4 pb-28 pt-6 text-[#172033] sm:px-8 lg:px-10">
        <section className="mx-auto max-w-6xl space-y-6"><BackButton /><div className="rounded-[30px] border border-[#E8E8E8] bg-[linear-gradient(135deg,#FFC400,#fff7cf_58%,#e9f8ee)] p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[.18em] text-[#15803D]">Status Pengajuan</p><h1 className="mt-2 text-3xl font-black">Semua Pengajuan Saya</h1><p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">Pantau pengajuan berdasarkan data warga yang sedang login. Gunakan barcode pelayanan saat datang ke loket Kelurahan Tamansari.</p></div>
            <div className="rounded-[24px] border border-[#E8E8E8] bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{filters.map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-[#FFC400]/30 ${filter === f ? "bg-[#FFC400] text-[#172033]" : "bg-[#F7F8F5] text-slate-600 hover:bg-emerald-50"}`}>{f}</button>)}</div><label className="flex min-h-11 items-center gap-2 rounded-2xl border border-[#E8E8E8] bg-[#F7F8F5] px-4 lg:w-80"><Search size={18} className="text-[#16A34A]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor agenda/layanan" className="w-full bg-transparent text-sm font-semibold outline-none" /></label></div></div>
            {fetching ? <div className="animate-pulse space-y-3"><div className="h-24 rounded-3xl bg-white" /><div className="h-24 rounded-3xl bg-white" /></div> : filtered.length === 0 ? <div className="rounded-[24px] border border-dashed border-[#E8E8E8] bg-white p-8 text-center"><FileText className="mx-auto text-[#FFC400]" size={42} /><p className="mt-3 font-black">Belum ada pengajuan.</p><p className="mt-1 text-sm text-slate-500">Ajukan surat pertama Anda secara online.</p><Button type="button" variant="gold" href="/layanan" className="mt-4">Lihat Daftar Layanan</Button></div> : <div className="space-y-3">{filtered.map((item) => <article key={item.id} className="group rounded-[24px] border border-[#E8E8E8] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFC400] hover:shadow-lg"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF8DB] text-[#F0A000]"><FileText size={30} /></div><div className="min-w-0 flex-1"><h2 className="font-black uppercase leading-snug">{docName(item)}</h2><p className="mt-1 text-sm font-bold text-slate-500">{agenda(item)}</p><p className="text-xs font-semibold text-slate-500">{formatDate(item.created_at)}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status || "Menunggu Verifikasi"}</span><div className="flex gap-2"><button onClick={() => setBarcodeItem(item)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#16A34A]/30 px-3 text-sm font-black text-[#15803D] hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-[#16A34A]/20"><Barcode size={16} />Barcode</button><a aria-label={`Lihat detail ${agenda(item)}`} href={`/dashboard/pengajuan/${item.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFC400] text-[#172033] focus:outline-none focus:ring-4 focus:ring-[#FFC400]/40"><ChevronRight /></a></div></div></article>)}</div>}
        </section>{barcodeItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-xl rounded-[28px] bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Barcode Pelayanan</h2><button aria-label="Tutup modal barcode" onClick={() => setBarcodeItem(null)} className="rounded-full px-3 py-1 font-black hover:bg-slate-100">x</button></div><QRCodePelayanan nomorPengajuan={agenda(barcodeItem)} status={barcodeItem.status} tanggal={formatDate(barcodeItem.created_at)} layanan={docName(barcodeItem)} size={220} /></div></div>}
    </main>;
}