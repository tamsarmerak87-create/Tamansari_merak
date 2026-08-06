"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Clock3, FileText, Menu, Search, ShieldCheck, Users2, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PublicService } from "@/types";
import { cn } from "@/utils/cn";

type Props = { services: PublicService[] };
const PER_PAGE = 5;
const AUTO_MS = 5000;
const SWIPE = 70;
const fadeUp = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };

function pagesOf<T>(items: T[]) {
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));
    return pages.length ? pages : [[]];
}

export function LayananCatalog({ services }: Props) {
    const [query, setQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [page, setPage] = useState(0);
    const [detail, setDetail] = useState<PublicService | null>(null);

    const adminServices = useMemo(() => services.filter((s) => s.category === "administrasi").slice(0, 33), [services]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return adminServices;
        return adminServices.filter((s) => `${s.title} ${s.description}`.toLowerCase().includes(q));
    }, [adminServices, query]);
    const pages = useMemo(() => pagesOf(filtered), [filtered]);
    const total = pages.length;
    const safePage = Math.min(page, total - 1);
    const visible = pages[safePage] ?? [];
    const go = useCallback((target: number) => setPage((target + total) % total), [total]);
    const prev = useCallback(() => go(safePage - 1), [go, safePage]);
    const next = useCallback(() => go(safePage + 1), [go, safePage]);

    useEffect(() => {
        if (total <= 1 || detail) return;
        const id = window.setInterval(next, AUTO_MS);
        return () => window.clearInterval(id);
    }, [detail, next, total]);
    useEffect(() => {
        if (!detail) return;
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDetail(null);
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }, [detail]);

    return (
        <>
            <Header query={query} showSearch={showSearch} setQuery={(value) => { setQuery(value); setPage(0); }} toggleSearch={() => setShowSearch((v) => !v)} />
            <section className="relative px-5 pb-20 pt-28 sm:px-8 lg:px-12 xl:px-20">
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><div className="absolute -left-24 top-20 size-80 rounded-full bg-[#D4A017]/10 blur-3xl" /><div className="absolute -right-28 top-44 size-96 rounded-full bg-[#0D2B5C]/10 blur-3xl" /></div>
                <div className="relative mx-auto max-w-7xl">
                    <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.45 }} className="overflow-hidden rounded-[28px] border border-white bg-white p-6 shadow-[0_24px_70px_rgba(13,43,92,0.10)] sm:p-8 lg:p-10">
                        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-3xl"><div className="flex items-center gap-3"><span className="grid size-14 place-items-center rounded-[22px] bg-[#EAF1FF] text-[#0D2B5C]"><FileText size={26} /></span><span className="text-xs font-black uppercase tracking-[0.26em] text-[#D4A017]">Administrasi</span></div><h1 className="mt-6 font-display text-[clamp(40px,7vw,78px)] font-black leading-[0.96] tracking-[-0.05em] text-[#0D2B5C]">33 Jenis Pelayanan</h1><p className="mt-5 text-lg font-semibold leading-8 text-slate-600 sm:text-xl">Pilih layanan yang Anda butuhkan dengan mudah.</p><div className="mt-6 h-1.5 w-32 rounded-full bg-[#0D2B5C]" /></div>
                            <div className="relative min-h-44 overflow-hidden rounded-[28px] bg-[#0D2B5C] p-5 text-white shadow-[0_20px_50px_rgba(13,43,92,0.24)] lg:w-[360px]"><div className="absolute -right-12 -top-12 size-40 rounded-full bg-[#D4A017]/25" /><Building2 className="relative text-[#D4A017]" size={42} /><p className="relative mt-8 text-4xl font-black">{adminServices.length}</p><p className="relative mt-1 text-sm font-bold text-blue-100">layanan administrasi aktif</p></div>
                        </div>
                    </motion.div>
                    <div className="mt-8 overflow-hidden rounded-[28px]"><AnimatePresence mode="wait"><motion.div key={`${safePage}-${query}`} drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x < -SWIPE) next(); if (info.offset.x > SWIPE) prev(); }} initial={{ opacity: 0, x: 34 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -34 }} transition={{ duration: 0.35 }} className="grid touch-pan-y gap-4 md:grid-cols-2 xl:grid-cols-4">{visible.map((service, i) => <ServiceCard key={service.id} service={service} number={safePage * PER_PAGE + i + 1} onDetail={() => setDetail(service)} />)}</motion.div></AnimatePresence></div>
                    {visible.length === 0 ? <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-8 text-center font-black text-[#0D2B5C] shadow-[0_18px_45px_rgba(13,43,92,0.08)]">Layanan tidak ditemukan.</div> : null}
                    <InfoBanner />
                    <Pager page={safePage} total={total} prev={prev} next={next} go={go} />
                    <BottomInfo />
                </div>
            </section>
            <AnimatePresence>{detail ? <DetailModal service={detail} onClose={() => setDetail(null)} /> : null}</AnimatePresence>
        </>
    );
}

