"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, Clock3, Headphones, Loader2, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { isVerified, logoutWarga } from "@/services/warga-auth.service";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { site } from "@/constants/site";
import { cn } from "@/utils/cn";

const timeline = [
    { label: "Akun dibuat", state: "done" },
    { label: "Profil tersimpan", state: "done" },
    { label: "Menunggu verifikasi petugas", state: "current" },
    { label: "Akun aktif", state: "upcoming" },
] as const;

export default function VerifyPage() {
    const router = useRouter();
    const { user, profile, loading, refresh } = useWargaAuth();
    const [checking, setChecking] = useState(false);

    const verified = useMemo(() => isVerified(profile) || profile?.status_verifikasi === "Terverifikasi", [profile]);

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
    }, [loading, router, user]);

    useEffect(() => {
        if (verified) router.replace("/dashboard");
    }, [router, verified]);

    useEffect(() => {
        if (!loading && profile?.status_verifikasi === "Ditolak") router.replace("/verification-rejected");
    }, [loading, profile?.status_verifikasi, router]);

    useEffect(() => {
        if (!user || verified) return;
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;
        const channel = supabase
            .channel(`warga-verification:${user.id}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "warga_profiles", filter: `id=eq.${user.id}` }, (payload) => {
                const next = payload.new as { status_verifikasi?: string };
                if (next.status_verifikasi === "Terverifikasi" || next.status_verifikasi === "Akun Terverifikasi") router.replace("/dashboard");
                if (next.status_verifikasi === "Ditolak") router.replace("/verification-rejected");
                void refresh();
            })
            .subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [refresh, router, user, verified]);

    async function logout() {
        await logoutWarga();
        router.replace("/login");
    }

    const checkStatus = useCallback(async () => {
        try {
            setChecking(true);
            await refresh();
        } finally {
            setChecking(false);
        }
    }, [refresh]);

    if (loading || !user) {
        return <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-5 text-gov-950"><Loader2 className="mr-3 size-5 animate-spin text-accent-500" /><span className="font-black">Memuat status verifikasi...</span></main>;
    }

    return <main className="relative min-h-screen overflow-hidden bg-[#F7F9FC] px-5 py-12 text-slate-800 sm:px-10 lg:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(255,197,51,.28),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(11,44,106,.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_48%,#eef4ff_100%)]" />
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: "easeOut" }} className="relative mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-stretch">
            <aside className="overflow-hidden rounded-[36px] border border-white/30 bg-[linear-gradient(145deg,#071a33,#0B2C6A_58%,#123b85)] p-8 text-white shadow-[0_32px_90px_rgba(11,44,106,.24)] sm:p-10">
                <motion.div initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .1 }} className="inline-flex items-center gap-3 rounded-full border border-accent-200/30 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-accent-200 backdrop-blur">
                    <ShieldCheck className="size-4" /> Verifikasi Kelurahan
                </motion.div>
                <h1 className="mt-8 text-4xl font-black leading-tight md:text-6xl">Pendaftaran Berhasil</h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-white/78">Data akun warga sudah masuk ke sistem Kelurahan Tamansari dan akan diperiksa langsung oleh petugas berwenang.</p>
                <div className="mt-10 rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <span className="grid size-14 place-items-center rounded-2xl bg-accent-300 text-2xl shadow-[0_16px_35px_rgba(255,197,51,.28)]">✅</span>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[.2em] text-accent-200">Shield Check</p>
                            <p className="mt-1 text-xl font-black">Identitas diterima sistem</p>
                        </div>
                    </div>
                </div>
            </aside>

            <section className="rounded-[36px] border border-white/70 bg-white/78 p-6 shadow-[0_28px_90px_rgba(15,39,72,.13)] backdrop-blur-2xl sm:p-8 lg:p-10">
                <motion.div initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12 }} className="mx-auto grid size-20 place-items-center rounded-[28px] border border-accent-200/60 bg-[linear-gradient(135deg,#fff8dc,#ffffff)] text-gov-950 shadow-[0_18px_45px_rgba(255,197,51,.25)]">
                    <ShieldCheck className="size-10 text-gov-950" />
                </motion.div>

                <div className="mt-6 text-center">
                    <p className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700"><span>🟡</span> Menunggu Verifikasi Petugas</p>
                    <h2 className="mt-5 text-3xl font-black text-gov-950 sm:text-4xl">Pendaftaran Berhasil</h2>
                    <p className="mx-auto mt-4 max-w-2xl leading-8 text-slate-600">Data Anda telah berhasil didaftarkan. Petugas Kelurahan Tamansari akan memverifikasi identitas berdasarkan NIK, KK dan data yang diinput.</p>
                </div>

                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[26px] border border-gov-100 bg-white/72 p-5 shadow-soft backdrop-blur">
                        <p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Status saat ini</p>
                        <p className="mt-2 text-lg font-black text-gov-950">{profile?.status_verifikasi ?? "Belum Terverifikasi"}</p>
                    </div>
                    <div className="rounded-[26px] border border-accent-200/70 bg-[linear-gradient(135deg,#fff7d6,#ffffff)] p-5 shadow-soft backdrop-blur">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-slate-500"><Clock3 className="size-4 text-accent-500" /> Estimasi</p>
                        <p className="mt-2 text-lg font-black text-gov-950">1 × 24 Jam Kerja</p>
                    </div>
                </div>

                <div className="mt-8 rounded-[28px] border border-white bg-white/72 p-5 shadow-soft backdrop-blur-xl sm:p-6">
                    <p className="text-sm font-black uppercase tracking-[.18em] text-gov-950">Progress Verifikasi</p>
                    <div className="mt-5 space-y-4">
                        {timeline.map((item, index) => <motion.div key={item.label} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .16 + index * .06 }} className="flex items-center gap-4">
                            <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border text-sm font-black", item.state === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700", item.state === "current" && "border-accent-300 bg-accent-100 text-gov-950", item.state === "upcoming" && "border-slate-200 bg-white text-slate-400")}>{item.state === "done" ? <Check className="size-5" /> : item.state === "current" ? "⏳" : "○"}</span>
                            <div className="min-w-0 flex-1">
                                <p className={cn("font-black", item.state === "upcoming" ? "text-slate-400" : "text-gov-950")}>{item.state === "done" ? "✓ " : item.state === "current" ? "⏳ " : "○ "}{item.label}</p>
                                {index < timeline.length - 1 ? <div className="mt-3 h-px bg-gradient-to-r from-gov-100 via-accent-100 to-transparent" /> : null}
                            </div>
                        </motion.div>)}
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button type="button" variant="gold" onClick={checkStatus} disabled={checking} className="sm:min-w-56">
                        {checking ? <Loader2 className="size-5 animate-spin" /> : <RefreshCw className="size-5" />}
                        {checking ? "Mengecek..." : "Refresh Status"}
                    </Button>
                    <Button type="button" variant="glass" href={site.wa} target="_blank" rel="noreferrer" className="sm:min-w-52"><Headphones className="size-5" />Hubungi TAMSAR CS</Button>
                    <Button type="button" variant="glass" onClick={logout} className="sm:min-w-40"><LogOut className="size-5" />Logout</Button>
                </div>

                <p className="mt-6 text-center text-sm font-bold text-slate-500">Jika status berubah menjadi Terverifikasi, Anda akan otomatis diarahkan ke Dashboard Warga. <ArrowRight className="inline size-4" /></p>
            </section>
        </motion.section>
    </main>;
}