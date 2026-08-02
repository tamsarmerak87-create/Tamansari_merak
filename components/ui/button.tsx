import { cn } from "@/utils/cn";

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button className={cn("rounded-full bg-gov-700 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-gov-500 focus:outline-none focus:ring-4 focus:ring-gov-100", className)} {...props} />;
}