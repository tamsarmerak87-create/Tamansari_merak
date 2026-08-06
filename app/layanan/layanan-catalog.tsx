"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    Bot,
    Building2,
    CheckCircle2,
    Clock3,
    FileSignature,
    FileText,
    HeartHandshake,
    Home,
    Megaphone,
    Menu,
    MessageCircle,
    Search,
    ShieldCheck,
    Sparkles,
    Store,
    X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PublicService } from "@/types";
import { cn } from "@/utils/cn";

type Props = { services: PublicService[] };
const AUTO_MS = 5000;
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

const navItems = ["Beranda", "Profil", "Pelayanan", "Informasi", "Berita", "Galeri", "Kontak"];
const featureItems = [
    { icon: CheckCircle2, label: "Resmi & Terpercaya" },
    { icon: Clock3, label: "Proses Cepat" },
    { icon: HeartHandshake, label: "Melayani Sepenuh Hati" },
    { icon: ShieldCheck, label: "Data Aman" },
] as const;

const iconRules = [
    ["domisili", Home],
    ["usaha", Store],
    ["skck", ShieldCheck],
    ["mampu", HeartHandshake],
    ["kelahiran", Sparkles],
    ["nikah", FileSignature],
    ["kerja", Building2],
    ["perusahaan", Building2],
] as const;

function serviceIconKey(service: PublicService) {
    const text = `${service.title} ${service.description}`.toLowerCase();
    return iconRules.find(([key]) => text.includes(key))?.[0] ?? "surat";
}

