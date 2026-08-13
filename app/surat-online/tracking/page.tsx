"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, FileSearch, Loader2, Printer, RefreshCw, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { QRCodePelayanan } from "@/components/pengajuan/qr-code-pelayanan";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { cn } from "@/utils/cn";

type History = { status?: string; keterangan?: string | null; created_at?: string | null };
type Doc = { nomor_pengajuan?: string; jenis_surat?: string; created_at?: string; updated_at?: string; status?: string; layanan?: { nama?: string; title?: string } | null; tracking_pengajuan?: History[] };
type Activity = { trackingNumber?: string; documentType?: string; status?: string; updatedAt?: string };
type Monitor = { stats: { total: number; processing: number; waiting: number; done: number }; activity: Activity[] };
type ViewState = "idle" | "loading" | "found" | "not-found" | "server-error";

const emptyMonitor: Monitor = { stats: { total: 0, processing: 0, waiting: 0, done: 0 }, activity: [] };
const steps = [
    { label: "DITERIMA", aliases: ["diajukan", "diterima", "menunggu verifikasi"] },
    { label: "VERIFIKASI", aliases: ["verifikasi", "terverifikasi"] },
    { label: "DIPROSES", aliases: ["diproses", "proses administrasi", "dokumen diproses"] },
    { label: "PERSETUJUAN", aliases: ["persetujuan", "disetujui", "ditandatangani"] },
    { label: "SELESAI", aliases: ["selesai"] },
] as const;

const normalize = (value?: string | null) => String(value ?? "").toLowerCase().trim();
const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
const statusLabel = (value?: string) => String(value || "Menunggu").toUpperCase();
const serviceName = (data: Doc) => data.layanan?.nama ?? data.layanan?.title ?? data.jenis_surat ?? "Dokumen Kelurahan";

function formatDate(value?: string | null, withTime = false) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : {}) });
}

function timeAgo(value?: string) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "Baru saja";
    const min = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (min < 1) return "Baru saja";
    if (min < 60) return `${min} menit lalu`;
    return formatDate(value, true);
}

