"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, FilePenLine, Headphones, Loader2, LogOut, ShieldX } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { isVerified, logoutWarga } from "@/services/warga-auth.service";
import { site } from "@/constants/site";

export default function VerificationRejectedPage() {
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
        if (!loading && user && isVerified(profile)) router.replace("/dashboard");
        if (!loading && user && profile && profile.status_verifikasi !== "Ditolak" && !isVerified(profile)) router.replace("/verify");
    }, [loading, profile, router, user]);

    async function logout() {
        await logoutWarga();
        router.replace("/login");
    }

    if (loading || !user) {
        return <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-5 text-gov-950"><Loader2 className="mr-3 size-5 animate-spin text-accent-500" /><span className="font-black">Memuat status verifikasi...</span></main>;
    }

    return <main className="relative min-h-screen overflow-hidden bg-[#F7F9FC] px-5 py-12 text-slate-800 sm:px-10 lg:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(239,68,68,.16),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(11,44,106,.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_48%,#eef4ff_100%)]" />
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: "easeOut" }} className="relative mx-auto grid max-w-[1100px] gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-stretch">
            <aside className="overflow-hidden rounded-[36px] border border-white/30 bg-[linear-gradient(145deg,#071a33,#0B2C6A_58%,#123b85)] p-8 text-white shadow-[0_32px_90px_rgba(11,44,106,.24)] sm:p-10">
                <div className="inline-flex items-center gap-3 rounded-full border border-red-200/30 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-red-100 backdrop-blur"><ShieldX className="size-4" /> Verifikasi Ditolak</div>
                <h1 className="mt-8 text-4xl font-black leading-tight md:text-6xl">Data Perlu Diperbaiki</h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-white/78">Petugas Kelurahan Tamansari menemukan data yang belum sesuai. Silakan perbaiki data agar dapat diverifikasi ulang.</p>
                <div className="mt-10 rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl"><p className="text-xs font-black uppercase tracking-[.2em] text-red-100">Keamanan Identitas</p><p className="mt-2 text-xl font-black">Dashboard dan layanan dikunci sementara sampai data valid.</p></div>
            </aside>
            <section className="rounded-[36px] border border-white/70 bg-white/82 p-6 shadow-[0_28px_90px_rgba(15,39,72,.13)] backdrop-blur-2xl sm:p-8 lg:p-10">
                <div className="mx-auto grid size-20 place-items-center rounded-[28px] border border-red-200 bg-red-50 text-red-700 shadow-[0_18px_45px_rgba(239,68,68,.16)]"><AlertTriangle className="size-10" /></div>
                <div className="mt-6 text-center"><p className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700">Status: Ditolak</p><h2 className="mt-5 text-3xl font-black text-gov-950 sm:text-4xl">Verifikasi Akun Ditolak</h2><p className="mx-auto mt-4 max-w-2xl leading-8 text-slate-600">Mohon cek alasan penolakan dari petugas, lalu perbaiki data profil warga Anda.</p></div>
                <div className="mt-8 rounded-[28px] border border-red-100 bg-[linear-gradient(135deg,#fff5f5,#ffffff)] p-6 shadow-soft"><p className="text-xs font-black uppercase tracking-[.18em] text-red-600">Alasan Penolakan</p><p className="mt-3 text-lg font-black leading-8 text-gov-950">{profile?.alasan_penolakan?.trim() || "Petugas belum menuliskan alasan detail. Silakan hubungi TAMSAR CS untuk informasi lebih lanjut."}</p></div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"><Button type="button" variant="gold" href="/profil" className="sm:min-w-52"><FilePenLine className="size-5" />Perbaiki Data</Button><Button type="button" variant="glass" href={site.wa} target="_blank" rel="noreferrer" className="sm:min-w-52"><Headphones className="size-5" />Hubungi TAMSAR CS</Button><Button type="button" variant="glass" onClick={logout} className="sm:min-w-40"><LogOut className="size-5" />Logout</Button></div>
                <p className="mt-6 text-center text-sm font-bold text-slate-500">Setelah data diperbaiki, petugas dapat melakukan verifikasi ulang. <ArrowRight className="inline size-4" /></p>
            </section>
        </motion.section>
    </main>;
}