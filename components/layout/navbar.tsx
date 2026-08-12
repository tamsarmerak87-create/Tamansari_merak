"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Car, ChevronDown, ChevronRight, FileText, KeyRound, LayoutDashboard, LogIn, LogOut, MapPinned, Menu, Search, UserPlus, UserRound, X } from "lucide-react";
import { site } from "@/constants/site";
import { cn } from "@/utils/cn";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { isVerified, logoutWarga } from "@/services/warga-auth.service";

const nav = [
    { label: "Beranda", href: "/" },
    { label: "Pelayanan", href: "/#layanan" },
    { label: "POSBANKUM", href: "/posbankum" },
] as const;

const vehicleTaxUrl = "https://infopkb.bantenprov.go.id/";

const mobileNav: { label: string; href: Route; }[] = [...nav];

const wargaMenu = [
    { label: "Layanan", href: "/layanan", icon: LayoutDashboard },
    { label: "Pengajuan Saya", href: "/dashboard#pengajuan", icon: FileText },
    { label: "Tracking Dokumen", href: "/surat-online/tracking", icon: MapPinned },
    { label: "Profil Saya", href: "/dashboard#profil", icon: UserRound },
] as const;

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
        href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

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
        <header className="sticky top-0 z-50 w-full max-w-[100vw] px-2 pt-2 sm:px-6 lg:px-8 lg:pt-5">
            <div className={cn("relative z-50 mx-auto flex min-h-[70px] w-full max-w-[1360px] items-center gap-1.5 rounded-[22px] border border-white/90 bg-white/88 px-2 py-2 backdrop-blur-2xl transition-all duration-300 min-[390px]:gap-2.5 min-[390px]:px-3 sm:min-h-[72px] sm:gap-3 sm:rounded-[28px] sm:px-5", scrolled ? "shadow-[0_18px_55px_rgba(8,47,73,.14)]" : "shadow-[0_12px_38px_rgba(8,47,73,.09)]")}>
                <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap min-[1380px]:basis-[220px] min-[1380px]:flex-none sm:gap-3">
                    <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-cream-50 shadow-soft ring-1 ring-accent-200/60 min-[390px]:size-10 sm:size-12 sm:rounded-2xl">
                        <Image src="/assets/logo-cilegon.png" alt="Logo Cilegon" width={30} height={30} className="h-7 w-7 object-contain min-[390px]:h-8 min-[390px]:w-8" />
                    </div>
                    <div className="min-w-0 leading-tight">
                        <b className="block max-w-[7.1rem] overflow-hidden text-ellipsis text-[12px] font-extrabold text-gov-800 min-[375px]:max-w-[9rem] min-[390px]:text-sm sm:max-w-[13rem] sm:text-base">{site.name}</b>
                        <span className="hidden text-[11px] font-medium text-slate-650 sm:block">{site.district}, {site.city}</span>
                    </div>
                </Link>

                <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap lg:flex">
                    {nav.map((item) => (
                        <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={cn("relative rounded-full px-3 py-2 text-[13px] font-black text-gov-900 transition duration-200 hover:bg-gov-50 hover:text-gov-800", isActive(item.href) && "bg-gov-50 text-gov-800 after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-accent-500")}>
                            {item.label}
                        </Link>
                    ))}
                    <a href={vehicleTaxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-black text-gov-900 transition duration-200 hover:bg-gov-50 hover:text-gov-800">
                        <Car size={15} /> Cek Pajak Kendaraan
                    </a>
                </nav>

                <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap min-[390px]:gap-2">
                    {/* Search */}
                    <div className="relative">
                        <button type="button" onClick={() => setSearchOpen((v) => !v)} className="grid size-10 place-items-center rounded-full border border-border-soft bg-white/80 text-gov-900 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:bg-cream-100 focus:outline-none focus:ring-4 focus:ring-gov-100 sm:size-11" aria-label="Pencarian" aria-expanded={searchOpen}>
                            <Search size={16} />
                        </button>
                        {searchOpen && (
                            <form onSubmit={submitSearch} className="fixed left-2 right-2 top-[86px] z-[70] flex gap-2 rounded-[22px] border border-border-soft bg-white p-3 shadow-glass sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-[min(21rem,calc(100vw-2rem))]">
                                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari layanan..." className="min-w-0 flex-1 rounded-2xl bg-cream-50 px-4 py-2.5 text-sm font-semibold text-gov-950 outline-none ring-1 ring-border-soft transition focus:ring-2 focus:ring-gov-500" />
                                <button className="grid size-10 place-items-center rounded-xl bg-gov-800 text-white" aria-label="Cari"><Search size={16} /></button>
                            </form>
                        )}
                    </div>

                    {/* Menu akun */}
                    <div ref={accountRef} className="relative">
                        <button type="button" onClick={() => setAccountOpen((value) => !value)} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-2 text-xs font-black text-gov-950 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:bg-gov-50 hover:text-gov-800 focus:outline-none focus:ring-4 focus:ring-gov-100 min-[390px]:min-h-11 min-[390px]:gap-2 min-[390px]:text-sm sm:px-4", accountOpen && "bg-gov-50 text-gov-800 ring-4 ring-gov-100")} aria-label="Menu Akun" aria-expanded={accountOpen}>
                            <UserRound size={16} /> <span className="hidden min-[375px]:inline">Akun</span> <ChevronDown size={14} className={cn("transition duration-200", accountOpen && "rotate-180")} />
                        </button>
                        {accountOpen && (
                            <div className="absolute right-0 top-14 z-[60] w-[min(18.5rem,calc(100vw-1.5rem))] rounded-[20px] border border-border-soft bg-white p-3 shadow-[0_22px_70px_rgba(8,47,73,.18)]">
                                {user ? (
                                    <>
                                        <div className="my-2 h-px bg-gov-100" />
                                        <p className="rounded-2xl bg-cream-50 px-4 py-3 text-sm font-black text-gov-950">{profile?.nama_lengkap ?? "Pengguna"}</p>
                                        {!isVerified(profile) ? <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">Akun Anda sedang menunggu verifikasi.</p> : null}
                                        <div className="my-2 h-px bg-gov-100" />
                                        {wargaMenu.map(({ label, href, icon: Icon }) => <Link key={href} href={href as Route} onClick={() => setAccountOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-gov-50 hover:text-gov-800"><Icon size={16} className="text-gov-800" />{label}</Link>)}
                                        <button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"><LogOut size={16} />Keluar</button>
                                    </>
                                ) : (
                                    <>
                                        <Link href="/login" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-gov-50 hover:text-gov-800"><LogIn size={16} className="text-gov-800" />Akun</Link>
                                        <Link href="/register" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-gov-50 hover:text-gov-800"><UserPlus size={16} className="text-gov-800" />Daftar Akun</Link>
                                        <Link href="/login?mode=forgot" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-gov-950 transition hover:bg-gov-50 hover:text-gov-800"><KeyRound size={16} className="text-gov-800" />Lupa Password</Link>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mobile Hamburger */}
                    <div className="lg:hidden">
                        <Sheet open={open} onOpenChange={setOpen}>
                            <SheetTrigger
                                aria-label="Buka menu navigasi"
                                className="pointer-events-auto grid size-10 place-items-center rounded-full bg-gov-800 text-white shadow-soft transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-gov-100 sm:size-11"
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
                                            aria-current={isActive(item.href) ? "page" : undefined}
                                            className={cn("flex items-center justify-between rounded-2xl border border-border-soft px-4 py-4 text-base font-bold text-gov-950 transition hover:border-gov-100 hover:bg-gov-50", isActive(item.href) && "border-gov-100 bg-gov-50 text-gov-800")}
                                        >
                                            {item.label}
                                            <ChevronRight size={18} className="text-slate-400" />
                                        </Link>
                                    ))}
                                    <a
                                        href={vehicleTaxUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setOpen(false)}
                                        className="flex items-center justify-between rounded-2xl border border-border-soft px-4 py-4 text-base font-bold text-gov-950 transition hover:border-gov-100 hover:bg-gov-50"
                                    >
                                        <span className="inline-flex items-center gap-2"><Car size={18} className="text-gov-800" /> Cek Pajak Kendaraan</span>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </a>
                                    <Link
                                        href="/login"
                                        onClick={() => setOpen(false)}
                                        className="flex items-center justify-between rounded-2xl border border-border-soft px-4 py-4 text-base font-bold text-gov-950 transition hover:border-gov-100 hover:bg-gov-50"
                                    >
                                        Akun
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </Link>
                                </div>

                                <div className="mt-auto pt-8">
                                    <div className="rounded-[1.5rem] bg-gov-950 p-5 text-white">
                                        <p className="text-xs font-black uppercase tracking-[0.24em] text-accent-200">Jam Pelayanan</p>
                                        <p className="mt-4 text-sm font-bold">Senin-Jumat</p>
                                        <p className="text-sm text-white/75">08.00-16.00 WIB</p>
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












