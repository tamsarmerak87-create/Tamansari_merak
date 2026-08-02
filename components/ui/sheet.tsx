"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

type SheetContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

const SheetContext = createContext<SheetContextValue | null>(null);

export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode; }) {
    const value = useMemo(() => ({ open, setOpen: onOpenChange }), [open, onOpenChange]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onOpenChange(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onOpenChange]);

    return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const context = useContext(SheetContext);
    if (!context) throw new Error("SheetTrigger must be used within Sheet");
    return <button type="button" className={className} onClick={() => context.setOpen(!context.open)} {...props}>{children}</button>;
}

export function SheetContent({ className, children, side = "right" }: { className?: string; children: React.ReactNode; side?: "right" | "left"; }) {
    const context = useContext(SheetContext);
    const portalTarget = typeof document === "undefined" ? null : document.body;

    if (!context || !portalTarget || !context.open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[120]">
            <button aria-label="Tutup menu" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => context.setOpen(false)} />
            <div role="dialog" aria-modal="true" className={cn("absolute top-0 h-full w-[min(88vw,22rem)] bg-white shadow-[0_25px_80px_rgba(15,39,72,.28)] transition-transform duration-[250ms] ease-out", side === "right" ? "right-0 translate-x-0" : "left-0 translate-x-0", className)}>
                <button type="button" aria-label="Tutup menu" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-slate-100 text-gov-900" onClick={() => context.setOpen(false)}><X size={18} /></button>
                {children}
            </div>
        </div>,
        portalTarget,
    );
}
