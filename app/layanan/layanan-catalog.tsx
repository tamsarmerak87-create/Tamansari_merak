"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, FileText, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { PublicService } from "@/types";
import { cn } from "@/utils/cn";

type Props = { services: PublicService[]; mode?: "full" | "home" };
const AUTO_MS = 5000;
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

const categoryChips = [
    { key: "all", label: "⭐ Semua" },
    { key: "kependudukan", label: "🏠 Kependudukan" },
    { key: "surat", label: "📄 Surat Keterangan" },
    { key: "posbankum", label: "⚖ POSBANKUM" },
    { key: "umkm", label: "🏪 UMKM" },
    { key: "bpjs", label: "🏥 BPJS" },
    { key: "legalisasi", label: "📑 Legalisasi" },
    { key: "sosial", label: "🕌 Sosial" },
    { key: "administrasi", label: "📋 Administrasi" },
] as const;

type CategoryKey = (typeof categoryChips)[number]["key"];

const iconRules = [
    "domisili",
    "usaha",
    "skck",
    "mampu",
    "kelahiran",
    "kematian",
    "pindah",
    "datang",
    "legalisasi",
    "nikah",
    "posbankum",
    "bpjs",
    "umkm",
    "izin",
    "kerja",
    "perusahaan",
] as const;

const clayIcons: Record<string, { emoji: string; bg: string; shadow: string }> = {
    domisili: { emoji: "🏠", bg: "from-sky-100 via-white to-blue-200", shadow: "rgba(56,189,248,.30)" },
    usaha: { emoji: "🏪", bg: "from-amber-100 via-white to-orange-200", shadow: "rgba(251,146,60,.30)" },
    skck: { emoji: "👮", bg: "from-blue-100 via-white to-indigo-200", shadow: "rgba(79,70,229,.26)" },
    mampu: { emoji: "🤲", bg: "from-rose-100 via-white to-pink-200", shadow: "rgba(244,63,94,.24)" },
    kelahiran: { emoji: "👶", bg: "from-pink-100 via-white to-rose-200", shadow: "rgba(244,114,182,.25)" },
    kematian: { emoji: "🕯️", bg: "from-slate-100 via-white to-stone-200", shadow: "rgba(100,116,139,.22)" },
    pindah: { emoji: "🚚", bg: "from-cyan-100 via-white to-sky-200", shadow: "rgba(14,165,233,.25)" },
    datang: { emoji: "📦", bg: "from-lime-100 via-white to-emerald-200", shadow: "rgba(16,185,129,.24)" },
    legalisasi: { emoji: "📜", bg: "from-yellow-100 via-white to-amber-200", shadow: "rgba(245,158,11,.28)" },
    nikah: { emoji: "💍", bg: "from-yellow-100 via-white to-orange-200", shadow: "rgba(234,179,8,.30)" },
    posbankum: { emoji: "⚖️", bg: "from-violet-100 via-white to-indigo-200", shadow: "rgba(124,58,237,.24)" },
    bpjs: { emoji: "🏥", bg: "from-teal-100 via-white to-cyan-200", shadow: "rgba(20,184,166,.24)" },
    umkm: { emoji: "🛒", bg: "from-orange-100 via-white to-amber-200", shadow: "rgba(249,115,22,.26)" },
    izin: { emoji: "📋", bg: "from-emerald-100 via-white to-green-200", shadow: "rgba(34,197,94,.24)" },
    kerja: { emoji: "💼", bg: "from-indigo-100 via-white to-blue-200", shadow: "rgba(59,130,246,.25)" },
    perusahaan: { emoji: "🏢", bg: "from-slate-100 via-white to-blue-200", shadow: "rgba(71,85,105,.22)" },
    surat: { emoji: "📄", bg: "from-amber-100 via-white to-yellow-200", shadow: "rgba(244,197,66,.28)" },
};

function serviceIconKey(service: PublicService) {
    const text = `${service.title} ${service.description}`.toLowerCase();
    return iconRules.find((key) => text.includes(key)) ?? "surat";
}

