"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Headset, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { site } from "@/constants/site";
import { cn } from "@/utils/cn";
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
    const pathname = usePathname();
    const router = useRouter();
    const accountRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState("");
    const { user, profile, refresh } = useWargaAuth();

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : href === "/#chat" ? false : pathname === href || pathname.startsWith(`${href}/`);

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

    const submitSearch = (event: React.FormEvent) => {
        event.preventDefault();
        const value = query.trim();
        if (!value) return;
        router.push(`/layanan?q=${encodeURIComponent(value)}`);
        setSearchOpen(false);
    };

    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 1380) setOpen(false);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        const closeDropdown = (event: MouseEvent) => {
            if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
        };
        document.addEventListener("mousedown", closeDropdown);
        return () => document.removeEventListener("mousedown", closeDropdown);
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 lg:px-8 lg:pt-5">
            <div className={cn("relative z-50 mx-auto flex min-h-[72px] w-full max-w-[1360px] items-center gap-3 rounded-[24px] border border-white/90 bg-white/88 px-3 py-2.5 backdrop-blur-2xl transition-all duration-300 sm:rounded-[28px] sm:px-5", scrolled ? "shadow-[0_18px_55px_rgba(8,47,73,.14)]" : "shadow-[0_12px_38px_rgba(8,47,73,.09)]")}>
                <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5 whitespace-nowrap min-[1380px]:basis-[220px] sm:gap-3">
                    <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cream-50 shadow-soft ring-1 ring-accent-200/60 sm:size-12">
                        <Image src="/assets/logo-cilegon.png" alt="Logo Cilegon" width={30} height={30} className="h-8 w-8 object-contain" />
                    </div>
                    <div className="min-w-0 leading-tight">
                        <b className="block max-w-[10rem] overflow-hidden text-ellipsis text-sm font-extrabold text-green-700 sm:max-w-[13rem] sm:text-base">{site.name}</b>
                        <span className="hidden text-[11px] font-medium text-slate-650 sm:block">{site.district}, {site.city}</span>
                    </div>
                </Link>

                <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap min-[1380px]:flex">
                    {nav.map((item) => item.href === "/#chat" ? (
                        <button key={item.href} type="button" onClick={openChat} className="relative rounded-full px-2.5 py-2 text-[13px] font-semibold text-gov-900 transition duration-200 hover:bg-green-50 hover:text-green-700">
                            {item.label}
                        </button>
                    ) : (
                        <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={cn("relative rounded-full px-2.5 py-2 text-[13px] font-semibold text-gov-900 transition duration-200 hover:bg-green-50 hover:text-green-700", isActive(item.href) && "bg-green-50 text-green-700 after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-accent-500")}>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
                    {/* Search */}
                    <div className="relative">
                        <button type="button" onClick={() => setSearchOpen((v) => !v)} className="grid size-11 place-items-center rounded-full border border-border-soft bg-white/80 text-gov-900 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:bg-cream-100 focus:outline-none focus:ring-4 focus:ring-green-100" aria-label="Pencarian" aria-expanded={searchOpen}>
                            <Search size={17} />
                        </button>
                        {searchOpen && (
                            <form onSubmit={submitSearch} className="absolute right-0 top-14 flex w-[min(21rem,calc(100vw-2rem))] gap-2 rounded-[22px] border border-border-soft bg-white p-3 shadow-glass">
                                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari layanan..." className="min-w-0 flex-1 rounded-2xl bg-cream-50 px-4 py-2.5 text-sm font-semibold text-gov-950 outline-none ring-1 ring-border-soft transition focus:ring-2 focus:ring-green-600" />
                                <button className="grid size-10 place-items-center rounded-xl bg-green-600 text-white" aria-label="Cari"><Search size={16} /></button>
                            </form>
                        )}
                    </div>

                    {/* TAMSAR CS */}
                    <button type="button" onClick={openChat} className="hidden min-h-11 items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-black text-white shadow-green transition duration-200 hover:-translate-y-0.5 hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-100 sm:inline-flex">
                        <Headset size={16} />
                        <span className="hidden sm:inline">TAMSAR CS</span>
                        <span className="sm:hidden">CS</span>
                    </button>

                    {/* Akun Warga - Desktop */}
                    <div ref={accountRef} className="relative hidden min-[1380px]:block">
                        <button type="button" onClick={() => setAccountOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-soft bg-white/80 px-4 py-2 text-sm font-black text-gov-950 shadow-soft transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-green-100" aria-label="Menu Akun Warga" aria-expanded={accountOpen}>
                            <UserRound size={17} /> Akun Warga <ChevronDown size={15} className={cn("transition duration-200", accountOpen && "rotate-180")} />
                        </button>
                        {accountOpen && (
                            <div className="absolute right-0 mt-3 w-64 rounded-[24px] border border-border-soft bg-white p-3 shadow-glass">
                                {user ? (
                                    <>
                                        <p className="px-3 pb-2 text-xs font-black uppercase tracking-[.18em] text-accent-600">{profile?.nama_lengkap ?? "Warga"}</p>
                                        {[["Dashboard Saya", "/dashboard"], ["Pengajuan Saya", "/dashboard#pengajuan"], ["Profil", "/dashboard#profil"], ["Notifikasi", "/dashboard#notifikasi"]].map(([label, href]) => <Link key={href} href={href as Route} onClick={() => setAccountOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-green-50">{label}</Link>)}
                                        <button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"><LogOut size={16} />Keluar</button>
                                    </>
                                ) : (
                                    <>
                                        <Link href="/login" onClick={() => setAccountOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-green-50">Masuk</Link>
                                        <Link href="/register" onClick={() => setAccountOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-green-50">Daftar</Link>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mobile Hamburger */}
                    <div className="min-[1380px]:hidden">
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
                                    <div className="rounded-2xl border border-border-soft bg-green-50/50 p-3">
                                        <p className="flex items-center gap-2 px-2 pb-2 text-xs font-black uppercase tracking-[.18em] text-accent-600"><UserRound size={14} /> Akun Warga</p>
                                        {user ? (
                                            <>
                                                {[["Dashboard Saya", "/dashboard"], ["Pengajuan Saya", "/dashboard#pengajuan"], ["Profil", "/dashboard#profil"], ["Notifikasi", "/dashboard#notifikasi"]].map(([label, href]) => <Link key={href} href={href as Route} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-gov-950 transition hover:bg-white">{label}<ChevronRight size={18} className="text-slate-400" /></Link>)}
                                                <button type="button" onClick={signOut} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-red-600 transition hover:bg-white">Keluar<LogOut size={18} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <Link href="/login" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-gov-950 transition hover:bg-white">Masuk<ChevronRight size={18} className="text-slate-400" /></Link>
                                                <Link href="/register" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-bold text-gov-950 transition hover:bg-white">Daftar<ChevronRight size={18} className="text-slate-400" /></Link>
                                            </>
                                        )}
                                    </div>
                                    {mobileNav.map((item) => item.href === "/#chat" ? (
                                        <button
                                            key={item.href}
                                            type="button"
                                            onClick={openChat}
                                            className={cn("flex w-full items-center justify-between rounded-2xl border border-border-soft px-4 py-4 text-left text-base font-bold text-gov-950 transition hover:border-green-200 hover:bg-green-50")}
                                        >
                                            {item.label}
                                            <ChevronRight size={18} className="text-slate-400" />
                                        </button>
                                    ) : (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setOpen(false)}
                                            aria-current={isActive(item.href) ? "page" : undefined}
                                            className={cn("flex items-center justify-between rounded-2xl border border-border-soft px-4 py-4 text-base font-bold text-gov-950 transition hover:border-green-200 hover:bg-green-50", isActive(item.href) && "border-green-200 bg-green-50 text-green-700")}
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