const Header = memo(function Header({ query, showSearch, setQuery, toggleSearch }: { query: string; showSearch: boolean; setQuery: (v: string) => void; toggleSearch: () => void }) {
    return <header className="fixed inset-x-0 top-0 z-[120] border-b border-white/60 bg-white/72 px-5 py-3 shadow-[0_10px_35px_rgba(13,43,92,0.08)] backdrop-blur-xl sm:px-8 lg:px-12 xl:px-20"><div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4"><Link href="/" className="flex min-h-11 items-center gap-3 rounded-full pr-3 focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25" aria-label="Kembali ke beranda"><span className="relative grid size-11 place-items-center overflow-hidden rounded-full bg-white shadow-sm"><Image src="/assets/logo-cilegon.png" alt="Logo Cilegon" width={44} height={44} priority sizes="44px" className="object-contain p-1" /></span><span className="leading-tight"><span className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#D4A017]">Pemerintah Kota Cilegon</span><span className="block text-base font-black text-[#0D2B5C]">Kelurahan Tamansari</span></span></Link><div className="flex items-center gap-2">{showSearch ? <motion.input initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 220 }} value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Cari layanan..." className="hidden min-h-11 rounded-full border border-blue-100 bg-white px-5 text-sm font-bold text-[#0D2B5C] outline-none focus:ring-4 focus:ring-[#D4A017]/20 sm:block" /> : null}<button type="button" aria-label="Cari layanan" onClick={toggleSearch} className="grid size-11 place-items-center rounded-full bg-[#EAF1FF] text-[#0D2B5C] transition hover:bg-[#0D2B5C] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25"><Search size={19} /></button><button type="button" aria-label="Menu navigasi" className="grid size-11 place-items-center rounded-full bg-[#0D2B5C] text-white transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25"><Menu size={20} /></button></div></div>{showSearch ? <div className="mx-auto mt-3 max-w-7xl sm:hidden"><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Cari layanan..." className="min-h-11 w-full rounded-full border border-blue-100 bg-white px-5 text-sm font-bold text-[#0D2B5C] outline-none focus:ring-4 focus:ring-[#D4A017]/20" /></div> : null}</header>;
});

const ServiceCard = memo(function ServiceCard({ service, number, onDetail }: { service: PublicService; number: number; onDetail: () => void }) {
    return <motion.article initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.35 }} whileHover={{ y: -3 }} className="group flex min-h-[104px] items-center gap-4 rounded-[22px] border border-[#E3EAF4] bg-white p-[18px] shadow-[0_14px_35px_rgba(13,43,92,0.06)] transition hover:shadow-[0_20px_45px_rgba(13,43,92,0.14)]"><div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#EAF1FF] text-[#0D2B5C]"><FileText size={22} /></div><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0D2B5C] text-sm font-black text-white">{String(number).padStart(2, "0")}</div><h2 className="min-w-0 flex-1 text-base font-black leading-snug text-[#0D2B5C] sm:text-lg">{service.title}</h2><button type="button" onClick={onDetail} aria-label={`Informasi dan ajukan ${service.title}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#EAF1FF] px-4 text-sm font-black text-[#0D2B5C] transition hover:bg-[#0D2B5C] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25"><span className="hidden sm:inline">Informasi & Ajukan</span><ArrowRight size={17} /></button></motion.article>;
});

function InfoBanner() { return <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="relative mt-8 overflow-hidden rounded-[28px] bg-[#0D2B5C] p-6 text-white shadow-[0_24px_70px_rgba(13,43,92,0.18)] sm:p-8"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(212,160,23,.32),transparent_28%)]" /><div className="relative grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center"><div className="flex items-center gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12 text-3xl">💡</span><p className="font-display text-2xl font-black leading-tight sm:text-3xl">Layanan cepat, mudah dan transparan untuk Anda.</p></div><div className="relative hidden h-40 overflow-hidden rounded-[24px] border border-white/15 bg-white/10 lg:block"><Image src="/assets/kantor-tamansari.jpg" alt="Kantor Kelurahan Tamansari" fill sizes="320px" loading="lazy" className="object-cover opacity-90" /></div></div></motion.div>; }

