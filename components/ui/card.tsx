import { cn } from "@/utils/cn";

export function GlassCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("glass rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-6 lg:p-8", className)} {...props} />;
}
