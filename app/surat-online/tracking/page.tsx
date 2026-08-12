"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock3, FileSearch, Loader2, Radio, RefreshCw, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { cn } from "@/utils/cn";

type TrackingHistory = { status?: string; keterangan?: string | null; petugas?: string | null; created_at?: string | null; progress?: number | null };
type TrackingDocument = {
    id?: string;
    nomor_pengajuan?: string;
    nomor_tiket?: string;
    tracking_url?: string;
    nama_lengkap?: string;
    jenis_surat?: string;
    created_at?: string;
    updated_at?: string;
    status?: string;
    petugas?: string | null;
    layanan?: { nama?: string; title?: string; output?: string } | null;
    tracking_pengajuan?: TrackingHistory[];
};

type ViewState = "idle" | "loading" | "found" | "not-found" | "server-error";

const trackingSteps = [
    { key: "received", label: "Pengajuan diterima", statusText: "Dokumen berhasil diterima sistem.", aliases: ["diajukan", "diterima", "menunggu verifikasi", "permohonan diterima"] },
    { key: "verify", label: "Verifikasi berkas", statusText: "Berkas sedang diperiksa petugas.", aliases: ["verifikasi", "terverifikasi", "verifikasi berkas"] },
    { key: "admin", label: "Proses administrasi", statusText: "Dokumen sedang diproses administrasi.", aliases: ["diproses", "sedang diproses", "proses administrasi"] },
    { key: "approval", label: "Menunggu persetujuan", statusText: "Dokumen menunggu persetujuan pejabat berwenang.", aliases: ["menunggu persetujuan", "persetujuan", "disetujui", "ditandatangani"] },
    { key: "process", label: "Dokumen diproses", statusText: "Dokumen akhir sedang disiapkan.", aliases: ["dokumen diproses", "ditandatangani", "disetujui"] },
    { key: "done", label: "Dokumen selesai", statusText: "Dokumen selesai dan siap ditindaklanjuti.", aliases: ["selesai"] },
] as const;

const terminalStatus: Record<string, { label: string; tone: "red" | "amber" }> = {
    ditolak: { label: "Ditolak", tone: "red" },
    "perlu perbaikan": { label: "Perlu Perbaikan", tone: "amber" },
    revisi: { label: "Perlu Perbaikan", tone: "amber" },
};

function normalize(value?: string | null) {
    return String(value ?? "").toLowerCase().trim();
}

function formatDate(value?: string | null, withTime = false) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

function maskName(name?: string) {
    const clean = String(name ?? "").trim();
    if (!clean) return "-";
    return clean.split(/\s+/).map((part, index) => {
        if (index === 0 || part.length <= 2) return part;
        return `${part[0]}${"*".repeat(Math.max(part.length - 2, 1))}${part.at(-1)}`;
    }).join(" ");
}

function sanitizeTrackingNumber(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}

