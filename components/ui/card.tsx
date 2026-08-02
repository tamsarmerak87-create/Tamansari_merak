import { cn } from "@/utils/cn";

export function GlassCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("glass rounded-[2rem] p-6", className)} {...props} />;
}
