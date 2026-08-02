import { site } from "@/constants/site";
import Image from "next/image";
import { Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

export function Footer() {
    return (
        <footer className="relative overflow-hidden bg-gov-950 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(45,212,126,.24),transparent_28rem),radial-gradient(circle_at_85%_10%,rgba(20,120,212,.28),transparent_26rem)]" />
            <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_.8fr_.8fr] lg:px-8 lg:py-18">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15"><Image src="/assets/logo-cilegon.png" alt="Logo Cilegon" width={30} height={30} className="h-7 w-7 object-contain" /></div>
                        <h2 className="font-display text-3xl font-black tracking-tight">{site.name}</h2>
                    </div>
                    <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">Portal pemerintahan digital modern untuk masyarakat Tamansari: cepat, mudah, transparan, dan siap berkembang menjadi Super App Kelurahan.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                    <b className="font-display text-lg">Layanan</b>
                    <p className="mt-4 leading-7 text-white/68">Administrasi, Pengaduan, POSBANKUM, Tracking Surat, dan TAMSAR CS.</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
                    <b className="font-display text-lg">Kontak</b>
                    <div className="mt-4 space-y-3 text-sm text-white/72">
                        <p className="flex gap-3"><Phone size={17} className="mt-0.5 text-accent-400" />{site.phone}</p>
                        <p className="flex gap-3"><Mail size={17} className="mt-0.5 text-accent-400" />{site.email}</p>
                        <p className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-accent-400" />{site.address}</p>
                    </div>
                </div>
            </div>
            <div className="relative border-t border-white/10 px-4 py-5 text-center text-xs font-semibold uppercase tracking-[0.25em] text-white/45">Pelayanan Digital Cepat, Mudah, Transparan</div>
        </footer>
    );
}