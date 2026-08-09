import Image from "next/image";
import {
    ArrowRight,
    Award,
    CheckCircle2,
    Clock3,
    Handshake,
    Leaf,
    ShieldCheck,
    Sparkles,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionShell } from "@/components/common/motion-shell";

const badges = ["Modern", "Cepat", "Transparan", "Terpercaya"];

const advantages = [
    { icon: Clock3, title: "Layanan Cepat", description: "Proses layanan lebih cepat dengan sistem digital.", green: false },
    { icon: ShieldCheck, title: "Transparan", description: "Informasi jelas dan terbuka untuk semua warga.", green: true },
    { icon: Users, title: "Mudah Diakses", description: "Akses layanan kapan saja dan di mana saja.", green: false },
    { icon: Leaf, title: "Ramah Lingkungan", description: "Dukung lingkungan hijau dengan layanan digital.", green: true },
];

const serviceValues = [
    { icon: Users, top: "Melayani dengan", bottom: "Sepenuh Hati", green: true },
    { icon: ShieldCheck, top: "Bekerja dengan", bottom: "Integritas", green: false },
    { icon: Handshake, top: "Berkomitmen untuk", bottom: "Masyarakat", green: true },
    { icon: Award, top: "Terdepan dalam", bottom: "Pelayanan", green: false },
];

export function HomeHero() {
    return (
        <section className="relative overflow-hidden px-4 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:px-12 xl:px-16">
            {/* Decorative shapes — deliberately subtle and behind content */}
            <div className="pointer-events-none absolute -left-40 top-48 -z-10 size-[30rem] rounded-full border-[48px] border-accent-400/8" />
            <div className="pointer-events-none absolute left-[39%] top-32 -z-10 hidden size-[27rem] rounded-full border-[34px] border-accent-400/18 lg:block" />
            <div className="pointer-events-none absolute right-[-8rem] top-16 -z-10 size-[30rem] rounded-full bg-green-100/35 blur-3xl" />
            <div className="pointer-events-none absolute bottom-36 left-[-2rem] -z-10 hidden rotate-[-28deg] text-green-600/10 md:block"><Leaf size={180} strokeWidth={1} /></div>
            <div className="pointer-events-none absolute right-0 top-8 -z-10 hidden rotate-[-18deg] text-green-600/12 lg:block"><Leaf size={170} strokeWidth={1} /></div>
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
                        <div className="absolute bottom-4 right-4 flex max-w-[250px] items-center gap-3 rounded-2xl border border-white/60 bg-green-700/90 px-4 py-3 text-white shadow-[0_14px_34px_rgba(21,128,61,.25)] backdrop-blur-xl sm:bottom-6 sm:right-6">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/18"><CheckCircle2 size={18} /></span>
                            <span><b className="block text-sm">Layanan Online</b><small className="block text-[11px] font-medium text-white/85 sm:text-xs">Kami siap melayani Anda</small></span>
                        </div>
                    </MotionShell>
                </div>

                <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
                    {advantages.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <MotionShell key={item.title} delay={index * 0.05}>
                                <article className="group flex h-full min-h-[164px] items-start gap-4 rounded-3xl border border-white bg-white/90 p-5 shadow-soft backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:shadow-glass sm:p-6">
                                    <div className={`grid size-14 shrink-0 place-items-center rounded-full ${item.green ? "bg-green-100 text-green-600" : "bg-accent-100 text-accent-600"}`}><Icon size={26} /></div>
                                    <div className="min-w-0 pt-1">
                                        <h2 className="text-base font-extrabold text-gov-900 sm:text-lg">{item.title}</h2>
                                        <p className="mt-2 text-sm leading-6 text-slate-650">{item.description}</p>
                                    </div>
                                </article>
                            </MotionShell>
                        );
                    })}
                </div>

                <MotionShell delay={0.08} className="mt-8">
                    <div className="grid overflow-hidden rounded-[28px] border border-accent-200/55 bg-white/68 px-3 shadow-soft backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
                        {serviceValues.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.bottom} className={`flex min-h-[118px] items-center gap-4 px-5 py-5 ${index > 0 ? "border-t border-accent-200/45 sm:[&:nth-child(even)]:border-l lg:border-l lg:border-t-0" : ""} ${index === 2 ? "sm:border-t lg:border-t-0" : ""}`}>
                                    <div className={`grid size-12 shrink-0 place-items-center rounded-full ${item.green ? "bg-green-100 text-green-600" : "bg-accent-100 text-accent-600"}`}><Icon size={23} /></div>
                                    <p className="text-sm leading-5 text-slate-650">{item.top}<strong className="block text-base font-extrabold uppercase text-gov-900">{item.bottom}</strong></p>
                                </div>
                            );
                        })}
                    </div>
                </MotionShell>
            </div>
        </section>
    );
}
