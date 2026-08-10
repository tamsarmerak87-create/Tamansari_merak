"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Car, CheckCircle2, FileText, MessageSquareText, Scale, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicService } from "@/types";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type ServicesCarouselProps = {
    services: PublicService[];
};

const categoryIcon = {
    administrasi: FileText,
    pengaduan: MessageSquareText,
    posbankum: Scale,
} satisfies Record<PublicService["category"], React.ComponentType<{ size?: number; className?: string }>>;

const vehicleTaxUrl = "https://infopkb.bantenprov.go.id/";
const vehicleTaxService: PublicService = {
    id: "cek-pajak-kendaraan-banten",
    title: "CEK PAJAK KENDARAAN",
    category: "administrasi",
    description: "Cek informasi pajak kendaraan bermotor untuk kendaraan yang terdaftar di Provinsi Banten.",
    requirements: [],
    online: true,
};

export function ServicesCarousel({ services }: ServicesCarouselProps) {
    const displayServices = useMemo(() => [...services, vehicleTaxService], [services]);
    const autoplay = useMemo(
        () => Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
        [],
    );
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { align: "start", loop: true, dragFree: false, duration: 60, skipSnaps: false },
        [autoplay],
    );
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [scrollSnaps, setScrollSnaps] = useState<number[]>(() => displayServices.map((_, index) => index));

    const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
    const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    const onReInit = useCallback(() => {
        if (!emblaApi) return;
        setScrollSnaps(emblaApi.scrollSnapList());
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on("select", onSelect);
        emblaApi.on("reInit", onReInit);
        return () => {
            emblaApi.off("select", onSelect);
            emblaApi.off("reInit", onReInit);
        };
    }, [emblaApi, onReInit, onSelect]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "ArrowLeft") scrollPrev();
        if (event.key === "ArrowRight") scrollNext();
    };

    return (
        <section
            id="layanan"
            className="mx-auto w-full max-w-7xl overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
            aria-labelledby="services-carousel-title"
            onKeyDown={handleKeyDown}
        >
            <div className="mb-8 flex min-w-0 flex-col gap-5 sm:mb-10 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                    <Badge className="border-accent-200 bg-accent-100 text-gov-800">
                        <Sparkles size={15} /> {displayServices.length} Layanan
                    </Badge>
                    <h2 id="services-carousel-title" className="mt-4 font-display text-[clamp(1.85rem,8vw,3rem)] font-black uppercase leading-tight tracking-tight text-gov-950 sm:text-5xl">
                        Layanan Kelurahan Tamansari
                    </h2>
                    <p className="mt-4 text-base leading-8 text-slate-650 sm:text-lg">
                        Temukan layanan administrasi dan pelayanan masyarakat secara mudah dan cepat.
                    </p>
                </div>
                <Link
                    href="/layanan"
                    className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gov-800 px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-1 hover:bg-gov-900 sm:w-fit"
                >
                    Lihat Semua <ArrowRight size={17} className="transition group-hover:translate-x-1" />
                </Link>
            </div>

            <div className="relative" aria-roledescription="carousel" aria-label="Daftar layanan Kelurahan Tamansari">
                <div className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-r from-accent-400/20 via-white/40 to-gov-800/10 blur-2xl sm:-inset-5 sm:rounded-[3rem]" />
                <div
                    className="relative overflow-hidden py-2"
                    ref={emblaRef}
                    onPointerDown={() => autoplay.stop()}
                    onPointerUp={() => autoplay.reset()}
                    onPointerCancel={() => autoplay.reset()}
                    onMouseLeave={() => autoplay.reset()}
                >
                    <div className="flex touch-pan-y will-change-transform">
                        {displayServices.map((item, index) => {
                            const isVehicleTax = item.id === vehicleTaxService.id;
                            const Icon = isVehicleTax ? Car : categoryIcon[item.category];
                            return (
                                <motion.article
                                    key={item.id}
                                    className="min-w-0 flex-[0_0_100%] px-2 sm:px-3 md:flex-[0_0_50%] xl:flex-[0_0_33.333%]"
                                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                    viewport={{ once: true, margin: "-60px" }}
                                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.025, 0.25) }}
                                    aria-label={`${item.title}, kategori ${item.category}`}
                                >
                                    <GlassCard className="group relative h-full min-h-[20rem] overflow-hidden rounded-[1.7rem] border border-border-soft bg-white/72 p-5 shadow-soft transition duration-500 will-change-transform before:absolute before:inset-0 before:-z-10 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/80 before:via-accent-100/60 before:to-accent-400/20 hover:-translate-y-2 hover:scale-[1.015] hover:border-white hover:shadow-gold sm:min-h-[22rem] sm:rounded-[2rem] sm:p-6">
                                        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/70 to-transparent" />
                                        <div className="absolute -right-10 -top-10 size-32 rounded-full bg-accent-400/0 blur-2xl transition duration-500 group-hover:bg-accent-400/28" />
                                        <div className="relative grid size-12 place-items-center rounded-2xl bg-gov-800 text-white shadow-soft transition duration-500 group-hover:scale-110 group-hover:bg-accent-400 group-hover:text-gov-950">
                                            <Icon size={22} />
                                        </div>
                                        <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-accent-700">{isVehicleTax ? "LAYANAN PUBLIK" : item.category}</p>
                                        <h3 className="mt-3 font-display text-xl font-black tracking-tight text-gov-950 [overflow-wrap:anywhere] sm:text-2xl">{item.title}</h3>
                                        <p className="mt-3 line-clamp-3 leading-7 text-slate-650">{item.description}</p>
                                        <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                            <p className="inline-flex items-center gap-2 text-sm font-black text-gov-800">
                                                <CheckCircle2 size={17} /> {isVehicleTax ? "Layanan resmi" : "Informasi resmi"}
                                            </p>
                                            {isVehicleTax ? (
                                                <a href={vehicleTaxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-accent-300 bg-white px-4 text-sm font-black text-gov-950 transition hover:bg-accent-300 sm:w-auto">
                                                    Cek Plat Nomor <ArrowRight size={16} />
                                                </a>
                                            ) : (
                                                <Link href="/layanan" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-accent-300 bg-white px-4 text-sm font-black text-gov-950 transition hover:bg-accent-300 sm:w-auto">
                                                    Informasi & Ajukan <ArrowRight size={16} />
                                                </Link>
                                            )}
                                        </div>
                                    </GlassCard>
                                </motion.article>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2" aria-label="Navigasi slide layanan">
                        {scrollSnaps.map((_, index) => (
                            <button
                                key={index}
                                type="button"
                                className={cn(
                                    "h-3 rounded-full border border-white/80 bg-white/70 shadow-soft transition-all duration-300 hover:bg-gov-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gov-800",
                                    selectedIndex === index ? "w-9 bg-gov-950" : "w-3",
                                )}
                                onClick={() => scrollTo(index)}
                                aria-label={`Ke slide layanan ${index + 1}`}
                                aria-current={selectedIndex === index ? "true" : undefined}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={scrollPrev}
                            className="grid size-12 place-items-center rounded-full border border-white/80 bg-white/70 text-gov-950 shadow-soft backdrop-blur-2xl transition hover:-translate-y-1 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gov-800"
                            aria-label="Slide layanan sebelumnya"
                        >
                            <ArrowLeft size={19} />
                        </button>
                        <button
                            type="button"
                            onClick={scrollNext}
                            className="grid size-12 place-items-center rounded-full border border-white/80 bg-gov-950 text-white shadow-glass backdrop-blur-2xl transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gov-800"
                            aria-label="Slide layanan berikutnya"
                        >
                            <ArrowRight size={19} />
                        </button>
                    </div>
                </div>

                <span className="sr-only" aria-live="polite">
                    <AnimatePresence mode="wait">
                        <motion.span key={selectedIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            Slide layanan aktif {selectedIndex + 1} dari {scrollSnaps.length}
                        </motion.span>
                    </AnimatePresence>
                </span>
            </div>
        </section>
    );
}