"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { QRCodePelayanan } from "@/components/pengajuan/qr-code-pelayanan";
import { BackButton } from "@/components/warga/back-button";
import { getDokumenUrl, getMyPengajuanDetail, type WargaPengajuan } from "@/services/warga-pengajuan.service";

const journeySteps = ["Pengajuan Dikirim", "Petugas Pelayanan", "Petugas Lapangan", "Kepala Seksi", "Seklur", "Lurah", "Selesai"];

type TrackingStage = {
    nama_tahap: string;
    status: string;
    catatan: string | null;
    acted_at: string | null;
    approved_at: string | null;
    updated_at: string | null;
    tahap: number;
};

type StepState = "done" | "active" | "waiting";

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(" pukul ", ", ") : "-";
}

function formatStepDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return `${date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} - ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}

function docUrl(url?: string | null) { return getDokumenUrl(url) || ""; }

function docLabel(jenis?: string | null, namaFile?: string | null) {
    const value = jenis || namaFile || "Dokumen";
    if (value.toLowerCase().includes("pendukung")) return "Dokumen Pendukung";
    return value.toUpperCase();
}

function serviceName(item: WargaPengajuan) {
    return item.layanan?.nama || item.keperluan || "Layanan Pengajuan";
}

function normalizeStage(stage: NonNullable<WargaPengajuan["verifikasi_pengajuan"]>[number]): TrackingStage {
    const name = stage.nama_tahap === "Staff Pelayanan" ? "Petugas Pelayanan" : stage.nama_tahap ?? "Tahap Verifikasi";
    return { nama_tahap: name, status: stage.status ?? "Menunggu", catatan: stage.catatan ?? null, acted_at: stage.acted_at ?? null, approved_at: stage.approved_at ?? null, updated_at: stage.updated_at ?? null, tahap: stage.tahap ?? 0 };
}

function isDoneStatus(status?: string | null) {
    return ["disetujui", "selesai", "approved", "processed", "done"].includes((status ?? "").toLowerCase());
}

function isActiveStatus(status?: string | null) {
    return ["diproses", "proses", "pending", "in_progress"].includes((status ?? "").toLowerCase());
}

function timelineFrom(item: WargaPengajuan): TrackingStage[] {
    const stages = [...(item.verifikasi_pengajuan ?? [])].sort((a, b) => (a.tahap ?? 0) - (b.tahap ?? 0)).map(normalizeStage);
    const byName = new Map(stages.map((stage) => [stage.nama_tahap.toLowerCase(), stage]));
    const complete = ["selesai", "disetujui", "approved", "completed"].includes((item.status ?? "").toLowerCase()) || Boolean(item.selesai_at);
    const lastDone = stages.reduce((max, stage) => isDoneStatus(stage.status) ? Math.max(max, journeySteps.findIndex((step) => step.toLowerCase() === stage.nama_tahap.toLowerCase())) : max, 0);
    const activeIndex = complete ? journeySteps.length - 1 : Math.max(1, stages.findIndex((stage) => isActiveStatus(stage.status)) + 1 || lastDone + 1);

    return journeySteps.map((step, index) => {
        const existing = byName.get(step.toLowerCase());
        if (existing) return existing;
        const status = complete || index === 0 || index <= lastDone ? "Disetujui" : index === activeIndex ? "Diproses" : "Menunggu";
        return { nama_tahap: step, status, catatan: null, acted_at: index === 0 ? item.created_at ?? null : index === journeySteps.length - 1 ? item.selesai_at ?? null : null, approved_at: null, updated_at: null, tahap: index };
    });
}

function stepState(stage: TrackingStage, itemComplete: boolean): StepState {
    if (itemComplete || isDoneStatus(stage.status)) return "done";
    if (isActiveStatus(stage.status)) return "active";
    return "waiting";
}

function statusSummary(item: WargaPengajuan, timeline: TrackingStage[]) {
    const complete = ["selesai", "disetujui", "approved", "completed"].includes((item.status ?? "").toLowerCase()) || Boolean(item.selesai_at);
    if (complete) return { label: "Pengajuan Selesai", icon: "✓", className: "bg-emerald-100 text-emerald-800 ring-emerald-200", message: "Dokumen Anda telah selesai diproses." };
    const active = timeline.find((stage) => isActiveStatus(stage.status));
    return { label: "Sedang Diproses", icon: "●", className: "bg-[#FFF3B0] text-[#8A5A00] ring-[#FFC400]", message: `Pengajuan Anda sedang diproses oleh ${active?.nama_tahap ?? "petugas"}.` };
}

export default function DetailPengajuanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const toast = useToast();
    const { user, profile, loading } = useWargaAuth();
    const [item, setItem] = useState<WargaPengajuan | null>(null);
    const [fetching, setFetching] = useState(true);
    const notifiedStatus = useRef<string | null>(null);

    function goBack() {
        if (window.history.length > 1 && document.referrer.includes(window.location.origin)) router.back();
        else router.push("/dashboard");
    }

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user || !profile) { if (!loading) setFetching(false); return; } void (async () => { try { setFetching(true); setItem(await getMyPengajuanDetail(id, profile)); } catch (error) { console.error(error); setItem(null); } finally { setFetching(false); } })(); }, [loading, user, profile, id]);

    const timeline = useMemo(() => item ? timelineFrom(item) : [], [item]);
    const summary = useMemo(() => item ? statusSummary(item, timeline) : null, [item, timeline]);

    useEffect(() => {
        if (!item || !summary) return;
        const active = timeline.find((stage) => isActiveStatus(stage.status));
        const key = `${item.id}-${item.status}-${active?.nama_tahap}`;
        if (notifiedStatus.current === key) return;
        notifiedStatus.current = key;
        if (summary.label === "Pengajuan Selesai") toast.success("Pengajuan telah selesai");
        else if (active) toast.info(`Pengajuan diteruskan ke ${active.nama_tahap}`);
    }, [item, summary, timeline, toast]);

    if (loading || !user || fetching) return <main className="min-h-screen bg-[#F7F8F5] p-10 font-black text-[#172033]">Memuat status pengajuan...</main>;
    if (!item) return <main className="min-h-screen bg-[#F7F8F5] px-5 py-16 sm:px-10 lg:px-20"><section className="mx-auto max-w-2xl rounded-[28px] border border-[#E8E8E8] bg-white p-8 text-center shadow-sm"><h1 className="text-3xl font-black text-[#172033]">Pengajuan tidak ditemukan.</h1><p className="mt-4 leading-7 text-slate-600">Data tidak tersedia atau bukan milik akun warga yang sedang login.</p><Button type="button" className="mt-6" variant="gold" onClick={goBack}>Kembali ke Dashboard</Button></section></main>;

    const documents = (item.dokumen_pengajuan ?? []).filter((doc) => Boolean(doc.url_file));
    const name = serviceName(item);
    const complete = summary?.label === "Pengajuan Selesai";

    return <main className="min-h-screen bg-[#F7F8F5] px-4 py-6 text-[#172033] sm:px-8 lg:px-16"><section className="mx-auto max-w-6xl"><BackButton onClick={() => router.push("/dashboard")} className="mb-4" />
        <header className="rounded-[30px] border border-[#E8E8E8] bg-[linear-gradient(135deg,#FFF3B0,#FFFFFF_50%,#EAF8EF)] p-6 shadow-sm sm:p-8"><p className="text-sm font-black uppercase tracking-[.18em] text-[#15803D]">Status Pengajuan</p><h1 className="mt-3 break-words text-3xl font-black sm:text-5xl">{item.nomor_pengajuan}</h1><p className="mt-3 text-lg font-black uppercase text-slate-700">{name}</p><div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ring-1 ${summary?.className}`}><span>{summary?.icon}</span>{summary?.label}</div><p className="mt-3 max-w-2xl font-semibold text-slate-600">{summary?.message}</p>{complete ? <p className="mt-2 font-black text-emerald-700">Silakan lihat atau download dokumen Anda.</p> : null}</header>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]"><div className="space-y-6"><section className="rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Informasi Pengajuan</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Nomor Pengajuan" value={item.nomor_pengajuan || "-"} /><Info label="Layanan" value={name} /><Info label="Keperluan" value={item.keperluan || "-"} /><Info label="Tanggal Pengajuan" value={formatDate(item.created_at)} /><Info label="Status" value={`${summary?.icon ?? "○"} ${summary?.label ?? "Menunggu proses"}`} /></div></section>
            <section className="rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Perjalanan Dokumen</h2><div className="mt-6">{timeline.map((stage, index) => <JourneyItem key={`${stage.nama_tahap}-${index}`} stage={stage} index={index} state={stepState(stage, complete)} isLast={index === timeline.length - 1} />)}</div></section>
            <section className="rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Dokumen Pengajuan</h2>{documents.length ? <div className="mt-4 divide-y divide-slate-100">{documents.map((doc) => { const label = docLabel(doc.jenis, doc.nama_file); const url = docUrl(doc.url_file); return <div key={doc.id ?? `${item.id}-${doc.url_file}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100"><FileText size={18} /></span><div><p className="font-black">{label}</p><p className="text-xs font-bold text-slate-500">{formatDate(doc.created_at ?? item.created_at)}</p></div></div>{url ? <div className="flex gap-2"><a className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#DADDE3] bg-white px-4 text-sm font-black hover:bg-slate-50" href={url} target="_blank" rel="noreferrer">Lihat</a><a className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#FFC400] px-4 text-sm font-black hover:bg-[#FFD84D]" href={url} download>Download</a></div> : null}</div>; })}</div> : <p className="mt-4 font-bold text-slate-500">Belum ada dokumen untuk pengajuan ini.</p>}</section></div>
            <aside className="lg:sticky lg:top-6 lg:h-fit"><QRCodePelayanan nomorPengajuan={item.nomor_pengajuan} status={summary?.label} tanggal={formatDate(item.created_at)} layanan={name} size={170} /></aside></div>
        <button type="button" onClick={goBack} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#172033] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#2A3448]"><ArrowLeft size={18} />Kembali ke Dashboard</button></section></main>;
}