async function fetchTracking(query: string): Promise<TrackingDocument | null> {
    const response = await fetch(`/api/surat-online/tracking?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (response.status === 404) return null;
    if (!response.ok || !result?.ok) throw new Error(typeof result?.error === "string" ? result.error : "Gagal memuat data tracking.");
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    return rows[0] ?? null;
}

export default function TrackingPage() {
    const initialQuery = typeof window === "undefined" ? "" : sanitizeTrackingNumber(new URLSearchParams(window.location.search).get("nomor") ?? "");
    const [query, setQuery] = useState(initialQuery);
    const [activeQuery, setActiveQuery] = useState("");
    const [state, setState] = useState<ViewState>("idle");
    const [data, setData] = useState<TrackingDocument | null>(null);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [autoLoadQuery, setAutoLoadQuery] = useState(initialQuery);

    const canSubmit = query.trim().length >= 6 && state !== "loading";

    const loadTracking = useCallback(async (nextQuery: string, silent = false) => {
        const safeQuery = sanitizeTrackingNumber(nextQuery);
        if (!safeQuery) return;
        if (!silent) {
            setState("loading");
            setError("");
        }
        try {
            const nextData = await fetchTracking(safeQuery);
            setData(nextData);
            setActiveQuery(safeQuery);
            setLastUpdated(new Date());
            setState(nextData ? "found" : "not-found");
            setError("");
        } catch (loadError) {
            if (!silent) setData(null);
            setState(silent && data ? "found" : "server-error");
            setError(loadError instanceof Error ? loadError.message : "Gagal memuat data tracking.");
        }
    }, [data]);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void loadTracking(query);
    }

    useEffect(() => {
        if (!autoLoadQuery) return;
        const timer = window.setTimeout(() => {
            void loadTracking(autoLoadQuery);
            setAutoLoadQuery("");
        }, 0);
        return () => window.clearTimeout(timer);
    }, [autoLoadQuery, loadTracking]);

    useEffect(() => {
        if (!activeQuery || state !== "found") return;
        let mounted = true;
        const refresh = () => {
            if (!mounted) return;
            void loadTracking(activeQuery, true);
        };
        const interval = window.setInterval(refresh, 7000);
        let channel: { unsubscribe: () => void } | null = null;
        try {
            const client = createSupabaseBrowserClient();
            channel = client
                .channel(`public-tracking-${activeQuery}`)
                .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan_surat" }, refresh)
                .on("postgres_changes", { event: "*", schema: "public", table: "tracking_pengajuan" }, refresh)
                .subscribe();
        } catch {
            channel = null;
        }
        return () => {
            mounted = false;
            window.clearInterval(interval);
            if (channel) channel.unsubscribe();
        };
    }, [activeQuery, state, loadTracking]);

    return (
        <main className="min-h-screen overflow-hidden bg-[#f7f1e3] px-4 pb-16 pt-28 text-slate-800 sm:px-6 lg:px-8">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(224,181,75,.34),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(14,78,54,.18),transparent_26%),linear-gradient(180deg,#fffaf0_0%,#f7f1e3_55%,#eef5ec_100%)]" />
            <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto max-w-5xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-gov-900/10 bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[.22em] text-gov-800 shadow-sm"><Radio size={15} /> Live tracking</span>
                <h1 className="mt-6 font-display text-[clamp(42px,7vw,78px)] font-black leading-[.95] tracking-tight text-gov-950">Lacak Dokumen Anda</h1>
                <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-650 sm:text-xl">Pantau proses dokumen secara langsung menggunakan nomor tracking.</p>
            </motion.section>

            <section className="mx-auto mt-10 max-w-4xl">
                <GlassCard className="rounded-[32px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(13,62,42,.16)] sm:p-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gov-950 text-accent-300 shadow-lg"><FileSearch size={30} /></div>
                        <h2 className="mt-5 text-3xl font-black text-gov-950">Lacak Dokumen</h2>
                        <p className="mt-2 text-sm font-bold text-slate-500">Nomor tracking dapat ditemukan pada bukti pengajuan Anda.</p>
                    </div>
                    <form onSubmit={submit} className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <label className="sr-only" htmlFor="tracking-number">Masukkan Nomor Tracking</label>
                        <input id="tracking-number" className="min-h-14 w-full rounded-2xl border border-gov-950/10 bg-[#fffaf0] px-5 text-base font-black uppercase tracking-wide text-gov-950 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-200" value={query} onChange={(event) => setQuery(sanitizeTrackingNumber(event.target.value))} placeholder="Contoh: TMS-20260812-0001" autoComplete="off" />
                        <Button type="submit" variant="gold" disabled={!canSubmit} className="min-h-14 w-full sm:w-auto"><Search size={18} />{state === "loading" ? "Melacak..." : "Lacak Dokumen"}</Button>
                    </form>
                </GlassCard>

                <div className="mt-7">
                    {state === "loading" ? <LoadingCard /> : null}
                    {state === "not-found" ? <ErrorCard title="Dokumen Tidak Ditemukan" message="Nomor tracking yang Anda masukkan tidak ditemukan. Periksa kembali nomor tracking Anda." onRetry={() => { setState("idle"); setData(null); }} /> : null}
                    {state === "server-error" ? <ErrorCard title="Gagal Memuat Data" message={error || "Silakan coba beberapa saat lagi."} onRetry={() => void loadTracking(query)} /> : null}
                    {state === "found" && data ? <TrackingResult data={data} lastUpdated={lastUpdated} /> : null}
                </div>
            </section>
        </main>
    );
}

function LoadingCard() {
    return <GlassCard className="rounded-[32px] bg-white/90 p-6"><div className="flex items-center gap-3 text-gov-950"><Loader2 className="animate-spin text-accent-500" /><span className="font-black">Mengambil status dokumen...</span></div><div className="mt-5 grid gap-3"><span className="h-14 animate-pulse rounded-2xl bg-slate-100" /><span className="h-24 animate-pulse rounded-2xl bg-slate-100" /><span className="h-24 animate-pulse rounded-2xl bg-slate-100" /></div></GlassCard>;
}

function ErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
    return <GlassCard className="rounded-[32px] border border-red-100 bg-white/95 p-6 text-center"><AlertCircle className="mx-auto text-red-500" size={42} /><h2 className="mt-4 text-2xl font-black text-gov-950">{title}</h2><p className="mx-auto mt-2 max-w-xl font-semibold leading-7 text-slate-600">{message}</p><Button type="button" variant="primary" className="mt-5" onClick={onRetry}>Coba Lagi</Button></GlassCard>;
}

function TrackingResult({ data, lastUpdated }: { data: TrackingDocument; lastUpdated: Date | null }) {
    const history = useMemo(() => [...(data.tracking_pengajuan ?? [])].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()), [data.tracking_pengajuan]);
    const currentStatus = data.status ?? history.at(-1)?.status ?? "Diajukan";
    const current = normalize(currentStatus);
    const terminal = terminalStatus[current];
    const activeIndex = trackingSteps.reduce((highest, step, index) => history.some((item) => step.aliases.some((alias) => normalize(item.status).includes(alias))) || step.aliases.some((alias) => current.includes(alias)) ? index : highest, 0);
    const serviceName = data.layanan?.nama ?? data.layanan?.title ?? data.jenis_surat ?? "Dokumen Kelurahan";

    return <GlassCard className="rounded-[32px] bg-white/95 p-5 shadow-[0_24px_80px_rgba(13,62,42,.14)] sm:p-8"><div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><span className="font-black uppercase tracking-[.2em] text-accent-600">Status Dokumen</span><h2 className="mt-3 text-3xl font-black text-gov-950">{data.nomor_pengajuan}</h2><p className="mt-2 text-lg font-black text-slate-700">{serviceName}</p></div><span className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black", terminal?.tone === "red" ? "bg-red-100 text-red-700" : terminal?.tone === "amber" ? "bg-amber-100 text-amber-800" : current.includes("selesai") ? "bg-emerald-100 text-emerald-700" : "bg-gov-50 text-gov-900")}><span className="size-2 rounded-full bg-current" />{terminal?.label ?? currentStatus}</span></div><div className="mt-6 grid gap-3 text-sm font-bold text-slate-650 sm:grid-cols-2"><p><b>Nomor Tracking:</b> {data.nomor_pengajuan}</p><p><b>Jenis Dokumen:</b> {serviceName}</p><p><b>Nama Pemohon:</b> {maskName(data.nama_lengkap)}</p><p><b>Tanggal Pengajuan:</b> {formatDate(data.created_at)}</p><p><b>Status Saat Ini:</b> {currentStatus}</p><p><b>Update Terakhir:</b> {formatDate(data.updated_at ?? history.at(-1)?.created_at, true)}</p></div><div className="mt-8 rounded-[28px] bg-gov-50 p-4 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-2xl font-black text-gov-950">Timeline Proses</h3><span className="inline-flex items-center gap-2 text-sm font-black text-emerald-700"><RefreshCw size={16} />Status diperbarui realtime</span></div><div className="mt-6 space-y-0">{trackingSteps.map((step, index) => <TimelineItem key={step.key} step={step} index={index} activeIndex={activeIndex} current={current} history={history} terminal={terminal?.label} />)}{terminal ? <TimelineTerminal terminal={terminal} history={history} /> : null}</div></div>{lastUpdated ? <p className="mt-5 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.16em] text-slate-500"><Clock3 size={14} /> Live update terakhir {formatDate(lastUpdated.toISOString(), true)}</p> : null}</GlassCard>;
}

function TimelineItem({ step, index, activeIndex, current, history, terminal }: { step: typeof trackingSteps[number]; index: number; activeIndex: number; current: string; history: TrackingHistory[]; terminal?: string }) {
    const matched = history.find((item) => step.aliases.some((alias) => normalize(item.status).includes(alias)));
    const done = !terminal && index < activeIndex;
    const active = !terminal && index === activeIndex && !current.includes("selesai");
    const complete = !terminal && (done || current.includes("selesai") || index <= activeIndex);
    return <div className="relative flex gap-4 pb-7 last:pb-0"><span className={cn("relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 font-black", complete ? "border-gov-700 bg-gov-700 text-white" : active ? "border-accent-500 bg-accent-300 text-gov-950" : "border-slate-300 bg-white text-slate-400")}>{complete ? <Check size={17} /> : active ? "●" : "○"}</span>{index < trackingSteps.length - 1 ? <span className="absolute left-5 top-10 h-[calc(100%-2.5rem)] w-px bg-slate-200" /> : null}<div className="min-w-0 pt-1"><p className={cn("text-lg font-black", active ? "text-gov-950" : complete ? "text-gov-900" : "text-slate-500")}>{step.label}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{matched?.created_at ? formatDate(matched.created_at, true) : active ? "Sedang diproses" : complete ? step.statusText : "Menunggu"}</p><p className="text-sm font-semibold leading-6 text-slate-500">{matched?.keterangan ?? (complete ? step.statusText : "")}</p></div></div>;
}

function TimelineTerminal({ terminal, history }: { terminal: { label: string; tone: "red" | "amber" }; history: TrackingHistory[] }) {
    const item = [...history].reverse().find((row) => terminalStatus[normalize(row.status)]);
    return <div className="relative flex gap-4 pb-1"><span className={cn("relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 font-black text-white", terminal.tone === "red" ? "border-red-600 bg-red-600" : "border-amber-500 bg-amber-500")}>!</span><div className="min-w-0 pt-1"><p className="text-lg font-black text-gov-950">{terminal.label}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item?.created_at ? formatDate(item.created_at, true) : "Status membutuhkan tindak lanjut."}</p><p className="text-sm font-semibold leading-6 text-slate-500">{item?.keterangan ?? "Silakan ikuti arahan petugas kelurahan."}</p></div></div>;
}