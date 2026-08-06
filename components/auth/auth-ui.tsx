"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/utils/cn";

export const authInputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-bold text-gov-950 outline-none transition focus:ring-4 focus:ring-accent-200";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-16 text-slate-800 sm:px-10 lg:px-20"><div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[1fr_.9fr] lg:items-center"><motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5 }} className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_20%_20%,rgba(255,197,51,.35),transparent_34%),linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_32px_90px_rgba(11,44,106,.22)] sm:p-10"><span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-accent-200">Pemerintah Digital</span><h1 className="mt-8 text-4xl font-black leading-tight md:text-6xl">Identitas warga untuk semua layanan kelurahan.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-white/80">Akses layanan digital, pantau pengajuan, kelola dokumen, dan terima notifikasi secara aman melalui akun warga Tamansari.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{["Supabase Auth", "JWT Session", "Role Warga"].map((item) => <div key={item} className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur"><ShieldCheck className="text-accent-300" /><p className="mt-3 font-black">{item}</p></div>)}</div></motion.section><motion.section initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .5 }} className="rounded-[32px] border border-white bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,39,72,.12)] backdrop-blur-xl sm:p-8"><h2 className="text-3xl font-black text-gov-950">{title}</h2><p className="mt-3 leading-7 text-slate-600">{subtitle}</p>{children}</motion.section></div></main>;
}

export function AuthField({ label, children, error, className }: { label: string; children: ReactNode; error?: string; className?: string }) {
    return <label className={cn("block", className)}><span className="mb-2 block text-sm font-black text-gov-950">{label}</span>{children}{error ? <span className="mt-2 block text-xs font-bold text-red-600">{error}</span> : null}</label>;
}