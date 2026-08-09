import Image from "next/image";
import {
    ArrowRight,
    CheckCircle2,
    Eye,
    HeartHandshake,
    Leaf,
    Lightbulb,
    MonitorSmartphone,
    Send,
    ShieldCheck,
    Sparkles,
    TimerReset,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionShell } from "@/components/common/motion-shell";

const badges = ["Modern", "Cepat", "Transparan", "Terpercaya"];

const advantages = [
    { icon: TimerReset, title: "Layanan Cepat", description: "Proses layanan lebih cepat dengan sistem digital.", tone: "gold" },
    { icon: Eye, title: "Transparan", description: "Informasi jelas dan terbuka untuk semua warga.", tone: "green" },
    { icon: MonitorSmartphone, title: "Mudah Diakses", description: "Akses layanan kapan saja dan di mana saja.", tone: "gold" },
    { icon: Leaf, title: "Ramah Lingkungan", description: "Dukung lingkungan hijau dengan layanan digital.", tone: "green" },
];

const serviceValues = [
    { icon: HeartHandshake, top: "Melayani dengan", bottom: "Sepenuh Hati" },
    { icon: ShieldCheck, top: "Bekerja dengan", bottom: "Integritas" },
    { icon: Users, top: "Berkomitmen untuk", bottom: "Masyarakat" },
    { icon: Lightbulb, top: "Terdepan dalam", bottom: "Pelayanan" },
];

export function HomeHero() {
    return (
        <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-10 sm:pb-20 sm:pt-14 lg:px-20 lg:pt-16">
            <div className="pointer-events-none absolute -left-28 top-28 -z-10 size-80 rounded-full bg-[#f4c95d]/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 top-10 -z-10 size-96 rounded-full bg-[#8fbc8f]/10 blur-3xl" />
            <div className="pointer-events-none absolute right-[7%] top-[38%] -z-10 hidden text-[#71a675]/10 lg:block"><Leaf size={180} strokeWidth={0.7} /></div>

            <div className="mx-auto w-full max-w-[1440px]">
                <div className="grid items-center gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 xl:gap-24">
                    <MotionShell className="relative z-10 min-w-0">
                        <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-[#eadcae] bg-white/80 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-gov-800 shadow-[0_8px_24px_rgba(15,39,72,.06)] backdrop-blur-xl sm:text-xs">
                            <Sparkles size={15} className="mr-1 text-[#b88a20]" />
                            {badges.map((badge, index) => <span key={badge}>{index > 0 && <span className="mr-1.5 text-[#6fa273]">•</span>}{badge}</span>)}
                        </div>

                        <h1 className="mt-6 max-w-2xl text-balance font-black leading-[1.02] tracking-[-0.045em] text-gov-950 [font-size:clamp(42px,5.4vw,76px)]">
                            Portal<br />Pelayanan Digital<br />
                            <span className="text-[#c49325]">Kelurahan Tamansari</span>
                        </h1>

                        <p className="mt-6 max-w-xl text-base font-medium leading-8 text-slate-650 sm:text-lg">
                            Sederhanakan layanan, permudah akses informasi,<br className="hidden sm:block" /> untuk warga Tamansari yang lebih baik.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <Button href="#layanan" className="group bg-[#4f8b58] shadow-[0_14px_30px_rgba(79,139,88,.20)] hover:bg-[#41764a] focus:ring-[#d9eadb]" aria-label="Lihat layanan">
                                Lihat Layanan <ArrowRight size={17} className="transition group-hover:translate-x-1" />
                            </Button>
                            <Button href="/surat-online" variant="glass" className="border-[#d9c77f] bg-white/85 text-gov-950 hover:border-[#75a77a]" aria-label="Ajukan surat online">
                                <Send size={18} className="text-[#4f8b58]" /> Ajukan Surat Online
                            </Button>
                        </div>
                    </MotionShell>

                    <MotionShell delay={0.12} className="relative min-w-0">
                        <div className="pointer-events-none absolute -right-5 -top-5 hidden size-28 rounded-full border border-[#d8be69]/35 lg:block" />
                        <div className="pointer-events-none absolute -bottom-7 -left-7 hidden size-40 rounded-full bg-[#a9cba9]/20 blur-2xl lg:block" />
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border-[7px] border-white bg-white shadow-[0_28px_70px_rgba(15,39,72,.14)] sm:aspect-[16/11] sm:rounded-[2.5rem]">
                            <Image src="/assets/kantor-tamansari.jpg" alt="Gedung Kantor Kelurahan Tamansari" fill priority sizes="(min-width: 1024px) 52vw, 100vw" className="object-cover object-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-gov-950/10 to-transparent" />
                        </div>
                        <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(15,39,72,.14)] backdrop-blur-xl sm:bottom-5 sm:left-5 sm:px-5">
                            <span className="relative flex size-10 items-center justify-center rounded-xl bg-[#e7f2e8] text-[#4f8b58]">
                                <CheckCircle2 size={21} />
                                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-[#4f9d5d]" />
                            </span>
                            <span><b className="block text-sm text-gov-950">Layanan Online</b><small className="text-xs font-medium text-slate-650">Kami siap melayani Anda</small></span>
                        </div>
                    </MotionShell>
                </div>

                <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
                    {advantages.map((item, index) => {
                        const Icon = item.icon;
                        const green = item.tone === "green";
                        return <MotionShell key={item.title} delay={index * 0.06}>
                            <article className="group h-full rounded-[1.6rem] border border-[#ece8dc] bg-white/90 p-6 shadow-[0_14px_40px_rgba(15,39,72,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,39,72,.10)]">
                                <div className={`grid size-12 place-items-center rounded-2xl ${green ? "bg-[#e8f2e8] text-[#4f8b58]" : "bg-[#fff5d8] text-[#b4851e]"}`}><Icon size={23} /></div>
                                <h2 className="mt-5 text-lg font-extrabold text-gov-950">{item.title}</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-650">{item.description}</p>
                            </article>
                        </MotionShell>;
                    })}
                </div>

                <MotionShell delay={0.1} className="mt-7">
                    <div className="grid overflow-hidden rounded-[1.6rem] border border-[#e8e4d8] bg-white/70 shadow-[0_12px_35px_rgba(15,39,72,.05)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
                        {serviceValues.map((item, index) => {
                            const Icon = item.icon;
                            return <div key={item.bottom} className={`flex items-center gap-4 px-6 py-5 ${index > 0 ? "border-t border-[#e8e4d8] sm:border-t-0 sm:[&:nth-child(odd)]:border-l lg:border-l" : ""} ${index === 2 ? "sm:border-t lg:border-t-0" : ""}`}>
                                <Icon size={24} className={index % 2 ? "text-[#b4851e]" : "text-[#4f8b58]"} />
                                <p className="text-sm leading-5 text-slate-650">{item.top}<strong className="block font-extrabold text-gov-950">{item.bottom}</strong></p>
                            </div>;
                        })}
                    </div>
                </MotionShell>
            </div>
        </section>
    );
}
