import { cn } from "@/utils/cn";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-gov-800 shadow-soft backdrop-blur-2xl",
                className,
            )}
            {...props}
        />
    );
}
