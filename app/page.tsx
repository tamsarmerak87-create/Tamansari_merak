import { HomeHero } from "@/components/hero/home-hero";
import { ServicesCarousel } from "@/components/services/services-carousel";
import { QuickAccess } from "@/components/quick-access/quick-access";
import { services } from "@/constants/site";
import { MotionShell } from "@/components/common/motion-shell";
import { Headset, Star } from "lucide-react";

export default function HomePage() {
    return (
        <main id="top" className="premium-shell min-h-screen overflow-hidden">
            <HomeHero />
            <ServicesCarousel services={services} />
            <QuickAccess />
            <section id="chat" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
                <MotionShell>
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-gov-800 p-8 text-white shadow-glass sm:p-10 lg:p-12">
                        <div className="absolute right-0 top-0 h-72 w-72 translate-x-1/3 -translate-y-1/3 rounded-full bg-accent-400/35 blur-3xl" />
                        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-accent-200 ring-1 ring-white/15"><Star size={16} /> TAMSAR CS</span>
                                <h2 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">Customer service digital untuk menemukan layanan lebih cepat.</h2>
                                <p className="mt-4 max-w-2xl text-lg leading-8 text-white/72">Bantuan informasi layanan, alur pengajuan, dokumen persyaratan, dan kontak cepat Kelurahan Tamansari.</p>
                            </div>
                            <div className="grid size-28 place-items-center rounded-[2rem] bg-accent-400 text-gov-950 shadow-gold"><Headset size={48} /></div>
                        </div>
                    </div>
                </MotionShell>
            </section>
        </main>
    );
}