export function LayananCatalog({ services }: Props) {
    const adminServices = useMemo(() => services.filter((item) => item.category === "administrasi").slice(0, 33), [services]);
    const [query, setQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [detail, setDetail] = useState<PublicService | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return adminServices;
        return adminServices.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(q));
    }, [adminServices, query]);

    const autoplay = useMemo(() => Autoplay({ delay: AUTO_MS, stopOnInteraction: false, stopOnMouseEnter: true }), []);
    const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", loop: true, dragFree: false, duration: 42 }, [autoplay]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);
    const onReInit = useCallback(() => {
        if (!emblaApi) return;
        setScrollSnaps(emblaApi.scrollSnapList());
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);
    const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
    const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        const frame = window.requestAnimationFrame(onReInit);
        emblaApi.on("select", onSelect);
        emblaApi.on("reInit", onReInit);
        return () => {
            window.cancelAnimationFrame(frame);
            emblaApi.off("select", onSelect);
            emblaApi.off("reInit", onReInit);
        };
    }, [emblaApi, onReInit, onSelect]);

    useEffect(() => {
        if (!detail) return;
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDetail(null);
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [detail]);

    const changeQuery = useCallback((value: string) => setQuery(value), []);

    return (
        <>
            <section className="relative isolate overflow-hidden px-4 pb-24 pt-5 sm:px-6 lg:px-8 xl:px-12">
                <div className="pointer-events-none absolute inset-0 -z-10 bg-[#F7F9FC]" />
                <div className="pointer-events-none absolute -left-32 top-20 -z-10 size-96 rounded-full bg-[#F4C542]/16 blur-3xl" />
                <div className="pointer-events-none absolute -right-32 top-44 -z-10 size-[30rem] rounded-full bg-[#0D2B5C]/10 blur-3xl" />

                <div className="mx-auto max-w-7xl">
                    <PremiumHeader query={query} setQuery={changeQuery} showSearch={showSearch} toggleSearch={() => setShowSearch((value) => !value)} />
                    <Hero total={adminServices.length} />
                    <FeatureGrid />

                    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4 }} className="mt-10">
                        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#F4C542]">Daftar Pelayanan</p>
                                <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#0D2B5C] sm:text-4xl">Pilih kebutuhan administrasi Anda</h2>
                            </div>
                            <p className="max-w-xl text-sm font-medium leading-7 text-slate-600">Geser kartu, gunakan panah navigasi, atau cari layanan untuk menemukan informasi pengajuan yang Anda perlukan.</p>
                        </div>

                        {filtered.length ? (
                            <div className="relative" aria-roledescription="carousel" aria-label="Slider pelayanan administrasi">
                                <div className="pointer-events-none absolute -inset-4 rounded-[36px] bg-gradient-to-r from-[#F4C542]/20 via-white/50 to-[#0D2B5C]/10 blur-2xl" />
                                <div className="relative overflow-hidden py-3" ref={emblaRef}>
                                    <div className="flex touch-pan-y will-change-transform">
                                        {filtered.map((service, index) => (
                                            <div key={service.id} className="min-w-0 flex-[0_0_100%] px-2 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] xl:flex-[0_0_25%] 2xl:flex-[0_0_20%]">
                                                <ServiceCard service={service} number={index + 1} onDetail={() => setDetail(service)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <SliderFooter selected={selectedIndex} total={scrollSnaps.length} scrollPrev={scrollPrev} scrollNext={scrollNext} scrollTo={scrollTo} />
                            </div>
                        ) : (
                            <div className="rounded-[28px] border border-[#E8EDF5] bg-white p-8 text-center text-base font-extrabold text-[#0D2B5C] shadow-[0_18px_55px_rgba(13,43,92,0.08)]">Layanan tidak ditemukan.</div>
                        )}
                    </motion.div>

                    <BottomCta />
                </div>
            </section>
            <LocalFloatingButtons />
            <AnimatePresence>{detail ? <DetailModal service={detail} onClose={() => setDetail(null)} /> : null}</AnimatePresence>
        </>
    );
}

const PremiumHeader = memo(function PremiumHeader({ query, setQuery, showSearch, toggleSearch }: { query: string; setQuery: (value: string) => void; showSearch: boolean; toggleSearch: () => void }) {
    return (
        <header className="sticky top-4 z-[120] min-h-[88px] rounded-[28px] border border-white/80 bg-white/78 px-4 shadow-[0_18px_60px_rgba(13,43,92,0.10)] backdrop-blur-2xl sm:px-5">
            <div className="flex min-h-[88px] items-center justify-between gap-4">
                <Link href="/" aria-label="Kembali ke beranda" className="flex min-h-12 items-center gap-3 rounded-full focus:outline-none focus:ring-4 focus:ring-[#F4C542]/30">
                    <span className="relative grid size-12 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8EDF5]"><Image src="/assets/logo-cilegon.png" alt="Logo Kota Cilegon" width={48} height={48} priority sizes="48px" className="object-contain p-1" /></span>
                    <span className="hidden leading-tight sm:block"><span className="block text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#F4C542]">Pemerintah Kota Cilegon</span><span className="block text-base font-extrabold text-[#0D2B5C]">Kelurahan Tamansari</span></span>
                </Link>
                <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama layanan">
                    {navItems.map((item) => <Link key={item} href={item === "Beranda" ? "/" : `/${item.toLowerCase()}`} className={cn("group relative rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-[#0D2B5C]", item === "Pelayanan" && "text-[#0D2B5C]")}>{item}<span className={cn("absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-[#F4C542] transition-transform", item === "Pelayanan" ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100")} /></Link>)}
                </nav>
                <div className="flex items-center gap-2">
                    {showSearch ? <motion.input initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 210 }} value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Cari layanan..." className="hidden min-h-11 rounded-full border border-[#E8EDF5] bg-white px-5 text-sm font-semibold text-[#0D2B5C] outline-none focus:ring-4 focus:ring-[#F4C542]/20 md:block" /> : null}
                    <button type="button" onClick={toggleSearch} aria-label="Cari layanan" className="grid size-11 place-items-center rounded-full border border-[#E8EDF5] bg-white text-[#0D2B5C] transition hover:border-[#F4C542] hover:bg-[#FFF8DD] focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25"><Search size={18} /></button>
                    <Link href="/#tamsar-ai" aria-label="TAMSAR AI" className="hidden min-h-11 items-center gap-2 rounded-full bg-[#0D2B5C] px-4 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(13,43,92,0.18)] transition hover:-translate-y-0.5 md:inline-flex"><Bot size={17} /> TAMSAR AI</Link>
                    <button type="button" aria-label="Buka menu" className="grid size-11 place-items-center rounded-full bg-[#F4C542] text-[#0D2B5C] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25"><Menu size={20} /></button>
                </div>
            </div>
            {showSearch ? <div className="pb-4 md:hidden"><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Cari layanan..." className="min-h-11 w-full rounded-full border border-[#E8EDF5] bg-white px-5 text-sm font-semibold text-[#0D2B5C] outline-none focus:ring-4 focus:ring-[#F4C542]/20" /></div> : null}
        </header>
    );
});

function Hero({ total }: { total: number }) {
    return (
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4 }} className="mt-8 overflow-hidden rounded-[36px] border border-white/80 bg-white/92 p-6 shadow-[0_28px_90px_rgba(13,43,92,0.10)] backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
                <div>
                    <div className="flex items-center gap-3"><span className="grid size-16 place-items-center rounded-[24px] bg-[#FFF8DD] text-[#0D2B5C] shadow-inner"><FileText size={30} /></span><span className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#F4C542]">Administrasi</span></div>
                    <h1 className="mt-7 max-w-3xl text-[clamp(44px,7vw,64px)] font-extrabold leading-[0.95] tracking-[-0.06em] text-[#0D2B5C]">33 Jenis Pelayanan</h1>
                    <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-600 sm:text-xl">Pilih layanan yang Anda butuhkan dengan mudah.</p>
                    <div className="mt-7 h-1.5 w-36 rounded-full bg-gradient-to-r from-[#F4C542] via-[#F9D976] to-transparent" />
                </div>
                <div className="relative min-h-[300px] overflow-hidden rounded-[32px] bg-gradient-to-br from-[#F7F9FC] to-white p-5 ring-1 ring-[#E8EDF5]">
                    <div className="absolute -right-16 -top-16 size-44 rounded-full bg-[#F4C542]/20" />
                    <div className="relative h-44 overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_60px_rgba(13,43,92,0.10)]"><Image src="/assets/kantor-tamansari.jpg" alt="Ilustrasi gedung Kelurahan Tamansari" fill sizes="(min-width: 1024px) 420px, 100vw" loading="lazy" className="object-cover" /></div>
                    <div className="relative mt-5 overflow-hidden rounded-[28px] bg-[#0D2B5C] p-6 text-white shadow-[0_24px_60px_rgba(13,43,92,0.28)]"><div className="absolute -right-8 -top-10 size-32 rounded-full bg-[#F4C542]/25" /><Building2 className="relative text-[#F4C542]" size={34} /><p className="relative mt-5 text-5xl font-extrabold tracking-[-0.04em]">{total}</p><p className="relative mt-1 text-sm font-semibold text-blue-100">Layanan Administrasi Aktif</p></div>
                </div>
            </div>
        </motion.div>
    );
}

function FeatureGrid() {
    return <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{featureItems.map((item, index) => { const Icon = item.icon; return <motion.div key={item.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4, delay: index * 0.04 }} className="flex min-h-20 items-center gap-4 rounded-[24px] border border-[#E8EDF5] bg-white p-5 shadow-[0_16px_45px_rgba(13,43,92,0.07)]"><span className="grid size-12 place-items-center rounded-full bg-[#FFF8DD] text-[#F4C542]"><Icon size={22} /></span><p className="font-extrabold text-[#0D2B5C]">{item.label}</p></motion.div>; })}</div>;
}

const ServiceCard = memo(function ServiceCard({ service, number, onDetail }: { service: PublicService; number: number; onDetail: () => void }) {
    const iconKey = serviceIconKey(service);
    return <motion.article initial={{ opacity: 0, y: 18, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-40px" }} whileHover={{ y: -6, scale: 1.03 }} transition={{ duration: 0.3 }} className="group h-full min-h-[300px] rounded-[24px] border border-[#E8EDF5] bg-white p-6 shadow-[0_18px_50px_rgba(13,43,92,0.08)] transition duration-300 hover:border-[#F4C542]/60 hover:shadow-[0_28px_70px_rgba(13,43,92,0.14)]"><div className="flex items-start justify-between gap-3"><span className="grid size-14 place-items-center rounded-full bg-[#FFF8DD] text-[#0D2B5C] transition group-hover:bg-[#F9D976]"><ServiceIcon iconKey={iconKey} /></span><span className="rounded-full bg-[#F4C542] px-3 py-1 text-xs font-extrabold text-[#0D2B5C]">{String(number).padStart(2, "0")}</span></div><p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#F4C542]">{service.category}</p><h3 className="mt-2 line-clamp-2 min-h-[3.5rem] text-xl font-extrabold leading-tight tracking-[-0.03em] text-[#0D2B5C]">{service.title}</h3><p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-slate-600">{service.description}</p><button type="button" onClick={onDetail} aria-label={`Informasi dan ajukan ${service.title}`} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#F4C542]/70 bg-white px-4 text-sm font-semibold text-[#0D2B5C] transition hover:bg-[#F4C542] focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25">Informasi & Ajukan <ArrowRight size={16} className="transition group-hover:translate-x-1" /></button></motion.article>;
});

function ServiceIcon({ iconKey }: { iconKey: string }) {
    if (iconKey === "domisili") return <Home size={24} />;
    if (iconKey === "usaha") return <Store size={24} />;
    if (iconKey === "skck") return <ShieldCheck size={24} />;
    if (iconKey === "mampu") return <HeartHandshake size={24} />;
    if (iconKey === "kelahiran") return <Sparkles size={24} />;
    if (iconKey === "nikah") return <FileSignature size={24} />;
    if (iconKey === "kerja" || iconKey === "perusahaan") return <Building2 size={24} />;
    return <FileText size={24} />;
}

function SliderFooter({ selected, total, scrollPrev, scrollNext, scrollTo }: { selected: number; total: number; scrollPrev: () => void; scrollNext: () => void; scrollTo: (index: number) => void }) {
    const safeTotal = Math.max(total, 1);
    return <div className="mt-6 flex flex-col items-center justify-between gap-5 rounded-[28px] border border-white/80 bg-white/70 p-4 shadow-[0_16px_45px_rgba(13,43,92,0.07)] backdrop-blur-xl sm:flex-row"><div className="flex items-center gap-3"><button type="button" onClick={scrollPrev} aria-label="Slide sebelumnya" className="grid size-12 place-items-center rounded-full bg-[#F4C542] text-[#0D2B5C] shadow-[0_12px_30px_rgba(244,197,66,0.30)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25"><ArrowLeft size={18} /></button><p className="min-w-20 text-center text-sm font-extrabold text-[#0D2B5C]">{selected + 1} / {safeTotal}</p><button type="button" onClick={scrollNext} aria-label="Slide berikutnya" className="grid size-12 place-items-center rounded-full bg-[#F4C542] text-[#0D2B5C] shadow-[0_12px_30px_rgba(244,197,66,0.30)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25"><ArrowRight size={18} /></button></div><div className="flex flex-wrap justify-center gap-2" aria-label="Bullet indicator pelayanan">{Array.from({ length: safeTotal }, (_, index) => <button key={index} type="button" onClick={() => scrollTo(index)} aria-label={`Ke slide ${index + 1}`} aria-current={selected === index ? "true" : undefined} className={cn("h-2.5 rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25", selected === index ? "w-8 bg-[#F4C542]" : "w-2.5 bg-[#C8D4E6] hover:bg-[#0D2B5C]")} />)}</div></div>;
}

function BottomCta() {
    return <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4 }} className="relative mt-10 overflow-hidden rounded-[32px] bg-[#0D2B5C] p-6 text-white shadow-[0_28px_80px_rgba(13,43,92,0.22)] sm:p-8"><div className="absolute -right-20 -top-20 size-56 rounded-full bg-[#F4C542]/20" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12 text-[#F4C542]"><Megaphone size={28} /></span><p className="max-w-3xl text-2xl font-extrabold leading-tight tracking-[-0.03em] sm:text-3xl">Layanan cepat, mudah dan transparan untuk masyarakat.</p></div><Link href="/layanan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#F4C542] px-6 text-sm font-extrabold text-[#0D2B5C] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25">Lihat Semua Layanan <ArrowRight size={17} /></Link></div></motion.div>;
}

function LocalFloatingButtons() {
    return <div className="fixed bottom-6 right-4 z-[130] flex flex-col items-end gap-3 sm:right-6"><a href="https://wa.me/6280000000000" aria-label="WhatsApp Kelurahan" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#25D366] px-4 text-sm font-extrabold text-white shadow-[0_18px_45px_rgba(37,211,102,0.30)] transition hover:-translate-y-1"><MessageCircle size={20} /> WhatsApp</a><Link href="/#tamsar-ai" aria-label="Chat TAMSAR AI" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#0D2B5C] px-4 text-sm font-extrabold text-white shadow-[0_18px_45px_rgba(13,43,92,0.25)] transition hover:-translate-y-1"><Bot size={20} /> Chat TAMSAR</Link></div>;
}

function DetailModal({ service, onClose }: { service: PublicService; onClose: () => void }) {
    const req = service.requirements?.length ? service.requirements : ["Tidak ada persyaratan."];
    const flow = service.flow?.length ? service.flow : ["Belum tersedia."];
    return <motion.div className="fixed inset-0 z-[160] grid place-items-center px-4 py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button type="button" aria-label="Tutup detail" className="absolute inset-0 bg-[#0D2B5C]/70 backdrop-blur-sm" onClick={onClose} /><motion.div role="dialog" aria-modal="true" className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white bg-white p-5 shadow-[0_30px_100px_rgba(13,43,92,.35)] sm:p-7" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}><button type="button" aria-label="Tutup modal" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-[#F7F9FC] text-[#0D2B5C] transition hover:bg-[#0D2B5C] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25" onClick={onClose}><X size={18} /></button><span className="inline-flex rounded-full bg-[#FFF8DD] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#0D2B5C]">Administrasi</span><h2 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-[#0D2B5C] sm:text-4xl">{service.title}</h2><p className="mt-4 font-medium leading-8 text-slate-600">{service.description}</p><div className="mt-7 grid gap-4 lg:grid-cols-2"><InfoBox title="📋 Persyaratan"><ul className="list-disc space-y-2 pl-5">{req.map((item) => <li key={item}>{item}</li>)}</ul></InfoBox><InfoBox title="🔄 Alur pelayanan"><ol className="list-decimal space-y-2 pl-5">{flow.map((item) => <li key={item}>{item}</li>)}</ol></InfoBox><InfoBox title="⏱ Estimasi"><p>{service.estimation || "Belum tersedia."}</p></InfoBox><InfoBox title="📄 Output"><p>{service.output || "Belum tersedia."}</p></InfoBox><InfoBox title="⚖ Dasar hukum" className="border-[#F4C542]/40 bg-[#FFF8DD]/80 lg:col-span-2"><p className="whitespace-pre-line text-[#0D2B5C]">{service.legalBasis || "Belum tersedia."}</p></InfoBox></div><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#F7F9FC] px-6 font-extrabold text-[#0D2B5C]">Tutup</button><Link href="/surat-online" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0D2B5C] px-6 font-extrabold text-white">Ajukan <ArrowRight size={17} /></Link></div></motion.div></motion.div>;
}

function InfoBox({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
    return <div className={cn("rounded-[24px] border border-[#E8EDF5] bg-[#F7F9FC] p-4 text-sm font-medium leading-7 text-slate-600", className)}><p className="mb-3 text-sm font-extrabold text-[#0D2B5C]">{title}</p>{children}</div>;
}
