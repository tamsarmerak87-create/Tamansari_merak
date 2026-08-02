import Link from "next/link";
import Image from "next/image";
import { Headset, Menu, Search } from "lucide-react";
import { site } from "@/constants/site";

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

export function Navbar() {
    return (
        <header className="sticky top-0 z-50 px-2 pt-2 sm:px-5 lg:px-8 lg:pt-3">
            <div className="glass mx-auto flex h-16 max-w-7xl items-center gap-3 rounded-[1.4rem] border border-white/80 px-3 shadow-[0_18px_60px_rgba(15,39,72,.14)] backdrop-blur-2xl sm:h-auto sm:rounded-[1.8rem] sm:px-4 sm:py-3">
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
                    <button className="grid size-10 place-items-center rounded-full border border-white/80 bg-white/70 text-gov-900 shadow-soft transition hover:-translate-y-0.5 sm:size-11" aria-label="Pencarian">
                        <Search size={17} />
                    </button>
                    <Link href="/#chat" className="inline-flex items-center gap-2 rounded-full bg-gov-800 px-3.5 py-2.5 text-xs font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-gov-900 sm:px-5 sm:py-3 sm:text-sm">
                        <Headset size={16} />
                        <span className="hidden sm:inline">TAMSAR CS</span>
                        <span className="sm:hidden">CS</span>
                    </Link>
                    <button className="grid size-10 place-items-center rounded-full bg-gov-800 text-white shadow-soft transition hover:-translate-y-0.5 xl:hidden sm:size-11" aria-label="Menu navigasi">
                        <Menu size={19} />
                    </button>
                </div>
            </div>
        </header>
    );
}