function Pager({ page, total, prev, next, go }: { page: number; total: number; prev: () => void; next: () => void; go: (p: number) => void }) { return <div className="mt-7 flex flex-col items-center justify-center gap-4"><div className="flex items-center justify-center gap-4"><button type="button" aria-label="Sebelumnya" onClick={prev} className="grid size-11 place-items-center rounded-full bg-white text-[#0D2B5C] shadow-[0_12px_28px_rgba(13,43,92,0.10)] transition hover:bg-[#0D2B5C] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25"><ArrowLeft size={18} /></button><p className="min-w-20 text-center text-sm font-black text-[#0D2B5C]">{page + 1} / {total}</p><button type="button" aria-label="Berikutnya" onClick={next} className="grid size-11 place-items-center rounded-full bg-white text-[#0D2B5C] shadow-[0_12px_28px_rgba(13,43,92,0.10)] transition hover:bg-[#0D2B5C] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25"><ArrowRight size={18} /></button></div><div className="flex flex-wrap justify-center gap-2" aria-label="Pagination layanan">{Array.from({ length: total }, (_, i) => <button key={i} type="button" aria-label={`Halaman ${i + 1}`} onClick={() => go(i)} className={cn("h-2.5 rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25", page === i ? "w-8 bg-[#D4A017]" : "w-2.5 bg-[#C8D4E6] hover:bg-[#0D2B5C]")} />)}</div></div>; }

function BottomInfo() { const items = [{ icon: CheckCircle2, label: "Resmi & Terpercaya" }, { icon: Clock3, label: "Proses Cepat" }, { icon: Users2, label: "Melayani Sepenuh Hati" }, { icon: ShieldCheck, label: "Data Aman & Terlindungi" }]; return <div className="mt-9 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map((item, i) => { const Icon = item.icon; return <motion.div key={item.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.04 }} className="flex min-h-16 items-center gap-3 rounded-[22px] border border-[#E3EAF4] bg-white px-5 py-4 shadow-[0_14px_35px_rgba(13,43,92,0.06)]"><Icon className="shrink-0 text-[#D4A017]" size={22} /><p className="font-black text-[#0D2B5C]">{item.label}</p></motion.div>; })}</div>; }

function DetailModal({ service, onClose }: { service: PublicService; onClose: () => void }) { const req = service.requirements?.length ? service.requirements : ["Tidak ada persyaratan."]; const flow = service.flow?.length ? service.flow : ["Belum tersedia."]; return <motion.div className="fixed inset-0 z-[140] grid place-items-center px-4 py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button type="button" aria-label="Tutup detail" className="absolute inset-0 bg-[#0D2B5C]/70 backdrop-blur-sm" onClick={onClose} /><motion.div role="dialog" aria-modal="true" className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(13,43,92,.32)] sm:p-7" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}><button type="button" aria-label="Tutup modal" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-[#EAF1FF] text-[#0D2B5C] transition hover:bg-[#0D2B5C] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#D4A017]/25" onClick={onClose}><X size={18} /></button><span className="inline-flex rounded-full bg-[#EAF1FF] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#0D2B5C]">Administrasi</span><h2 className="mt-5 font-display text-3xl font-black tracking-tight text-[#0D2B5C] sm:text-4xl">{service.title}</h2><p className="mt-4 leading-8 text-slate-600">{service.description}</p><div className="mt-7 grid gap-4 lg:grid-cols-2"><InfoBox title="📋 Persyaratan"><ul className="list-disc space-y-2 pl-5">{req.map((x) => <li key={x}>{x}</li>)}</ul></InfoBox><InfoBox title="🔄 Alur pelayanan"><ol className="list-decimal space-y-2 pl-5">{flow.map((x) => <li key={x}>{x}</li>)}</ol></InfoBox><InfoBox title="⏱ Estimasi"><p>{service.estimation || "Belum tersedia."}</p></InfoBox><InfoBox title="📄 Output"><p>{service.output || "Belum tersedia."}</p></InfoBox><InfoBox title="⚖ Dasar hukum" className="border-amber-200 bg-amber-50/90 lg:col-span-2"><p className="whitespace-pre-line text-amber-950">{service.legalBasis || "Belum tersedia."}</p></InfoBox></div><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#EAF1FF] px-6 font-black text-[#0D2B5C]">Tutup</button><Link href="/surat-online" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0D2B5C] px-6 font-black text-white">Ajukan <ArrowRight size={17} /></Link></div></motion.div></motion.div>; }

function InfoBox({ title, className, children }: { title: string; className?: string; children: ReactNode }) { return <div className={cn("rounded-[22px] border border-[#E3EAF4] bg-[#F7F9FC] p-4 text-sm font-semibold leading-7 text-slate-600", className)}><p className="mb-3 text-sm font-black text-[#0D2B5C]">{title}</p>{children}</div>; }