function serviceGroup(service: PublicService): Exclude<CategoryKey, "all"> {
    const text = `${service.title} ${service.description}`.toLowerCase();
    if (/(posbankum|bantuan hukum|hukum)/.test(text)) return "posbankum";
    if (/(umkm|usaha|mikro|dagang|jualan|toko)/.test(text)) return "umkm";
    if (/(bpjs|kesehatan|kis|jaminan kesehatan)/.test(text)) return "bpjs";
    if (/(legalisasi|legalisir|pengesahan)/.test(text)) return "legalisasi";
    if (/(tidak mampu|mampu|sosial|bantuan|miskin|yatim|masjid|nikah|cerai)/.test(text)) return "sosial";
    if (/(domisili|kelahiran|kematian|pindah|datang|kk|ktp|penduduk|kependudukan)/.test(text)) return "kependudukan";
    if (/(surat|keterangan|skck|pengantar)/.test(text)) return "surat";
    return "administrasi";
}

function serviceGroupLabel(service: PublicService) {
    return categoryChips.find((item) => item.key === serviceGroup(service))?.label.replace(/^\S+\s/, "") ?? "Administrasi";
}

export function LayananCatalog({ services, mode = "full" }: Props) {
    const adminServices = useMemo(() => services.filter((item) => item.category === "administrasi").slice(0, 33), [services]);
    const isHome = mode === "home";
    const homePreview = useMemo(() => adminServices.slice(0, 3), [adminServices]);
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
    const [detail, setDetail] = useState<PublicService | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return adminServices.filter((item) => {
            const matchesCategory = activeCategory === "all" || serviceGroup(item) === activeCategory;
            const matchesQuery = !q || `${item.title} ${item.description}`.toLowerCase().includes(q);
            return matchesCategory && matchesQuery;
        });
    }, [activeCategory, adminServices, query]);
    const visibleServices = isHome ? homePreview : filtered;

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
    const changeCategory = useCallback((value: CategoryKey) => {
        setActiveCategory(value);
        emblaApi?.scrollTo(0, true);
    }, [emblaApi]);

    return (
        <>
            <section id={isHome ? "layanan" : undefined} className={cn("relative isolate overflow-hidden px-4 sm:px-6 lg:px-8 xl:px-12", isHome ? "py-12 sm:py-16 lg:py-20" : "pb-24 pt-5")}>
                <div className="pointer-events-none absolute inset-0 -z-10 bg-[#F7F9FC]" />
                <div className="pointer-events-none absolute -left-32 top-20 -z-10 size-96 rounded-full bg-[#F4C542]/16 blur-3xl" />
                <div className="pointer-events-none absolute -right-32 top-44 -z-10 size-[30rem] rounded-full bg-[#0D2B5C]/10 blur-3xl" />

                <div className="mx-auto max-w-7xl">
                    {isHome ? <HomeHeading total={adminServices.length} /> : <Hero total={adminServices.length} />}
                    {!isHome ? <div className="mt-6 rounded-[30px] border border-white/80 bg-white/88 p-4 shadow-[0_18px_50px_rgba(13,43,92,0.08)] backdrop-blur-2xl sm:p-5">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#0B2C6A]/45" size={20} />
                            <label className="sr-only" htmlFor="layanan-search">Cari layanan</label>
                            <input id="layanan-search" value={query} onChange={(event) => changeQuery(event.target.value)} type="search" placeholder="Cari layanan..." className="min-h-14 w-full rounded-full border border-[#E8EDF5] bg-white py-3 pl-14 pr-5 text-[15px] font-bold text-[#0B2C6A] outline-none transition placeholder:text-slate-400 focus:border-[#FFC533] focus:ring-4 focus:ring-[#FFC533]/20" />
                        </div>
                        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
                            {categoryChips.map((item) => (
                                <button key={item.key} type="button" onClick={() => changeCategory(item.key)} aria-label={`Filter kategori ${item.label}`} aria-pressed={activeCategory === item.key} className={cn("shrink-0 rounded-full border px-4 py-2.5 text-sm font-extrabold transition duration-300 focus:outline-none focus:ring-4 focus:ring-[#FFC533]/25", activeCategory === item.key ? "border-[#FFC533] bg-[#0B2C6A] text-white shadow-[0_14px_34px_rgba(11,44,106,.22)]" : "border-[#E8EDF5] bg-white text-[#0B2C6A] hover:border-[#FFC533] hover:bg-[#FFF8DD]")}>{item.label}</button>
                            ))}
                        </div>
                    </div> : null}

                    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4 }} className="mt-10">
                        {!isHome ? <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#F4C542]">Daftar Layanan</p>
                                <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-[-0.04em] text-[#0D2B5C] sm:text-4xl">Layanan Kelurahan Tamansari</h2>
                            </div>
                            <p className="max-w-xl text-sm font-medium leading-7 text-slate-600">Temukan layanan administrasi dan pelayanan masyarakat secara mudah dan cepat.</p>
                        </div> : null}

                        {visibleServices.length ? (
                            <div className="relative">
                                <div className="pointer-events-none absolute -inset-4 rounded-[36px] bg-gradient-to-r from-[#F4C542]/20 via-white/50 to-[#0D2B5C]/10 blur-2xl" />
                                <div className={cn("relative py-3", isHome ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "overflow-hidden")} ref={isHome ? undefined : emblaRef} aria-roledescription={isHome ? undefined : "carousel"} aria-label="Slider layanan Kelurahan Tamansari">
                                    <div className={isHome ? "contents" : "flex touch-pan-y will-change-transform"}>
                                        {visibleServices.map((service) => (
                                            <div key={service.id} className={isHome ? "min-w-0" : "min-w-0 flex-[0_0_100%] px-1 md:flex-[0_0_50%] md:px-2 xl:flex-[0_0_33.333%]"}>
                                                <ServiceCard service={service} number={adminServices.findIndex((item) => item.id === service.id) + 1} onDetail={() => setDetail(service)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {isHome ? <div className="mt-7 flex justify-center"><Link href="/layanan" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0D2B5C] px-6 text-sm font-extrabold text-white shadow-[0_18px_45px_rgba(13,43,92,.20)] transition hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-[#FFC533]/25">Lihat Semua <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Link></div> : <SliderFooter selected={selectedIndex} total={scrollSnaps.length} scrollPrev={scrollPrev} scrollNext={scrollNext} scrollTo={scrollTo} />}
                            </div>
                        ) : (
                            <div className="rounded-[28px] border border-[#E8EDF5] bg-white p-8 text-center text-base font-extrabold text-[#0D2B5C] shadow-[0_18px_55px_rgba(13,43,92,0.08)]">Layanan tidak ditemukan.</div>
                        )}
                    </motion.div>

                </div>
            </section>
            <AnimatePresence>{detail ? <DetailModal service={detail} onClose={() => setDetail(null)} /> : null}</AnimatePresence>
        </>
    );
}

function HomeHeading({ total }: { total: number }) {
    return <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4 }} className="mb-8 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-[#F4C542]/45 bg-[#FFF8DD] px-4 py-2 text-sm font-extrabold uppercase tracking-[0.16em] text-[#0D2B5C]"><FileText size={15} /> {total} Layanan</span><h2 className="mt-4 text-[clamp(1.85rem,8vw,3rem)] font-extrabold uppercase leading-tight tracking-[-0.04em] text-[#0D2B5C] sm:text-5xl">Layanan Kelurahan Tamansari</h2><p className="mt-4 text-base font-medium leading-8 text-slate-600 sm:text-lg">Temukan layanan administrasi dan pelayanan masyarakat secara mudah dan cepat.</p></div></motion.div>;
}

function Hero({ total }: { total: number }) {
    return (
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4 }} className="mt-8 overflow-hidden rounded-[36px] border border-white/80 bg-white/92 p-6 shadow-[0_28px_90px_rgba(13,43,92,0.10)] backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
                <div>
                    <div className="flex items-center gap-3"><span className="grid size-16 place-items-center rounded-[24px] bg-[#FFF8DD] text-[#0D2B5C] shadow-inner"><FileText size={30} /></span><span className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#F4C542]">Layanan</span></div>
                    <h1 className="mt-7 max-w-3xl text-[clamp(40px,7vw,64px)] font-extrabold uppercase leading-[0.95] tracking-[-0.06em] text-[#0D2B5C]">Layanan Kelurahan Tamansari</h1>
                    <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-600 sm:text-xl">Temukan layanan administrasi dan pelayanan masyarakat secara mudah dan cepat.</p>
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

const ServiceCard = memo(function ServiceCard({ service, number, onDetail }: { service: PublicService; number: number; onDetail: () => void }) {
    const iconKey = serviceIconKey(service);
    return <motion.article initial={{ opacity: 0, y: 18, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-40px" }} whileHover={{ y: -6, scale: 1.02 }} transition={{ duration: 0.35 }} className="group flex h-full min-h-[420px] flex-col rounded-[28px] border border-[#E8EDF5] bg-white p-6 shadow-[0_18px_50px_rgba(13,43,92,0.08)] transition duration-300 hover:border-[#FFC533]/70 hover:shadow-[0_28px_70px_rgba(13,43,92,0.14)]"><div className="flex items-start justify-between gap-3"><ServiceIcon iconKey={iconKey} /><span className="shrink-0 rounded-full bg-[#FFC533] px-3 py-1 text-xs font-extrabold text-[#0B2C6A] shadow-[0_10px_22px_rgba(255,197,51,.25)]">{String(number).padStart(2, "0")}</span></div><p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#FFC533]">{serviceGroupLabel(service)}</p><h3 className="mt-2 whitespace-normal text-[22px] font-bold leading-[1.4] tracking-[-0.025em] text-[#0B2C6A] [overflow-wrap:anywhere] [word-break:break-word]">{service.title}</h3><p className="mt-3 line-clamp-2 min-h-[3rem] overflow-hidden text-[15px] font-medium leading-6 text-slate-600">{service.description}</p><div className="mt-auto pt-6"><button type="button" onClick={onDetail} aria-label={`Informasi dan ajukan ${service.title}`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#FFC533]/80 bg-white px-4 text-sm font-extrabold text-[#0B2C6A] transition duration-300 hover:bg-[#FFC533] hover:text-[#0B2C6A] focus:outline-none focus:ring-4 focus:ring-[#FFC533]/25">Informasi & Ajukan <ArrowRight size={16} className="transition duration-300 group-hover:translate-x-1.5" /></button></div></motion.article>;
});

function ServiceIcon({ iconKey }: { iconKey: string }) {
    const icon = clayIcons[iconKey] ?? clayIcons.surat;
    return <span className={cn("relative grid size-[72px] shrink-0 place-items-center rounded-[24px] bg-gradient-to-br text-[34px] shadow-inner ring-1 ring-white/80 transition duration-300 group-hover:-rotate-3 group-hover:scale-105", icon.bg)} style={{ "--icon-shadow": icon.shadow } as CSSProperties}><span className="absolute inset-2 rounded-[20px] bg-white/50 blur-[1px]" /><span className="relative drop-shadow-[0_12px_12px_var(--icon-shadow)]" aria-hidden="true">{icon.emoji}</span></span>;
}

function SliderFooter({ selected, total, scrollPrev, scrollNext, scrollTo }: { selected: number; total: number; scrollPrev: () => void; scrollNext: () => void; scrollTo: (index: number) => void }) {
    const safeTotal = Math.max(total, 1);
    return <div className="mt-6 flex flex-col items-center justify-between gap-5 rounded-[28px] border border-white/80 bg-white/70 p-4 shadow-[0_16px_45px_rgba(13,43,92,0.07)] backdrop-blur-xl sm:flex-row"><div className="flex items-center gap-3"><button type="button" onClick={scrollPrev} aria-label="Slide sebelumnya" className="grid size-12 place-items-center rounded-full bg-[#F4C542] text-[#0D2B5C] shadow-[0_12px_30px_rgba(244,197,66,0.30)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25"><ArrowLeft size={18} /></button><p className="min-w-20 text-center text-sm font-extrabold text-[#0D2B5C]">{selected + 1} / {safeTotal}</p><button type="button" onClick={scrollNext} aria-label="Slide berikutnya" className="grid size-12 place-items-center rounded-full bg-[#F4C542] text-[#0D2B5C] shadow-[0_12px_30px_rgba(244,197,66,0.30)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25"><ArrowRight size={18} /></button></div><div className="flex flex-wrap justify-center gap-2" aria-label="Bullet indicator pelayanan">{Array.from({ length: safeTotal }, (_, index) => <button key={index} type="button" onClick={() => scrollTo(index)} aria-label={`Ke slide ${index + 1}`} aria-current={selected === index ? "true" : undefined} className={cn("h-2.5 rounded-full transition focus:outline-none focus:ring-4 focus:ring-[#F4C542]/25", selected === index ? "w-8 bg-[#F4C542]" : "w-2.5 bg-[#C8D4E6] hover:bg-[#0D2B5C]")} />)}</div></div>;
}

function DetailModal({ service, onClose }: { service: PublicService; onClose: () => void }) {
    const req = service.requirements?.length ? service.requirements : ["Tidak ada persyaratan."];
    const flow = service.flow?.length ? service.flow : ["Belum tersedia."];
    return <motion.div className="fixed inset-0 z-[160] grid place-items-center px-4 py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button type="button" aria-label="Tutup detail" className="absolute inset-0 bg-[#0D2B5C]/70 backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-[#FFC533]/25" onClick={onClose} /><motion.div role="dialog" aria-modal="true" className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white bg-white p-5 shadow-[0_30px_100px_rgba(13,43,92,.35)] sm:p-7" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}><button type="button" aria-label="Tutup modal" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-[#F7F9FC] text-[#0D2B5C] transition hover:bg-[#0D2B5C] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#FFC533]/25" onClick={onClose}><X size={18} /></button><span className="inline-flex rounded-full bg-[#FFF8DD] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#0D2B5C]">{serviceGroupLabel(service)}</span><h2 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-[#0D2B5C] sm:text-4xl">{service.title}</h2><p className="mt-4 font-medium leading-8 text-slate-600">{service.description}</p><div className="mt-7 grid gap-4 lg:grid-cols-2"><InfoBox title="📋 Persyaratan"><ul className="list-disc space-y-2 pl-5">{req.map((item) => <li key={item}>{item}</li>)}</ul></InfoBox><InfoBox title="🔄 Alur pelayanan"><ol className="list-decimal space-y-2 pl-5">{flow.map((item) => <li key={item}>{item}</li>)}</ol></InfoBox><InfoBox title="⏱ Estimasi"><p>{service.estimation || "Belum tersedia."}</p></InfoBox><InfoBox title="📄 Output"><p>{service.output || "Belum tersedia."}</p></InfoBox><InfoBox title="⚖ Dasar hukum" className="border-[#F4C542]/40 bg-[#FFF8DD]/80 lg:col-span-2"><p className="whitespace-pre-line text-[#0D2B5C]">{service.legalBasis || "Belum tersedia."}</p></InfoBox></div><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" aria-label="Tutup detail layanan" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#F7F9FC] px-6 font-extrabold text-[#0D2B5C] focus:outline-none focus:ring-4 focus:ring-[#FFC533]/25">Tutup</button><Link href={`/layanan/${service.id}`} aria-label={`Ajukan ${service.title}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0D2B5C] px-6 font-extrabold text-white focus:outline-none focus:ring-4 focus:ring-[#FFC533]/25">Ajukan <ArrowRight size={17} /></Link></div></motion.div></motion.div>;
}

function InfoBox({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
    return <div className={cn("rounded-[24px] border border-[#E8EDF5] bg-[#F7F9FC] p-4 text-sm font-medium leading-7 text-slate-600", className)}><p className="mb-3 text-sm font-extrabold text-[#0D2B5C]">{title}</p>{children}</div>;
}