async function fetchTracking(query = ""): Promise<{ document: Doc | null; monitor: Monitor }> {
    const response = await fetch(query ? `/api/surat-online/tracking?q=${encodeURIComponent(query)}` : "/api/surat-online/tracking", { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const monitor = result?.monitor ?? emptyMonitor;
    if (response.status === 404) return { document: null, monitor };
    if (!response.ok || !result?.ok) throw new Error(typeof result?.error === "string" ? result.error : "Gagal memuat data tracking.");
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    return { document: rows[0] ?? null, monitor };
}

export default function TrackingPage() {
    const initialQuery = typeof window === "undefined" ? "" : sanitize(new URLSearchParams(window.location.search).get("nomor") ?? "");
    const [query, setQuery] = useState(initialQuery);
    const [activeQuery, setActiveQuery] = useState("");
    const [state, setState] = useState<ViewState>("idle");
    const [data, setData] = useState<Doc | null>(null);
    const [monitor, setMonitor] = useState<Monitor>(emptyMonitor);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const loadTracking = useCallback(async (nextQuery = "", silent = false) => {
        const safeQuery = sanitize(nextQuery);
        if (!silent && safeQuery) { setState("loading"); setError(""); }
        try {
            const result = await fetchTracking(safeQuery);
            setMonitor(result.monitor);
            setLastUpdated(new Date());
            if (safeQuery) { setData(result.document); setActiveQuery(safeQuery); setState(result.document ? "found" : "not-found"); }
        } catch (err) {
            if (!silent) setData(null);
            setState(silent && data ? "found" : "server-error");
            setError(err instanceof Error ? err.message : "Gagal memuat data tracking.");
        }
    }, [data]);

    useEffect(() => {
        const timer = window.setTimeout(() => void loadTracking(initialQuery, !initialQuery), 0);
        return () => window.clearTimeout(timer);
    }, [initialQuery, loadTracking]);
    useEffect(() => {
        let mounted = true;
        const refresh = () => { if (mounted && !document.hidden) void loadTracking(activeQuery, true); };
        const interval = window.setInterval(refresh, 8000);
        let channel: { unsubscribe: () => void } | null = null;
        try {
            const client = createSupabaseBrowserClient();
            channel = client.channel(`document-monitor-${activeQuery || "global"}`).on("postgres_changes", { event: "*", schema: "public", table: "pengajuan_surat" }, refresh).on("postgres_changes", { event: "*", schema: "public", table: "tracking_pengajuan" }, refresh).subscribe();
        } catch { channel = null; }
        return () => { mounted = false; window.clearInterval(interval); channel?.unsubscribe(); };
    }, [activeQuery, loadTracking]);

    function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void loadTracking(query); }

    return <main className="min-h-screen overflow-hidden bg-[#f7f1e3] px-4 pb-24 pt-28 text-slate-800 sm:px-6 lg:px-8">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(224,181,75,.32),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(9,59,44,.22),transparent_30%),linear-gradient(180deg,#fffaf0_0%,#f7f1e3_58%,#edf5eb_100%)]" />
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-gov-900/10 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[.22em] text-gov-800 shadow-sm"><span className="size-2 animate-pulse rounded-full bg-emerald-500" /> LIVE TRACKING</span>
            <h1 className="mt-6 font-display text-[clamp(42px,7vw,78px)] font-black leading-[.95] tracking-tight text-gov-950">Lacak Dokumen Anda</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-650 sm:text-xl">Pantau perjalanan dokumen Anda secara langsung dari pengajuan hingga selesai.</p>
        </motion.section>
        <section className="mx-auto mt-10 max-w-6xl">
            <GlassCard className="rounded-[32px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(13,62,42,.16)] sm:p-8">
                <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><div className="grid size-16 place-items-center rounded-3xl bg-gov-950 text-accent-300 shadow-lg"><FileSearch size={30} /></div><h2 className="mt-5 text-3xl font-black text-gov-950">Masukkan Nomor Tracking</h2><p className="mt-2 text-sm font-bold text-slate-500">Contoh format: TMS-20260812-0001</p></div>
                    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto]"><input className="min-h-14 w-full rounded-2xl border border-gov-950/10 bg-[#fffaf0] px-5 text-base font-black uppercase tracking-wide text-gov-950 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-200" value={query} onChange={(e) => setQuery(sanitize(e.target.value))} placeholder="TMS-20260812-0001" autoComplete="off" /><Button type="submit" variant="gold" disabled={query.length < 6 || state === "loading"} className="min-h-14 w-full sm:w-auto"><Search size={18} />{state === "loading" ? "Melacak..." : "Lacak Dokumen"}</Button></form></div>
            </GlassCard>
            <DocumentMonitor monitor={monitor} data={state === "found" ? data : null} lastUpdated={lastUpdated} />
            <div className="mt-7">{state === "loading" && <LoadingCard />}{state === "not-found" && <ErrorCard onRetry={() => { setState("idle"); setData(null); }} />}{state === "server-error" && <ServerError message={error} onRetry={() => void loadTracking(query)} />}</div>
        </section>
    </main>;
}

function DocumentMonitor({ monitor, data, lastUpdated }: { monitor: Monitor; data: Doc | null; lastUpdated: Date | null }) {
    return <section className="mt-8 overflow-hidden rounded-[34px] border border-emerald-300/20 bg-[#061915]/95 p-4 text-emerald-50 shadow-[0_30px_90px_rgba(4,33,26,.34)] ring-1 ring-white/10 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-emerald-300/10 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.28em] text-accent-300">DOCUMENT MONITOR</p><h2 className="mt-2 text-2xl font-black text-white">Digital Document Tracking Center</h2></div><div className="flex items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black"><span className="size-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.9)]" /> LIVE <span className="text-emerald-200">Terhubung ke sistem</span></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="TOTAL DOKUMEN" value={monitor.stats.total} /><Metric label="DIPROSES" value={monitor.stats.processing} /><Metric label="MENUNGGU" value={monitor.stats.waiting} /><Metric label="SELESAI" value={monitor.stats.done} /></div>
        {data ? <TrackingResult data={data} lastUpdated={lastUpdated} /> : <ActivityList activity={monitor.activity} />}
    </section>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-3xl border border-emerald-300/10 bg-white/[.045] p-5 shadow-inner"><p className="text-xs font-black tracking-[.18em] text-emerald-200/80">{label}</p><p className="mt-3 text-4xl font-black text-white">{value ?? 0}</p></div>; }

function ActivityList({ activity }: { activity: Activity[] }) {
    return <div className="mt-6 rounded-3xl border border-emerald-300/10 bg-black/20 p-5"><h3 className="text-sm font-black uppercase tracking-[.22em] text-accent-300">LIVE DOCUMENT ACTIVITY</h3>{activity.length ? <div className="mt-5 space-y-3">{activity.map((item) => <div key={`${item.trackingNumber}-${item.updatedAt}`} className="grid gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-950/30 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><p className="font-black text-white"><span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-emerald-300" />{item.trackingNumber}</p><p className="font-bold text-emerald-100">{item.documentType}</p><p className="font-black text-accent-300">{item.status} <span className="ml-2 text-xs text-emerald-200/70">{timeAgo(item.updatedAt)}</span></p></div>)}</div> : <p className="mt-5 font-bold text-emerald-100/70">Belum ada aktivitas dokumen.</p>}</div>;
}

function TrackingResult({ data, lastUpdated }: { data: Doc; lastUpdated: Date | null }) {
    const history = useMemo(() => [...(data.tracking_pengajuan ?? [])].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()), [data.tracking_pengajuan]);
    const currentStatus = data.status ?? history.at(-1)?.status ?? "Diajukan";
    const current = normalize(currentStatus);
    const activeIndex = steps.reduce((max, step, i) => history.some((h) => step.aliases.some((a) => normalize(h.status).includes(a))) || step.aliases.some((a) => current.includes(a)) ? i : max, 0);
    return <div className="mt-6 grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-3xl border border-emerald-300/10 bg-white/[.055] p-5"><p className="text-xs font-black uppercase tracking-[.22em] text-accent-300">STATUS DOKUMEN</p><h3 className="mt-3 text-3xl font-black text-white">{data.nomor_pengajuan}</h3><div className="mt-5 grid gap-3 text-sm font-bold text-emerald-100"><p>Jenis Dokumen: <span className="text-white">{serviceName(data)}</span></p><p>Tanggal Pengajuan: <span className="text-white">{formatDate(data.created_at)}</span></p><p>Status: <span className="rounded-full bg-accent-300 px-3 py-1 text-gov-950">{statusLabel(currentStatus)}</span></p></div><div className="mt-6 rounded-2xl bg-black/25 p-4"><p className="font-black text-accent-300"><span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-emerald-300" />LIVE STATUS</p><p className="mt-3 text-sm font-bold text-emerald-100">Sistem terhubung</p><p className="text-sm font-bold text-emerald-100">Status terakhir diperbarui: {lastUpdated ? lastUpdated.toLocaleTimeString("id-ID") : "-"}</p><p className="mt-2 text-xl font-black text-white">{statusLabel(currentStatus)}</p></div></div><div className="space-y-5"><Timeline activeIndex={activeIndex} current={current} /><div className="rounded-3xl bg-white p-2 text-[#172033]"><QRCodePelayanan nomorPengajuan={data.nomor_pengajuan} status={currentStatus} tanggal={formatDate(data.created_at)} layanan={serviceName(data)} size={190} /></div><button type="button" onClick={() => window.print()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFC400] px-5 text-sm font-black text-[#172033] transition hover:bg-[#FFD84D] focus:outline-none focus:ring-4 focus:ring-[#FFC400]/40"><Printer size={18} />Cetak Barcode Pelayanan</button></div></div>;
}

function Timeline({ activeIndex, current }: { activeIndex: number; current: string }) {
    return <div className="rounded-3xl border border-emerald-300/10 bg-black/20 p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-black uppercase tracking-[.22em] text-accent-300">TIMELINE DIGITAL</h3><span className="inline-flex items-center gap-2 text-xs font-black text-emerald-200"><RefreshCw size={14} /> LIVE - diperbarui otomatis</span></div><div className="mt-7 grid gap-4 md:grid-cols-5 md:gap-2">{steps.map((step, index) => { const done = current.includes("selesai") || index < activeIndex; const active = !current.includes("selesai") && index === activeIndex; return <div key={step.label} className="relative flex gap-3 md:block md:text-center"><span className={cn("relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2 font-black md:mx-auto", done ? "border-emerald-300 bg-emerald-300 text-gov-950" : active ? "animate-pulse border-accent-300 bg-accent-300 text-gov-950 shadow-[0_0_28px_rgba(244,202,76,.7)]" : "border-emerald-100/30 bg-transparent text-emerald-100/50")}>{done ? <Check size={18} /> : active ? "*" : "o"}</span>{index < steps.length - 1 && <span className="absolute left-5 top-11 h-full w-px bg-emerald-300/15 md:left-1/2 md:top-5 md:h-px md:w-full" />}<p className={cn("pt-2 text-sm font-black", active ? "text-accent-300" : done ? "text-white" : "text-emerald-100/50")}>{step.label}</p></div>; })}</div></div>;
}

function LoadingCard() { return <GlassCard className="rounded-[32px] bg-white/90 p-6"><div className="flex items-center gap-3 text-gov-950"><Loader2 className="animate-spin text-accent-500" /><div><p className="font-black">Mencari dokumen...</p><p className="text-sm font-bold text-slate-500">Menghubungkan ke sistem...</p></div></div><div className="mt-5 grid gap-3"><span className="h-14 animate-pulse rounded-2xl bg-slate-100" /><span className="h-24 animate-pulse rounded-2xl bg-slate-100" /></div></GlassCard>; }
function ErrorCard({ onRetry }: { onRetry: () => void }) { return <GlassCard className="rounded-[32px] border border-red-100 bg-white/95 p-6 text-center"><AlertCircle className="mx-auto text-red-500" size={42} /><h2 className="mt-4 text-2xl font-black text-gov-950">Dokumen Tidak Ditemukan</h2><p className="mx-auto mt-2 max-w-xl font-semibold leading-7 text-slate-600">Nomor tracking tidak ditemukan dalam sistem. Periksa kembali nomor tracking Anda.</p><Button type="button" variant="primary" className="mt-5" onClick={onRetry}>Coba Lagi</Button></GlassCard>; }
function ServerError({ message, onRetry }: { message: string; onRetry: () => void }) { return <GlassCard className="rounded-[32px] border border-red-100 bg-white/95 p-6 text-center"><AlertCircle className="mx-auto text-red-500" size={42} /><h2 className="mt-4 text-2xl font-black text-gov-950">Gagal Memuat Data</h2><p className="mx-auto mt-2 max-w-xl font-semibold leading-7 text-slate-600">{message || "Silakan coba beberapa saat lagi."}</p><Button type="button" variant="primary" className="mt-5" onClick={onRetry}>Coba Lagi</Button></GlassCard>; }