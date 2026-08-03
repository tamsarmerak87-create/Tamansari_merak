"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { ChevronRight, Headset, Menu, Search, X } from "lucide-react";
import { site } from "@/constants/site";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const nav = [
    { label: "Beranda", href: "/" },
    { label: "Profil", href: "/profil" },
    { label: "Layanan", href: "/layanan" },
    { label: "Surat Online", href: "/surat-online" },
    { label: "Berita", href: "/berita" },
    { label: "Agenda", href: "/agenda" },
    { label: "POSBANKUM", href: "/posbankum" },
    { label: "FAQ", href: "/faq" },
] as const;

const mobileNav: { label: string; href: Route; }[] = [
    ...nav,
    { label: "Kontak", href: "/kontak" },
    { label: "TAMSAR CS", href: "/#chat" },
];

export function Navbar() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 1280) setOpen(false);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className="sticky top-0 z-[100] px-5 pt-2 sm:px-10 lg:px-20 lg:pt-3">
            <div className={`glass relative z-[101] mx-auto flex min-h-16 w-full max-w-[1440px] items-center gap-3 rounded-[1.4rem] border border-white/80 px-3 py-2 backdrop-blur-2xl transition-all duration-300 sm:rounded-[1.8rem] sm:px-4 sm:py-3 ${scrolled ? "shadow-[0_18px_60px_rgba(15,39,72,.18)]" : "shadow-[0_10px_35px_rgba(15,39,72,.10)]"}`}>
                <Link href="/" className="flex min-w-0 items-center gap-2 pr-1 sm:gap-3 sm:pr-2">
                    <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-border-soft sm:size-12">
                        <Image src="/assets/logo-cilegon.png" alt="Logo Cilegon" width={28} height={28} className="h-7 w-7 object-contain" />
                    </div>
                    <div className="min-w-0 leading-tight">
                        <b className="block max-w-[10rem] overflow-hidden text-ellipsis text-wrap text-sm font-black text-gov-950 sm:max-w-none sm:text-base">{site.name}</b>
                        <span className="hidden text-xs font-medium text-slate-650 sm:block">{site.district}, {site.city}</span>
                    </div>
                </Link>

                <nav className="hidden flex-1 items-center justify-center gap-1 xl:flex">
                    {nav.map((item) => (
                        <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 text-sm font-semibold text-gov-900 transition hover:bg-white hover:text-gov-800">
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    <button className="grid size-11 place-items-center rounded-full border border-white/80 bg-white/70 text-gov-900 shadow-soft transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-gov-100" aria-label="Pencarian">
                        <Search size={17} />
                    </button>
                    <Link href="/#chat" className="hidden min-h-11 items-center gap-2 rounded-full bg-gov-800 px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-gov-900 focus:outline-none focus:ring-4 focus:ring-gov-100 sm:inline-flex">
                        <Headset size={16} />
                        <span className="hidden sm:inline">TAMSAR CS</span>
                        <span className="sm:hidden">CS</span>
                    </Link>
                    <div className="xl:hidden">
                        <Sheet open={open} onOpenChange={setOpen}>
                            <SheetTrigger
                                aria-label="Buka menu navigasi"
                                className="pointer-events-auto grid size-11 place-items-center rounded-full bg-gov-800 text-white shadow-soft transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-gov-100"
                            >
                                {open ? <X size={19} /> : <Menu size={19} />}
                            </SheetTrigger>
                            <SheetContent side="right" className="flex flex-col overflow-y-auto bg-white p-5 sm:p-6">
                                <div className="pr-12">
                                    <div className="flex items-center gap-3">
                                        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gov-950 ring-1 ring-border-soft">
                                            <Image src="/assets/logo-cilegon.png" alt="Logo Kelurahan" width={28} height={28} className="h-7 w-7 object-contain" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-lg font-black text-gov-950">Kelurahan Tamansari</p>
                                            <p className="text-xs font-semibold text-slate-650">Kecamatan Pulomerak</p>
                                            <p className="text-xs font-semibold text-slate-650">Kota Cilegon</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-2">
                                    {mobileNav.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setOpen(false)}
                                            className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-4 text-base font-bold text-gov-950 transition hover:border-gov-200 hover:bg-slate-50"
                                        >
                                            {item.label}
                                            <ChevronRight size={18} className="text-slate-400" />
                                        </Link>
                                    ))}
                                </div>

                                <div className="mt-auto pt-8">
                                    <div className="rounded-[1.5rem] bg-gov-950 p-5 text-white">
                                        <p className="text-xs font-black uppercase tracking-[0.24em] text-accent-200">Jam Pelayanan</p>
                                        <p className="mt-4 text-sm font-bold">Senin–Jumat</p>
                                        <p className="text-sm text-white/75">08.00–16.00 WIB</p>
                                        <div className="mt-5 grid gap-3 text-sm text-white/80">
                                            <a className="rounded-xl bg-white/10 px-3 py-2" href={`tel:${site.phone}`}>WhatsApp</a>
                                            <a className="rounded-xl bg-white/10 px-3 py-2" href={`mailto:${site.email}`}>Email</a>
                                            <p className="rounded-xl bg-white/10 px-3 py-2">Alamat: {site.address}</p>
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    );
}