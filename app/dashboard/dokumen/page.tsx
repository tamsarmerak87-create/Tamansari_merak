"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { BackButton } from "@/components/warga/back-button";
import { getDokumenUrl, getMyDocumentsFromPengajuan, getMyPengajuan, type DokumenPengajuan } from "@/services/warga-pengajuan.service";

export default function DokumenSayaPage() {
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();
    const [docs, setDocs] = useState<DokumenPengajuan[]>([]);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user || !profile) { if (!loading) setFetching(false); return; } void refresh(); }, [loading, user, profile]);

    async function refresh() {
        if (!profile) return;
        try {
            setFetching(true);
            setError("");
            const items = await getMyPengajuan(profile);
            setDocs(getMyDocumentsFromPengajuan(items));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Data belum dapat dimuat.");
        } finally {
            setFetching(false);
        }
    }

    const grouped = useMemo(() => docs, [docs]);

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat dokumen...</main>;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-6xl space-y-6"><BackButton /><Hero title="Dokumen Saya" text="Semua dokumen ditarik dari data pengajuan milik akun yang sedang login." /><div className="flex justify-end"><Button type="button" variant="glass" onClick={() => void refresh()}><RefreshCw size={18} /> Refresh</Button></div>{fetching ? <State text="Memuat dokumen..." /> : error ? <State text={error} retry onRetry={refresh} /> : grouped.length === 0 ? <Empty /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{grouped.map((doc) => <DocumentCard key={doc.id ?? `${doc.pengajuan_id}-${doc.url_file}`} doc={doc} />)}</div>}</section></main>;
}

function DocumentCard({ doc }: { doc: DokumenPengajuan }) {
    const href = getDokumenUrl(doc.url_file);
    return <article className="rounded-[26px] border border-white bg-white p-5 shadow-soft"><div className="flex items-start justify-between gap-3"><div><FileText className="text-accent-400" /><p className="mt-3 text-lg font-black text-gov-950">{doc.nama_file || doc.jenis || "Dokumen"}</p><p className="mt-1 text-sm font-bold text-slate-500">No. Agenda: {doc.nomor_pengajuan || "-"}</p><p className="mt-1 text-xs font-bold text-slate-400">Status: {doc.status || "Tersedia"}</p></div><span className="rounded-full bg-gov-50 px-3 py-1 text-xs font-black text-gov-900 ring-1 ring-slate-200">{doc.jenis || "File"}</span></div>{href ? <div className="mt-5 flex flex-wrap gap-2"><a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-border-soft bg-white px-4 py-3 text-sm font-black text-gov-900 shadow-soft"><Eye size={16} /> Lihat</a><a href={href} download className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-accent-400 px-4 py-3 text-sm font-black text-gov-950 shadow-soft"><Download size={16} /> Download</a></div> : <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">Dokumen tidak tersedia.</p>}</article>;
}

function Hero({ title, text }: { title: string; text: string }) { return <div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><p className="font-black uppercase tracking-[.2em] text-accent-200">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">{title}</h1><p className="mt-3 text-white/75">{text}</p></div>; }
function State({ text, retry, onRetry }: { text: string; retry?: boolean; onRetry?: () => Promise<void> }) { return <section className="rounded-[24px] border border-white bg-white/85 p-8 text-center shadow-soft"><p className="font-bold text-slate-600">{text}</p>{retry && onRetry ? <button onClick={() => void onRetry()} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black">Coba Lagi</button> : null}</section>; }
function Empty() { return <section className="rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-10 text-center shadow-soft"><p className="font-bold text-slate-600">Belum ada dokumen.</p></section>; }