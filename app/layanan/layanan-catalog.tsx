"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, FileText, Landmark, MessageSquareText, Scale, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MotionShell } from "@/components/common/motion-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import type { PublicService } from "@/types";
import { cn } from "@/utils/cn";

type LayananCatalogProps = {
    services: PublicService[];
};

type FilterKey = "semua" | "administrasi" | "pengantar" | "keagamaan" | "lainnya";

const filters: { key: FilterKey; label: string }[] = [
    { key: "semua", label: "Semua" },
    { key: "administrasi", label: "Administrasi" },
    { key: "pengantar", label: "Pengantar" },
    { key: "keagamaan", label: "Keagamaan" },
    { key: "lainnya", label: "Lainnya" },
];

const categoryMeta = {
    administrasi: { icon: FileText, label: "Administrasi", href: "/surat-online" },
    pengaduan: { icon: MessageSquareText, label: "Pengaduan", href: "/pengaduan" },
    posbankum: { icon: Scale, label: "POSBANKUM", href: "/posbankum" },
    pengantar: { icon: Landmark, label: "Pengantar", href: "/surat-online" },
    keagamaan: { icon: ShieldCheck, label: "Keagamaan", href: "/surat-online" },
    lainnya: { icon: Sparkles, label: "Lainnya", href: "/surat-online" },
};

function getCategoryMeta(category: string) {
    const normalized = category.toLowerCase();
    if (normalized in categoryMeta) return categoryMeta[normalized as keyof typeof categoryMeta];
    return categoryMeta.lainnya;
}

function getPerPage() {
    if (typeof window === "undefined") return 8;
    if (window.innerWidth >= 1536) return 8;
    if (window.innerWidth >= 1024) return 6;
    return 4;
}

function countLegalBasis(legalBasis?: string) {
    const items = legalBasis?.split(/\n+/).map((item) => item.trim()).filter(Boolean) ?? [];
    const count = items.length || (legalBasis?.trim() ? 1 : 0);
    return `${count || 0} regulasi`;
}

function getEstimationSummary(services: PublicService[]) {
    return services.find((service) => service.estimation?.trim())?.estimation?.trim() || "Belum tersedia";
}

