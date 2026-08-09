import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionShell } from "@/components/common/motion-shell";

const badges = ["Modern", "Cepat", "Transparan", "Terpercaya"];

export function HomeHero() {
    return (
        <section className="relative overflow-hidden px-4 pb-10 pt-10 sm:px-8 sm:pb-14 sm:pt-14 lg:px-12 lg:pb-16 xl:px-16">
            {/* Decorative shapes — deliberately subtle and behind content */}
            <div className="pointer-events-none absolute -left-40 top-48 -z-10 size-[30rem] rounded-full border-[48px] border-accent-400/8" />
            <div className="pointer-events-none absolute left-[39%] top-32 -z-10 hidden size-[27rem] rounded-full border-[34px] border-accent-400/18 lg:block" />
            <div className="pointer-events-none absolute right-[-8rem] top-16 -z-10 size-[30rem] rounded-full bg-green-100/35 blur-3xl" />
            <div className="pointer-events-none absolute left-2 top-44 -z-10 hidden h-36 w-16 opacity-25 [background-image:radial-gradient(#EAB308_1.5px,transparent_1.5px)] [background-size:11px_11px] xl:block" />

            <div className="mx-auto w-full max-w-[1320px]">
                <div className="grid items-center gap-12 lg:grid-cols-[.88fr_1.12fr] lg:gap-12 xl:gap-16">
                    <MotionShell className="relative z-10 min-w-0">
                        <div className="inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-accent-200/80 bg-white/75 px-4 py-2.5 text-[9px] font-extrabold uppercase tracking-[0.13em] text-green-700 shadow-[0_8px_26px_rgba(8,47,73,.06)] backdrop-blur-xl sm:text-[11px]">
                            <Sparkles size={15} className="shrink-0 text-accent-600" />
                            <span className="truncate">{badges.map((badge, index) => <span key={badge}>{index > 0 && <span className="mx-1.5 text-accent-500">•</span>}{badge}</span>)}</span>
                        </div>

                        <h1 className="mt-7 max-w-[660px] font-black leading-[.98] tracking-[-0.05em] text-gov-900 [font-size:clamp(42px,5.2vw,74px)]">
                            Portal<br />Pelayanan<br />Digital<br />
                            <span className="text-accent-600">Kelurahan<br />Tamansari</span>
                        </h1>

                        <p className="mt-6 max-w-[550px] text-base font-medium leading-7 text-slate-650 sm:text-lg sm:leading-8">
                            Sederhanakan layanan, permudah akses informasi,<br className="hidden sm:block" /> untuk warga Tamansari yang lebih baik.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button href="#layanan" className="group bg-green-600 shadow-green hover:bg-green-700 focus:ring-green-100" aria-label="Lihat layanan">
                                Lihat Layanan <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                            </Button>
                            <Button href="/surat-online" variant="glass" className="group border-border-soft bg-white/85 text-gov-900 hover:border-green-200" aria-label="Ajukan surat online">
                                Ajukan Surat Online <ArrowRight size={18} className="text-green-600 transition group-hover:translate-x-1" />
                            </Button>
                        </div>
                    </MotionShell>

                    <MotionShell delay={0.12} className="relative z-10 min-w-0">
                        <div className="pointer-events-none absolute -inset-5 -z-10 rounded-[3.5rem] border-[15px] border-accent-400/14 sm:-inset-7" />
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] border-[7px] border-white bg-white shadow-[0_26px_70px_rgba(8,47,73,.16)] sm:aspect-[16/11] sm:rounded-[32px] lg:border-[9px]">
                            <Image src="/assets/kantor-tamansari.jpg" alt="Gedung Kantor Kelurahan Tamansari" fill priority sizes="(min-width:1024px) 55vw, 100vw" className="object-cover object-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-gov-950/12 via-transparent to-transparent" />
                        </div>
                    </MotionShell>
                </div>
            </div>
        </section>
    );
}
