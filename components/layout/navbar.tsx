"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Headset, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { site } from "@/constants/site";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { logoutWarga } from "@/services/warga-auth.service";

const nav = [
    { label: "Beranda", href: "/" },
    { label: "Profil", href: "/profil" },
    { label: "Layanan", href: "/layanan" },
    { label: "Surat Online", href: "/surat-online" },
    { label: "Berita", href: "/berita" },
    { label: "Agenda", href: "/agenda" },
    { label: "POSBANKUM", href: "/posbankum" },
    { label: "FAQ", href: "/faq" },
    { label: "TAMSAR", href: "/#chat" },
] as const;

const mobileNav: { label: string; href: Route; }[] = [
    ...nav,
    { label: "Kontak", href: "/kontak" },
];

export function Navbar() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const { user, profile, refresh } = useWargaAuth();

    const openChat = () => {
        window.dispatchEvent(new CustomEvent("tamsar-chat:open"));
        setOpen(false);
    };

    const signOut = async () => {
        try {
            await logoutWarga();
            await refresh();
            setAccountOpen(false);
            setOpen(false);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Gagal keluar akun.");
        }
    };

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
        <header className="sticky top-0 z-50 px-5 pt-2 sm:px-10 lg:px-20 lg:pt-3">
            <div className={`glass relative z-50 mx-auto flex min-h-16 w-full max-w-[1440px] items-center gap-3 rounded-[1.4rem] border border-white/80 px-3 py-2 backdrop-blur-2xl transition-all duration-300 sm:rounded-[1.8rem] sm:px-4 sm:py-3 ${scrolled ? "shadow-[0_18px_60px_rgba(15,39,72,.18)]" : "shadow-[0_10px_35px_rgba(15,39,72,.10)]"}`}>
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
                    {nav.map((item) => item.href === "/#chat" ? (
                        <button key={item.href} type="button" onClick={openChat} className="rounded-full px-4 py-2 text-sm font-semibold text-gov-900 transition hover:bg-white hover:text-gov-800">
                            {item.label}
                        </button>
                    ) : (
                        <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 text-sm font-semibold text-gov-900 transition hover:bg-white hover:text-gov-800">
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    <button className="grid size-11 place-items-center rounded-full border border-white/80 bg-white/70 text-gov-900 shadow-soft transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-gov-100" aria-label="Pencarian">
                        <Search size={17} />
                    </button>
                    <button type="button" onClick={openChat} className="hidden min-h-11 items-center gap-2 rounded-full bg-gov-800 px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-gov-900 focus:outline-none focus:ring-4 focus:ring-gov-100 sm:inline-flex">
                        <Headset size={16} />
                        <span className="hidden sm:inline">TAMSAR CS</span>
                        <span className="sm:hidden">CS</span>
                    </button>
                    <div className="relative hidden xl:block">
                        <button type="button" onClick={() => setAccountOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/80 bg-white/75 px-4 py-2 text-sm font-black text-gov-950 shadow-soft transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-gov-100" aria-label="Menu Akun Warga">
                            <UserRound size={17} /> Akun Warga <ChevronDown size={15} />
                        </button>
                        {accountOpen ? <div className="absolute right-0 mt-3 w-64 rounded-[24px] border border-white bg-white p-3 shadow-[0_24px_80px_rgba(15,39,72,.18)]">
                            {user ? <>
                                <p className="px-3 pb-2 text-xs font-black uppercase tracking-[.18em] text-accent-600">{profile?.nama_lengkap ?? "Warga"}</p>
                                {[["Dashboard Saya", "/dashboard"], ["Pengajuan Saya", "/dashboard#pengajuan"], ["Profil", "/dashboard#profil"], ["Notifikasi", "/dashboard#notifikasi"]].map(([label, href]) => <Link key={href} href={href as Route} onClick={() => setAccountOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-gov-50">{label}</Link>)}
                                <button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"><LogOut size={16} />Keluar</button>
                            </> : <>
                                <Link href="/login" onClick={() => setAccountOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-gov-50">Masuk</Link>
                                <Link href="/register" onClick={() => setAccountOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-gov-50">Daftar</Link>
                            </>}
                        </div> : null}
                    </div>
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
                                    <div className="rounded-2xl border border-slate-100 bg-gov-50 p-3">
                                        <p className="px-2 pb-2 text-xs font-black uppercase tracking-[.18em] text-accent-600">👤 Akun Warga</p>
                                        {user ? <>
                                            {[["Dashboard Saya", "/dashboard"], ["Pengajuan Saya", "/dashboard#pengajuan"], ["Profil", "/dashboard#profil"], ["Notifikasi", "/dashboard#notifikasi"]].map(([label, href]) => <Link key={href} href={href as Route} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-gov-950 transition hover:bg-white">{label}<ChevronRight size={18} className="text-slate-400" /></Link>)}
                                            <button type="button" onClick={signOut} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-red-600 transition hover:bg-white">Keluar<LogOut size={18} /></button>
                                        </> : <>
                                            <Link href="/login" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-gov-950 transition hover:bg-white">Masuk<ChevronRight size={18} className="text-slate-400" /></Link>
                                            <Link href="/register" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-gov-950 transition hover:bg-white">Daftar<ChevronRight size={18} className="text-slate-400" /></Link>
                                        </>}
                                    </div>
                                    {mobileNav.map((item) => item.href === "/#chat" ? (
                                        <button
                                            key={item.href}
                                            type="button"
                                            onClick={openChat}
                                            className="flex w-full items-center justify-between rounded-2xl border border-slate-100 px-4 py-4 text-left text-base font-bold text-gov-950 transition hover:border-gov-200 hover:bg-slate-50"
                                        >
                                            {item.label}
                                            <ChevronRight size={18} className="text-slate-400" />
                                        </button>
                                    ) : (
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