export function LayananCatalog({ services }: LayananCatalogProps) {
    const [query, setQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterKey>("semua");
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(8);
    const [selectedService, setSelectedService] = useState<PublicService | null>(null);

    useEffect(() => {
        const updatePerPage = () => {
            setPerPage(getPerPage());
            setCurrentPage(1);
        };
        updatePerPage();
        window.addEventListener("resize", updatePerPage);
        return () => window.removeEventListener("resize", updatePerPage);
    }, []);

    useEffect(() => {
        if (!selectedService) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setSelectedService(null);
        };
        window.addEventListener("keydown", onKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = "";
        };
    }, [selectedService]);

    const filteredServices = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return services.filter((service) => {
            const category = service.category.toLowerCase();
            const matchesSearch = !keyword || service.title.toLowerCase().includes(keyword) || service.description.toLowerCase().includes(keyword) || category.includes(keyword);
            const matchesFilter = activeFilter === "semua" || category.includes(activeFilter);
            return matchesSearch && matchesFilter;
        });
    }, [activeFilter, query, services]);

    const totalPages = Math.max(1, Math.ceil(filteredServices.length / perPage));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedServices = filteredServices.slice((safePage - 1) * perPage, safePage * perPage);
    const averageEstimation = getEstimationSummary(services);

    return (
        <>
            <Section className="pt-8" eyebrow="Katalog layanan" title="Kartu layanan digital yang siap dipakai warga">
                <MotionShell>
                    <GlassCard className="mb-8 rounded-[2rem] border border-white/80 bg-white/72 p-4 shadow-soft sm:p-5">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gov-800" size={20} />
                            <input
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Cari layanan..."
                                className="min-h-14 w-full rounded-[1.35rem] border border-white/80 bg-white/80 py-4 pl-14 pr-5 text-base font-bold text-gov-950 outline-none shadow-soft transition placeholder:text-slate-400 focus:border-accent-300 focus:ring-4 focus:ring-accent-100"
                                type="search"
                            />
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                            {filters.map((filter) => (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => {
                                        setActiveFilter(filter.key);
                                        setCurrentPage(1);
                                    }}
                                    className={cn(
                                        "rounded-full border px-5 py-2.5 text-sm font-black transition duration-300 hover:-translate-y-0.5 hover:shadow-soft focus:outline-none focus:ring-4 focus:ring-accent-100",
                                        activeFilter === filter.key ? "border-gov-950 bg-gov-950 text-white shadow-soft" : "border-white/80 bg-white/70 text-gov-900",
                                    )}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </GlassCard>
                </MotionShell>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    <AnimatePresence mode="popLayout">
                        {paginatedServices.map((service, index) => {
                            const meta = getCategoryMeta(service.category);
                            const Icon = meta.icon;
                            const requirementsCount = service.requirements.length;
                            const estimation = service.estimation?.trim() || "Belum tersedia";
                            const output = service.output?.trim() || "Belum tersedia";

                            return (
                                <motion.article
                                    key={service.id}
                                    layout
                                    initial={{ opacity: 0, y: 26, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 18, scale: 0.96 }}
                                    transition={{ duration: 0.45, ease: "easeOut", delay: Math.min(index * 0.025, 0.18) }}
                                    whileHover={{ y: -8, scale: 1.015 }}
                                    className="h-full"
                                >
                                    <GlassCard className="group relative flex h-full min-h-[430px] flex-col overflow-hidden rounded-[2rem] border border-border-soft bg-white/72 p-5 shadow-soft transition duration-500 before:absolute before:inset-0 before:-z-10 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/85 before:via-accent-100/50 before:to-gov-100/30 hover:border-white hover:shadow-gold">
                                        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/70 to-transparent" />
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gov-800 text-white shadow-soft transition duration-500 group-hover:scale-110 group-hover:bg-accent-400 group-hover:text-gov-950">
                                                <Icon size={22} />
                                            </div>
                                            <Badge className="px-3 py-1.5 text-[10px] tracking-[0.16em] text-accent-700">{meta.label}</Badge>
                                        </div>
                                        <h2 className="mt-5 line-clamp-3 min-h-[5.25rem] font-display text-xl font-black leading-tight tracking-tight text-gov-950">{service.title}</h2>
                                        <p className="mt-3 line-clamp-2 min-h-[3.5rem] text-sm font-semibold leading-7 text-slate-650">{service.description}</p>
                                        <div className="mt-5 grid gap-3 text-sm font-bold text-slate-650">
                                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3"><span>📋 Persyaratan</span><strong className="text-gov-950">{requirementsCount} dokumen</strong></div>
                                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3"><span>⏱ Estimasi</span><strong className="max-w-[8rem] truncate text-right text-gov-950">{estimation}</strong></div>
                                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3"><span>⚖ Dasar Hukum</span><strong className="text-gov-950">{countLegalBasis(service.legalBasis)}</strong></div>
                                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3"><span>📄 Output</span><strong className="max-w-[8rem] truncate text-right text-gov-950">{output}</strong></div>
                                        </div>
                                        <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
                                            <Button type="button" variant="glass" className="min-h-11 rounded-2xl px-3 py-2.5" onClick={() => setSelectedService(service)}>Detail</Button>
                                            <Button href={meta.href} className="min-h-11 rounded-2xl px-3 py-2.5">Ajukan <ArrowRight size={16} /></Button>
                                        </div>
                                    </GlassCard>
                                </motion.article>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {filteredServices.length === 0 ? (
                    <MotionShell>
                        <GlassCard className="mt-8 rounded-[2rem] p-8 text-center"><p className="font-black text-gov-950">Layanan tidak ditemukan.</p><p className="mt-2 text-slate-650">Coba gunakan kata kunci atau kategori lain.</p></GlassCard>
                    </MotionShell>
                ) : null}

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-bold text-slate-650">Menampilkan {paginatedServices.length} dari {filteredServices.length} layanan</p>
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={cn(
                                    "grid size-11 place-items-center rounded-full border text-sm font-black shadow-soft transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-accent-100",
                                    safePage === page ? "border-gov-950 bg-gov-950 text-white" : "border-white/80 bg-white/75 text-gov-950",
                                )}
                                aria-current={safePage === page ? "page" : undefined}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            <Section className="pb-24 pt-0">
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { icon: BarChart3, value: services.length.toString(), label: "Total layanan" },
                        { icon: Clock3, value: averageEstimation, label: "Estimasi rata-rata" },
                        { icon: ShieldCheck, value: "Transparan", label: "Informasi resmi" },
                        { icon: CheckCircle2, value: "Mudah", label: "Akses pengajuan" },
                    ].map((stat, index) => {
                        const Icon = stat.icon;
                        return (
                            <MotionShell key={stat.label} delay={index * 0.04}>
                                <GlassCard className="flex h-full items-center gap-4 rounded-[2rem] border border-white/80 bg-white/72 p-5 shadow-soft">
                                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gov-950 text-white"><Icon size={22} /></div>
                                    <div><p className="font-display text-2xl font-black text-gov-950">{stat.value}</p><p className="mt-1 text-sm font-bold text-slate-650">{stat.label}</p></div>
                                </GlassCard>
                            </MotionShell>
                        );
                    })}
                </div>
            </Section>

            <AnimatePresence>
                {selectedService ? <ServiceDetailModal service={selectedService} onClose={() => setSelectedService(null)} /> : null}
            </AnimatePresence>
        </>
    );
}

function ServiceDetailModal({ service, onClose }: { service: PublicService; onClose: () => void }) {
    const meta = getCategoryMeta(service.category);
    const requirements = service.requirements.length > 0 ? service.requirements : ["Tidak ada persyaratan."];
    const flow = service.flow && service.flow.length > 0 ? service.flow : ["Belum tersedia."];
    const legalBasis = service.legalBasis?.trim() || "Belum tersedia.";
    const output = service.output?.trim() || "Belum tersedia.";
    const estimation = service.estimation?.trim() || "Belum tersedia.";
    const channel = service.channel?.trim() || "Belum tersedia.";

    return (
        <motion.div className="fixed inset-0 z-[130] grid place-items-center px-4 py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Tutup detail layanan" className="absolute inset-0 bg-gov-950/65 backdrop-blur-sm" onClick={onClose} />
            <motion.div role="dialog" aria-modal="true" aria-labelledby="layanan-detail-title" className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-[0_28px_90px_rgba(15,39,72,.32)] sm:p-7" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} transition={{ duration: 0.28, ease: "easeOut" }}>
                <button type="button" aria-label="Tutup modal" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-slate-100 text-gov-950 transition hover:bg-slate-200" onClick={onClose}><X size={18} /></button>
                <Badge className="pr-12 text-accent-700">{meta.label}</Badge>
                <h2 id="layanan-detail-title" className="mt-5 font-display text-3xl font-black tracking-tight text-gov-950 sm:text-4xl">{service.title}</h2>
                <p className="mt-4 leading-8 text-slate-650">{service.description}</p>
                <div className="mt-7 grid gap-4 lg:grid-cols-2">
                    <InfoBox title="📋 Persyaratan"><ul className="list-disc space-y-2 pl-5">{requirements.map((item) => <li key={item}>{item}</li>)}</ul></InfoBox>
                    <InfoBox title="🔄 Alur pelayanan"><ol className="list-decimal space-y-2 pl-5">{flow.map((item) => <li key={item}>{item}</li>)}</ol></InfoBox>
                    <InfoBox title="⏱ Estimasi"><p>{estimation}</p></InfoBox>
                    <InfoBox title="📄 Output"><p>{output}</p></InfoBox>
                    <InfoBox title="⚖ Dasar hukum" className="border-amber-200 bg-amber-50/90 lg:col-span-2"><div className="max-h-[220px] overflow-y-auto whitespace-pre-line pr-2 text-amber-950">{legalBasis}</div></InfoBox>
                    <InfoBox title="🌐 Kanal pelayanan" className="lg:col-span-2"><p>{channel}</p></InfoBox>
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="glass" onClick={onClose}>Tutup</Button><Button href={meta.href}>Ajukan <ArrowRight size={17} /></Button></div>
            </motion.div>
        </motion.div>
    );
}

function InfoBox({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
    return <div className={cn("rounded-3xl border border-white/80 bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-650", className)}><p className="mb-3 text-sm font-black text-gov-950">{title}</p>{children}</div>;
}