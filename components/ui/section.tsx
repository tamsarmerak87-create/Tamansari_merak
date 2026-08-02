import { cn } from "@/utils/cn";

type SectionProps = React.HTMLAttributes<HTMLElement> & {
    eyebrow?: string;
    title?: string;
    description?: string;
};

export function Section({ eyebrow, title, description, className, children, ...props }: SectionProps) {
    return (
        <section className={cn("mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24", className)} {...props}>
            {(eyebrow || title || description) && (
                <div className="mx-auto mb-10 max-w-3xl text-center">
                    {eyebrow && <p className="text-xs font-black uppercase tracking-[0.32em] text-accent-700">{eyebrow}</p>}
                    {title && <h2 className="mt-3 text-3xl font-black tracking-tight text-gov-950 sm:text-5xl">{title}</h2>}
                    {description && <p className="mt-4 text-base leading-8 text-slate-650 sm:text-lg">{description}</p>}
                </div>
            )}
            {children}
        </section>
    );
}
