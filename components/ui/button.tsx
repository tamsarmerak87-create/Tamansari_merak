import React from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: "primary" | "gold" | "glass";
    href?: string;
};

const variants = {
    primary: "bg-gov-800 text-white hover:bg-gov-900 focus:ring-gov-100",
    gold: "bg-accent-400 text-gov-950 hover:bg-accent-200 focus:ring-accent-200",
    glass: "border border-border-soft bg-white/82 text-gov-900 backdrop-blur-xl hover:bg-white focus:ring-gov-100",
};

export function Button({ className, variant = "primary", href, children, ...props }: ButtonProps) {
    const classes = cn("inline-flex min-h-[44px] w-full items-center justify-center gap-3 rounded-2xl px-5 py-3 text-sm font-black shadow-soft transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.02] focus:outline-none focus:ring-4 sm:w-auto sm:px-6 sm:py-3.5", variants[variant], className);

    if (href) {
        return <Link className={classes} href={href as never}>{children}</Link>;
    }

    return <button className={classes} {...props}>{children}</button>;
}