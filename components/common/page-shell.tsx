import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type PageHeroProps = {
    eyebrow: string;
    title: string;
    description: string;
    actions?: { label: string; href: string; icon?: LucideIcon; external?: boolean }[];
    image?: { src: string; alt: string };
};

export function PageHero({ eyebrow, title, description, actions = [], image }: PageHeroProps) {
    return (
        <section className="relative mx-auto w-full max-w-7xl overflow-hidden px-4 pb-8 pt-10 sm:px-6 sm:pt-16 lg:px-8 lg:pt-24">
            <div className="absolute left-2 top-10 h-36 w-36 rounded-full bg-accent-400/20 blur-3xl sm:left-10 sm:top-16 sm:h-56 sm:w-56" />
            <GlassCard className={cn("relative overflow-hidden rounded-[1.8rem] p-5 sm:rounded-[2.75rem] sm:p-10 lg:p-14", image ? "lg:grid lg:grid-cols-[1.1fr_.9fr] lg:gap-10" : "")}>
                <div className="absolute right-0 top-0 h-40 w-40 translate-x-1/3 -translate-y-1/3 rounded-full bg-gov-500/20 blur-3xl sm:h-72 sm:w-72" />
                <div className="relative max-w-4xl">
                    <Badge>{eyebrow}</Badge>
                    <h1 className="mt-5 font-display text-[clamp(2.15rem,10vw,4.5rem)] font-black leading-[.98] tracking-[-0.055em] text-gov-950 text-balance sm:text-6xl lg:text-7xl">{title}</h1>
                    <p className="mt-4 max-w-3xl text-base leading-7 text-slate-650 sm:mt-5 sm:text-lg sm:leading-8">{description}</p>
                    {actions.length > 0 && <div className="mt-7 flex flex-col gap-3 sm:flex-row">{actions.map((action, index) => <HeroAction key={action.href} action={action} primary={index === 0} />)}</div>}
                </div>
                {image ? (
                    <div className="relative mt-6 aspect-[4/3] min-h-0 overflow-hidden rounded-[1.5rem] border border-white/75 shadow-xl sm:mt-8 sm:min-h-72 sm:rounded-[2rem] lg:mt-0">
                        <Image src={image.src} alt={image.alt} fill className="object-cover" sizes="(min-width: 1024px) 38vw, 100vw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-gov-950/28 via-transparent to-white/10" />
                    </div>
                ) : null}
            </GlassCard>
        </section>
    );
}

function HeroAction({ action, primary }: { action: NonNullable<PageHeroProps["actions"]>[number]; primary: boolean }) {
    const Icon = action.icon ?? ArrowRight;
    const className = cn("inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-black shadow-soft transition hover:-translate-y-1 sm:w-auto", primary ? "bg-gov-950 text-white" : "border border-white/80 bg-white/70 text-gov-900 backdrop-blur-xl");
    if (action.external) return <a className={className} href={action.href} target="_blank" rel="noreferrer"><Icon size={17} /> {action.label}</a>;
    return <a className={className} href={action.href}><Icon size={17} /> {action.label}</a>;
}

export function InfoCard({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
    return <GlassCard className={cn("h-full min-w-0 rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-6", className)}><div className="grid size-12 place-items-center rounded-2xl bg-gov-950 text-white shadow-soft"><Icon size={22} /></div><h2 className="mt-5 font-display text-xl font-black text-gov-950 sm:text-2xl">{title}</h2><div className="mt-3 leading-7 text-slate-650">{children}</div></GlassCard>;
}