function Info({ label, value }: { label: string; value: string }) {
    return <div className="rounded-2xl bg-[#F7F8F5] p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-1 break-words font-black text-[#172033]">{value}</p></div>;
}

function JourneyItem({ stage, index, state, isLast }: { stage: TrackingStage; index: number; state: StepState; isLast: boolean }) {
    const timestamp = stage.acted_at || stage.approved_at || stage.updated_at;
    const tone = state === "done" ? { icon: "✓", badge: "bg-[#16A34A] text-white", text: "Sudah diproses", card: "bg-emerald-50/70 border-emerald-100" } : state === "active" ? { icon: "●", badge: "bg-[#FFC400] text-[#172033]", text: "Sedang diproses", card: "bg-[#FFF8DB] border-[#FFC400]" } : { icon: "○", badge: "bg-slate-100 text-slate-500", text: "Menunggu proses", card: "bg-white border-slate-100" };
    return <div className="grid grid-cols-[44px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-black ${tone.badge}`}>{tone.icon}</span>{!isLast ? <span className="my-2 h-full min-h-8 w-0.5 bg-slate-200" /> : null}</div><div className={`mb-3 rounded-2xl border p-4 ${tone.card}`}><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Tahap {index + 1}</p><h3 className="mt-1 text-lg font-black">{stage.nama_tahap}</h3><p className="mt-1 font-black text-slate-700">{tone.text}</p>{state === "active" ? <p className="mt-1 text-sm font-semibold text-slate-600">Pengajuan Anda sedang diproses oleh {stage.nama_tahap}.</p> : null}{stage.catatan ? <p className="mt-2 text-sm font-semibold text-slate-500">{stage.catatan}</p> : null}{timestamp ? <p className="mt-2 text-sm font-black text-slate-500">{formatStepDate(timestamp)}</p> : null}</div></div>;
}