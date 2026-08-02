import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/card";
import { cn } from "@/utils/cn";

type PageHeroProps = {
    eyebrow: string;
    title: string;
    description: string;
    actions?: { label: string; href: string; icon?: LucideIcon; external?: boolean }[];
};

export function PageHero({ eyebrow, title, description, actions = [] }: PageHeroProps) {
    return (
        <section className="relative mx-auto w-full max-w-7xl px-4 pb-8 pt-16 sm:px-6 lg:px-8 lg:pt-24">
            <div className="absolute left-10 top-16 h-56 w-56 rounded-full bg-accent-400/20 blur-3xl" />
            <GlassCard className="relative overflow-hidden rounded-[2.75rem] p-8 sm:p-10 lg:p-14">
                <div className="absolute right-0 top-0 h-72 w-72 translate-x-1/3 -translate-y-1/3 rounded-full bg-gov-500/20 blur-3xl" />
                <div className="relative max-w-4xl">
                    <Badge>{eyebrow}</Badge>
                    <h1 className="mt-5 font-display text-4xl font-black leading-none tracking-[-0.055em] text-gov-950 text-balance sm:text-6xl lg:text-7xl">{title}</h1>
                    <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-650">{description}</p>
                    {actions.length > 0 && <div className="mt-7 flex flex-col gap-3 sm:flex-row">{actions.map((action, index) => <HeroAction key={action.href} action={action} primary={index === 0} />)}</div>}
                </div>
            </GlassCard>
        </section>
    );
}

function HeroAction({ action, primary }: { action: NonNullable<PageHeroProps["actions"]>[number]; primary: boolean }) {
    const Icon = action.icon ?? ArrowRight;
    const className = cn("inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-black shadow-soft transition hover:-translate-y-1", primary ? "bg-gov-950 text-white" : "border border-white/80 bg-white/70 text-gov-900 backdrop-blur-xl");
    if (action.external) return <a className={className} href={action.href} target="_blank" rel="noreferrer"><Icon size={17} /> {action.label}</a>;
    return <a className={className} href={action.href}><Icon size={17} /> {action.label}</a>;
}

export function InfoCard({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
    return <GlassCard className={cn("h-full rounded-[2rem] p-6", className)}><div className="grid size-12 place-items-center rounded-2xl bg-gov-950 text-white shadow-soft"><Icon size={22} /></div><h2 className="mt-5 font-display text-2xl font-black text-gov-950">{title}</h2><div className="mt-3 leading-7 text-slate-650">{children}</div></GlassCard>;
}