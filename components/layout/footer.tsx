import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { site } from "@/constants/site";

const footerLinks = [
    { label: "Profil", href: "/profil" },
    { label: "Layanan", href: "/layanan" },
    { label: "Tracking Dokumen", href: "/surat-online/tracking" },
    { label: "POSBANKUM", href: "/posbankum" },
    { label: "Kontak", href: "/kontak" },
] as const;

export function Footer() {
    return (
        <footer className="relative overflow-hidden bg-gov-950 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(34,197,94,.16),transparent_30rem),radial-gradient(circle_at_88%_12%,rgba(234,179,8,.14),transparent_26rem)]" />
            <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[1.3fr_.7fr_1fr] lg:px-8 lg:py-20">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15"><Image src="/assets/logo-cilegon.png" alt="Logo Cilegon" width={30} height={30} className="h-8 w-8 object-contain" /></div>
                        <div>
                            <h2 className="font-display text-2xl font-black tracking-tight">Kelurahan Tamansari</h2>
                            <p className="mt-0.5 text-sm font-semibold text-accent-200">Kecamatan Pulomerak, Kota Cilegon</p>
                        </div>
                    </div>
                    <p className="mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">Portal pelayanan digital resmi Kelurahan Tamansari yang cepat, mudah, transparan, dan berorientasi pada kebutuhan warga.</p>
                </div>

                <nav className="rounded-[24px] border border-white/10 bg-white/[.06] p-5 backdrop-blur-xl sm:p-6" aria-label="Navigasi footer">
                    <b className="font-display text-lg text-accent-200">Tautan Cepat</b>
                    <div className="mt-4 grid gap-2">
                        {footerLinks.map((item) => <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-sm font-semibold text-white/75 transition duration-200 hover:bg-white/10 hover:text-accent-200">{item.label}</Link>)}
                    </div>
                </nav>

                <div className="rounded-[24px] border border-white/10 bg-white/[.06] p-5 backdrop-blur-xl sm:p-6">
                    <b className="font-display text-lg text-accent-200">Kontak & Lokasi</b>
                    <div className="mt-4 space-y-4 text-sm text-white/75">
                        <a href={`tel:${site.phone}`} className="flex gap-3 transition hover:text-white"><Phone size={17} className="mt-0.5 shrink-0 text-accent-400" />{site.phone}</a>
                        <a href={`mailto:${site.email}`} className="flex gap-3 transition hover:text-white"><Mail size={17} className="mt-0.5 shrink-0 text-accent-400" />{site.email}</a>
                        <p className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-accent-400" />{site.address}</p>
                        <p className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold">Jam Pelayanan: Senin–Jumat, 08.00–16.00 WIB</p>
                    </div>
                </div>
            </div>
            <div className="relative border-t border-white/10 px-4 py-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/50">© {new Date().getFullYear()} Kelurahan Tamansari · Pelayanan Digital Cepat, Mudah, Transparan</div>
        </footer>
    );
}
