import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionShell } from "@/components/common/motion-shell";

const badges = ["Modern", "Cepat", "Transparan", "Terpercaya"];

export function HomeHero() {
    return (
        <section className="relative overflow-hidden px-4 pb-8 pt-8 min-[390px]:px-5 sm:px-8 sm:pb-14 sm:pt-12 lg:px-12 lg:pb-16 lg:pt-14 xl:px-16">
            {/* Decorative shapes — deliberately subtle and behind content */}
            <div className="pointer-events-none absolute -left-28 top-32 -z-10 size-56 rounded-full border-[24px] border-accent-400/8 sm:-left-40 sm:top-48 sm:size-[30rem] sm:border-[48px]" />
            <div className="pointer-events-none absolute left-[39%] top-32 -z-10 hidden size-[27rem] rounded-full border-[34px] border-accent-400/18 lg:block" />
            <div className="pointer-events-none absolute right-[-5rem] top-10 -z-10 size-56 rounded-full bg-gov-100/35 blur-3xl sm:right-[-8rem] sm:top-16 sm:size-[30rem]" />
            <div className="pointer-events-none absolute left-2 top-44 -z-10 hidden h-36 w-16 opacity-25 [background-image:radial-gradient(#EAB308_1.5px,transparent_1.5px)] [background-size:11px_11px] xl:block" />

            <div className="mx-auto w-full max-w-[1320px]">
                <div className="grid items-center gap-8 lg:grid-cols-[.88fr_1.12fr] lg:gap-12 xl:gap-16">
                    <MotionShell className="relative z-10 min-w-0">
                        <div className="inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-accent-200/80 bg-white/75 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.11em] text-gov-800 shadow-[0_8px_26px_rgba(8,47,73,.06)] backdrop-blur-xl sm:px-4 sm:py-2.5 sm:text-[11px]">
                            <Sparkles size={15} className="shrink-0 text-accent-600" />
                            <span className="truncate">{badges.map((badge, index) => <span key={badge}>{index > 0 && <span className="mx-1.5 text-accent-500">•</span>}{badge}</span>)}</span>
                        </div>

                        <h1 className="mt-5 max-w-[660px] font-black leading-[.96] tracking-[-0.05em] text-gov-900 [font-size:clamp(38px,12vw,74px)] sm:mt-7 sm:leading-[.98] lg:[font-size:clamp(56px,5.2vw,74px)]">
                            Portal<br />Pelayanan<br />Digital<br />
                            <span className="text-accent-600">Kelurahan<br />Tamansari</span>
                        </h1>

                        <p className="mt-4 max-w-[550px] text-[15px] font-medium leading-7 text-slate-650 sm:mt-6 sm:text-lg sm:leading-8">
                            Sederhanakan layanan, permudah akses informasi,<br className="hidden sm:block" /> untuk warga Tamansari yang lebih baik.
                        </p>

                        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                            <Button href="#layanan" className="group min-h-[52px] py-3 text-[15px] bg-gov-800 shadow-green hover:bg-gov-900 focus:ring-gov-100 sm:min-h-[44px]" aria-label="Lihat layanan">
                                Lihat Layanan <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                            </Button>
                            <Button href="/layanan" variant="glass" className="group min-h-[52px] py-3 text-[15px] border-border-soft bg-white/85 text-gov-900 hover:border-gov-100 sm:min-h-[44px]" aria-label="Ajukan layanan">
                                Ajukan Layanan <ArrowRight size={18} className="text-gov-700 transition group-hover:translate-x-1" />
                            </Button>
                        </div>
                    </MotionShell>

                    <MotionShell delay={0.12} className="relative z-10 min-w-0">
                        <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] border-[8px] border-accent-400/14 sm:-inset-7 sm:rounded-[3.5rem] sm:border-[15px]" />
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] border-[5px] border-white bg-white shadow-[0_20px_54px_rgba(8,47,73,.14)] sm:aspect-[16/11] sm:rounded-[32px] sm:border-[7px] lg:border-[9px]">
                            <Image src="/assets/kantor-tamansari.jpg" alt="Gedung Kantor Kelurahan Tamansari" fill priority sizes="(min-width:1024px) 55vw, 100vw" className="object-cover object-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-gov-950/12 via-transparent to-transparent" />
                        </div>
                    </MotionShell>
                </div>
            </div>
        </section>
    );
}
