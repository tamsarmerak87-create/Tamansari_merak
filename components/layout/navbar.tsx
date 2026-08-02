import Link from "next/link";
import { Menu, Search, ShieldCheck, Sparkles } from "lucide-react";
import { site } from "@/constants/site";

const nav = [
    { label: "Profil", href: "/profil" },
    { label: "Layanan", href: "/layanan" },
    { label: "Surat Online", href: "/surat-online" },
    { label: "Berita", href: "/berita" },
    { label: "Agenda", href: "/agenda" },
    { label: "Galeri", href: "/galeri" },
    { label: "Pengaduan", href: "/pengaduan" },
    { label: "POSBANKUM", href: "/posbankum" },
    { label: "FAQ", href: "/faq" },
    { label: "Kontak", href: "/kontak" },
] as const;
export function Navbar() {
    return (
        <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
            <div className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-3 py-2 sm:px-4">
                <Link href="/" className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gov-800 via-gov-500 to-accent-600 text-white shadow-soft">
                        <ShieldCheck size={22} />
                    </div>
                    <div className="min-w-0">
                        <b className="block truncate font-display text-sm tracking-tight text-gov-950 md:text-base">{site.name}</b>
                        <span className="hidden text-xs font-semibold text-slate-650 sm:block">{site.district}, {site.city}</span>
                    </div>
                </Link>
                <nav className="hidden items-center gap-1 rounded-full border border-white/70 bg-white/45 p-1 xl:flex">
                    {nav.map((n) => (
                        <a key={n.href} href={n.href} className="rounded-full px-3 py-2 text-xs font-black text-slate-650 transition hover:bg-white hover:text-gov-800">
                            {n.label}
                        </a>
                    ))}
                </nav>
                <div className="flex items-center gap-2">
                    <Link href="/#chat" className="hidden items-center gap-2 rounded-full bg-gov-950 px-4 py-2.5 text-xs font-black text-white shadow-soft transition hover:-translate-y-0.5 sm:inline-flex">
                        <Sparkles size={16} /> TAMSAR AI
                    </Link>
                    <button className="grid size-10 place-items-center rounded-full border border-white/80 bg-white/70 text-gov-900 shadow-soft" aria-label="Pencarian">
                        <Search size={18} />
                    </button>
                    <button className="grid size-10 place-items-center rounded-full bg-accent-600 text-white shadow-soft xl:hidden" aria-label="Menu navigasi">
                        <Menu size={19} />
                    </button>
                </div>
            </div>
        </header>
    );
}