import Link from "next/link";
import Image from "next/image";
import { Headset, Menu, Search, ShieldCheck } from "lucide-react";
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
        <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 lg:px-8">
            <div className="glass mx-auto flex max-w-7xl items-center gap-4 rounded-[1.6rem] border border-white/75 px-4 py-3 shadow-gold backdrop-blur-2xl">
                <Link href="/" className="flex min-w-0 items-center gap-3 pr-2">
                    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-border-soft">
                        <Image src="/assets/logo-cilegon.png" alt="Logo Cilegon" width={28} height={28} className="h-7 w-7 object-contain" />
                    </div>
                    <div className="min-w-0 leading-tight">
                        <b className="block truncate text-sm font-black text-gov-950 sm:text-base">{site.name}</b>
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
                    <button className="grid size-11 place-items-center rounded-full border border-white/80 bg-white/70 text-gov-900 shadow-soft transition hover:-translate-y-0.5" aria-label="Pencarian">
                        <Search size={18} />
                    </button>
                    <Link href="/#chat" className="inline-flex items-center gap-2 rounded-full bg-gov-800 px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-gov-900">
                        <Headset size={17} />
                        TAMSAR CS
                    </Link>
                    <button className="grid size-11 place-items-center rounded-full bg-gov-800 text-white shadow-soft transition hover:-translate-y-0.5 xl:hidden" aria-label="Menu navigasi">
                        <Menu size={19} />
                    </button>
                </div>
            </div>
        </header>
    );
}