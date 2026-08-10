"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

export const authInputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-bold text-gov-950 outline-none transition focus:ring-4 focus:ring-accent-200";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-16 text-slate-800 sm:px-10 lg:px-20"><div className="mx-auto grid max-w-xl gap-8"><motion.section initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .5 }} className="rounded-[32px] border border-white bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,39,72,.12)] backdrop-blur-xl sm:p-8"><h2 className="text-3xl font-black text-gov-950">{title}</h2><p className="mt-3 leading-7 text-slate-600">{subtitle}</p>{children}</motion.section></div></main>;
}

export function AuthField({ label, children, error, className }: { label: string; children: ReactNode; error?: string; className?: string }) {
    return <label className={cn("block", className)}><span className="mb-2 block text-sm font-black text-gov-950">{label}</span>{children}{error ? <span className="mt-2 block text-xs font-bold text-red-600">{error}</span> : null}</label>;
}