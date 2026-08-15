"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { BackButton } from "@/components/warga/back-button";
import { buildTrackingNotifications, getMyNotifikasi, getMyPengajuan, markAllNotificationsRead, markNotificationRead, type WargaNotification } from "@/services/warga-pengajuan.service";

export default function NotifikasiPage() {
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();
    const [notes, setNotes] = useState<WargaNotification[]>([]);
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
            setNotes(await getMyNotifikasi(items).catch(() => buildTrackingNotifications(items)));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Data belum dapat dimuat.");
        } finally {
            setFetching(false);
        }
    }

    async function openNote(note: WargaNotification) {
        await markNotificationRead(note.id).catch(() => undefined);
        setNotes((current) => current.map((item) => item.id === note.id ? { ...item, read: true } : item));
        if (note.pengajuan_id) router.push(`/dashboard/pengajuan/${note.pengajuan_id}`);
    }

    async function markAll() {
        await markAllNotificationsRead().catch(() => undefined);
        setNotes((current) => current.map((item) => ({ ...item, read: true })));
    }

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat notifikasi...</main>;

    const unread = notes.filter((n) => !n.read).length;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-4xl space-y-6"><BackButton /><Hero title="Notifikasi" text="Notifikasi diambil dari database milik akun yang sedang login." /><div className="flex flex-wrap gap-3"><Button type="button" variant="gold" onClick={() => void markAll()}><CheckCheck size={18} /> Tandai semua dibaca</Button><Button type="button" variant="glass" onClick={() => void refresh()}><RefreshCw size={18} /> Refresh</Button><span className="inline-flex items-center rounded-full bg-amber-100 px-4 py-2 text-sm font-black text-amber-800">Notifikasi {unread}</span></div>{fetching ? <State text="Memuat notifikasi..." /> : error ? <State text={error} retry onRetry={refresh} /> : notes.length === 0 ? <State text="Belum ada notifikasi." /> : <div className="space-y-3">{notes.map((note) => <button key={note.id} onClick={() => void openNote(note)} className={`w-full rounded-[22px] border p-5 text-left shadow-soft transition hover:-translate-y-0.5 ${note.read ? "border-white bg-white" : "border-amber-200 bg-amber-50"}`}><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Bell size={18} className={note.read ? "text-slate-400" : "text-amber-600"} /><p className="text-lg font-black text-gov-950">{note.title}</p></div><p className="mt-2 text-sm text-slate-600">{note.message}</p><p className="mt-2 text-xs font-bold text-slate-400">{note.created_at ? new Date(note.created_at).toLocaleString("id-ID") : "-"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${note.read ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{note.read ? "Dibaca" : "Belum dibaca"}</span></div></button>)}</div>}</section></main>;
}

function Hero({ title, text }: { title: string; text: string }) { return <div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><p className="font-black uppercase tracking-[.2em] text-accent-200">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">{title}</h1><p className="mt-3 text-white/75">{text}</p></div>; }
function State({ text, retry, onRetry }: { text: string; retry?: boolean; onRetry?: () => Promise<void> }) { return <section className="rounded-[24px] border border-white bg-white/85 p-8 text-center shadow-soft"><p className="font-bold text-slate-600">{text}</p>{retry && onRetry ? <button onClick={() => void onRetry()} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black">Coba Lagi</button> : null}</section>; }