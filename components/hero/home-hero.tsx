import Image from "next/image";
import { ArrowRight, BadgeCheck, Clock3, Grid3X3, Headset, MapPin, Send, Sparkles } from "lucide-react";
import { site } from "@/constants/site";
import { Button } from "@/components/ui/button";
import { MotionShell } from "@/components/common/motion-shell";
import { HeroStats } from "@/components/stats/hero-stats";

const badges = ["Modern", "Cepat", "Transparan", "Terpercaya"];

export function HomeHero() {
    return (
        <section className="relative overflow-hidden px-5 pb-[60px] pt-6 sm:px-10 sm:pb-20 sm:pt-8 lg:px-20 lg:pt-10 xl:pb-[120px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-20 hidden h-[44rem] bg-[radial-gradient(circle_at_22%_28%,rgba(244,180,0,.26),transparent_24rem),radial-gradient(circle_at_82%_26%,rgba(15,39,72,.18),transparent_28rem)] md:block" />
            <div className="pointer-events-none absolute inset-0 -z-20 hidden bg-[linear-gradient(rgba(15,39,72,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,39,72,0.045)_1px,transparent_1px)] bg-[size:76px_76px] [mask-image:linear-gradient(to_bottom,black,transparent_86%)] md:block" />
            <div className="pointer-events-none absolute left-[46%] top-16 -z-20 hidden h-72 w-72 rounded-full border-[18px] border-accent-400/24 lg:block" />
            <div className="pointer-events-none absolute right-10 top-56 -z-20 hidden size-28 rounded-full bg-white/80 shadow-gold lg:block" />

            <div className="relative z-10 mx-auto grid w-full max-w-[1440px] items-center gap-10 md:grid-cols-2 lg:grid-cols-[55fr_45fr] xl:gap-14">
                <MotionShell className="relative z-10 min-w-0 pt-4 lg:pt-0">
                    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/80 bg-white/88 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-gov-800 shadow-soft backdrop-blur-xl sm:text-sm">
                        <Sparkles size={16} className="text-accent-700" />
                        {badges.map((badge, index) => <span key={badge}>{index > 0 ? <span className="mx-1 text-accent-600">•</span> : null}{badge}</span>)}
                    </div>

                    <h1 className="mt-5 max-w-[820px] text-balance font-black leading-[1.04] tracking-normal text-gov-950 [font-size:clamp(36px,6vw,72px)]">
                        Portal Pelayanan Digital <span className="block bg-gradient-to-r from-gov-800 via-accent-700 to-accent-400 bg-clip-text text-transparent">Kelurahan Tamansari</span>
                    </h1>

                    <p className="mt-5 w-full max-w-[680px] font-semibold leading-[1.5] text-gov-900/76 [font-size:clamp(18px,2vw,24px)]">
                        Menghadirkan 33 pelayanan administrasi resmi, pengajuan surat online, pelacakan status permohonan, POSBANKUM, pengaduan masyarakat, dan TAMSAR CS dalam satu platform digital yang cepat, aman, transparan, dan mudah diakses.
                    </p>

                    <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                        <Button href="/surat-online" className="group" aria-label="Ajukan layanan online"><Send size={20} /> Ajukan Layanan <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Button>
                        <Button href="#layanan" variant="gold" aria-label="Lihat 33 pelayanan"><Grid3X3 size={20} /> Lihat 33 Pelayanan</Button>
                        <Button href="#chat" variant="glass" aria-label="Chat TAMSAR CS"><Headset size={20} /> Chat TAMSAR CS</Button>
                    </div>

                    <HeroStats />
                </MotionShell>

                <MotionShell delay={0.12} className="relative z-10 w-full min-w-0 self-start md:mt-6 lg:mt-2">
                    <div className="absolute -left-5 top-8 hidden h-[86%] w-[60%] rounded-[999px] border-[16px] border-accent-400/32 bg-accent-100/25 lg:block" />
                    <div className="absolute right-0 top-2 hidden size-28 rounded-[2.25rem] bg-accent-400/75 shadow-gold lg:block" />
                    <div className="absolute -right-3 bottom-10 hidden size-36 rounded-full bg-white/80 shadow-gold backdrop-blur-2xl lg:block" />

                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_28px_80px_rgba(15,39,72,.18)] ring-1 ring-border-soft/80 lg:border-[10px]">
                        <Image
                            src="/assets/kantor-tamansari.jpg"
                            alt="Gedung Kantor Kelurahan Tamansari"
                            fill
                            loading="lazy"
                            sizes="(min-width: 1280px) 45vw, (min-width: 640px) 50vw, 100vw"
                            className="h-auto max-w-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gov-950/62 via-gov-950/12 to-white/4" />
                        <div className="absolute left-4 top-4 rounded-2xl border border-white/60 bg-white/82 px-3 py-2 text-xs font-black text-gov-950 shadow-soft backdrop-blur-xl sm:left-6 sm:top-6 sm:px-4 sm:py-3 sm:text-sm">
                            <MapPin size={16} className="mr-2 inline text-accent-700" />{site.city}
                        </div>
                        <div className="absolute left-5 top-24 hidden max-w-xs rounded-[1.6rem] border border-white/40 bg-white/84 p-4 text-gov-950 shadow-soft backdrop-blur-2xl sm:block">
                            <div className="flex items-center gap-3"><BadgeCheck className="text-accent-700" /><b className="text-sm font-black">Pelayanan Terpadu</b></div>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-650">Administrasi, konsultasi, dan pengaduan dalam satu portal.</p>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 rounded-[24px] border border-white/15 bg-gov-800/94 p-4 text-white shadow-glass backdrop-blur-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md sm:p-5 lg:p-6">
                            <div className="flex items-center gap-3"><Clock3 className="text-accent-400" /><b className="text-sm font-black">Jam Pelayanan</b></div>
                            <div className="mt-4 grid grid-cols-1 gap-3 text-sm font-medium leading-[1.5] text-white/88 sm:grid-cols-2 sm:gap-4">
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