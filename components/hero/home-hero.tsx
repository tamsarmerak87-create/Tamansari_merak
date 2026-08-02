import Image from "next/image";
import { ArrowRight, Clock3, Grid3X3, Headset, MapPin, Send, Sparkles } from "lucide-react";
import { site } from "@/constants/site";
import { Button } from "@/components/ui/button";
import { MotionShell } from "@/components/common/motion-shell";
import { HeroStats } from "@/components/stats/hero-stats";

const badges = ["Modern", "Cepat", "Transparan", "Terpercaya"];

export function HomeHero() {
    return (
        <section className="relative -mt-20 min-h-screen px-4 pb-12 pt-28 sm:px-6 lg:px-8 lg:pt-32">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(15,39,72,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,39,72,0.035)_1px,transparent_1px)] bg-[size:88px_88px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
            <div className="pointer-events-none absolute right-6 top-28 -z-10 size-72 rounded-full bg-accent-400/14 blur-3xl" />
            <div className="pointer-events-none absolute bottom-16 left-8 -z-10 size-56 rounded-full bg-gov-800/8 blur-3xl" />

            <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl items-center gap-10 lg:grid-cols-[45fr_55fr] xl:gap-14">
                <MotionShell className="relative z-10 pt-8 lg:pt-4">
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border-soft bg-white/86 px-4 py-2 text-sm font-bold text-gov-800 shadow-soft backdrop-blur-xl">
                        <Sparkles size={16} className="text-accent-700" />
                        {badges.map((badge, index) => <span key={badge}>{index > 0 ? <span className="mx-1 text-accent-600">•</span> : null}{badge}</span>)}
                    </div>

                    <h1 className="mt-6 max-w-[760px] text-balance font-black leading-[1.03] tracking-[-0.055em] text-gov-950 [font-size:clamp(3rem,5.3vw,5.85rem)]">
                        Portal Pelayanan Digital <span className="block bg-gradient-to-r from-gov-800 via-accent-700 to-accent-400 bg-clip-text text-transparent">Kelurahan Tamansari</span>
                    </h1>

                    <p className="mt-6 max-w-[580px] text-base font-medium leading-[1.8] text-gov-900/78 sm:text-lg">
                        Menghadirkan 33 pelayanan administrasi resmi, pengajuan surat online, pelacakan status permohonan, POSBANKUM, pengaduan masyarakat, dan TAMSAR CS dalam satu platform digital yang cepat, aman, transparan, dan mudah diakses.
                    </p>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <Button href="/surat-online" className="group" aria-label="Ajukan layanan online"><Send size={20} /> Ajukan Layanan <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Button>
                        <Button href="#layanan" variant="gold" aria-label="Lihat 33 pelayanan"><Grid3X3 size={20} /> Lihat 33 Pelayanan</Button>
                        <Button href="#chat" variant="glass" aria-label="Chat TAMSAR CS"><Headset size={20} /> Chat TAMSAR CS</Button>
                    </div>

                    <HeroStats />
                </MotionShell>

                <MotionShell delay={0.12} className="relative min-h-[28rem] lg:min-h-[42rem]">
                    <div className="absolute -left-6 top-10 h-[82%] w-[56%] rounded-[999px] border-[14px] border-accent-400/28 bg-accent-100/20 blur-[0.2px] lg:-left-10" />
                    <div className="absolute right-4 top-4 size-24 rounded-bl-[4rem] rounded-tr-[2rem] bg-accent-400/55 blur-[0.2px]" />
                    <div className="absolute -right-4 bottom-10 size-32 rounded-full bg-white/70 shadow-gold backdrop-blur-2xl" />

                    <div className="relative h-full overflow-hidden rounded-[32px] border-[10px] border-white bg-white shadow-xl ring-1 ring-border-soft/80">
                        <Image
                            src="/assets/kantor-tamansari.jpg"
                            alt="Gedung Kantor Kelurahan Tamansari"
                            fill
                            priority
                            sizes="(min-width: 1024px) 55vw, 100vw"
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gov-950/42 via-gov-950/4 to-white/8" />
                        <div className="absolute left-5 top-5 rounded-2xl border border-white/60 bg-white/82 px-4 py-3 text-sm font-black text-gov-950 shadow-soft backdrop-blur-xl sm:left-6 sm:top-6">
                            <MapPin size={16} className="mr-2 inline text-accent-700" />{site.city}
                        </div>
                        <div className="absolute bottom-5 left-5 right-5 max-w-sm rounded-[28px] border border-white/15 bg-gov-800/94 p-5 text-white shadow-glass backdrop-blur-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:p-6">
                            <div className="flex items-center gap-3"><Clock3 className="text-accent-400" /><b className="text-sm font-black">Jam Pelayanan</b></div>
                            <div className="mt-5 grid grid-cols-2 gap-4 text-sm font-medium text-white/88">
                                <p><b className="block text-white">Senin-Jumat</b>08.00-16.00 WIB</p>
                                <p><b className="block text-white">Istirahat</b>12.00-13.00 WIB</p>
                            </div>
                        </div>
                    </div>
                </MotionShell>
            </div>
        </section>
    );
}