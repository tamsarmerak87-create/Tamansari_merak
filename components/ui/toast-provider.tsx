"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export type ToastKind = "success" | "error" | "warning" | "info" | "loading";

type ToastItem = {
    id: number;
    kind: ToastKind;
    title: string;
    description?: string;
    closing?: boolean;
};

type ToastOptions = {
    description?: string;
    duration?: number;
};

type ToastContextValue = {
    show: (kind: ToastKind, title: string, options?: ToastOptions) => number;
    success: (title: string, options?: ToastOptions) => number;
    error: (title: string, options?: ToastOptions) => number;
    warning: (title: string, options?: ToastOptions) => number;
    info: (title: string, options?: ToastOptions) => number;
    loading: (title: string, options?: ToastOptions) => number;
    update: (id: number, kind: ToastKind, title: string, options?: ToastOptions) => void;
    dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const defaultDuration: Record<ToastKind, number> = {
    success: 3000,
    error: 5000,
    warning: 3000,
    info: 3000,
    loading: 0,
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const timers = useRef(new Map<number, number>());

    const dismiss = useCallback((id: number) => {
        const timer = timers.current.get(id);
        if (timer) window.clearTimeout(timer);
        timers.current.delete(id);
        setItems((current) => current.map((item) => item.id === id ? { ...item, closing: true } : item));
        window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 180);
    }, []);

    const scheduleDismiss = useCallback((id: number, kind: ToastKind, duration?: number) => {
        const timer = timers.current.get(id);
        if (timer) window.clearTimeout(timer);
        timers.current.delete(id);
        const wait = duration ?? defaultDuration[kind];
        if (wait > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), wait));
    }, [dismiss]);

    const show = useCallback((kind: ToastKind, title: string, options?: ToastOptions) => {
        const id = Date.now() + Math.random();
        setItems((current) => [...current, { id, kind, title, description: options?.description }].slice(-5));
        scheduleDismiss(id, kind, options?.duration);
        return id;
    }, [scheduleDismiss]);

    const update = useCallback((id: number, kind: ToastKind, title: string, options?: ToastOptions) => {
        setItems((current) => current.map((item) => item.id === id ? { id, kind, title, description: options?.description } : item));
        scheduleDismiss(id, kind, options?.duration);
    }, [scheduleDismiss]);

    const value = useMemo<ToastContextValue>(() => ({
        show,
        success: (title, options) => show("success", title, options),
        error: (title, options) => show("error", title, options),
        warning: (title, options) => show("warning", title, options),
        info: (title, options) => show("info", title, options),
        loading: (title, options) => show("loading", title, options),
        update,
        dismiss,
    }), [dismiss, show, update]);

    return <ToastContext.Provider value={value}>{children}<ToastViewport items={items} onClose={dismiss} /></ToastContext.Provider>;
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast harus digunakan di dalam ToastProvider.");
    return context;
}

function ToastViewport({ items, onClose }: { items: ToastItem[]; onClose: (id: number) => void }) {
    return <div className="pointer-events-none fixed left-0 right-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col gap-2 px-3 sm:left-auto sm:right-5 sm:top-5 sm:w-[380px] sm:px-0">{items.map((item) => <ToastCard key={item.id} item={item} onClose={() => onClose(item.id)} />)}</div>;
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
    const tone = getTone(item.kind);
    return <div className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,.16)] backdrop-blur transition-all duration-200 ${tone.border} ${item.closing ? "translate-y-[-8px] opacity-0" : "translate-y-0 opacity-100 animate-[toast-in_.22s_ease-out]"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${tone.badge}`}>{tone.icon}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black leading-5 text-slate-900">{item.title}</p>{item.description ? <p className="mt-0.5 truncate text-sm font-bold text-slate-500">{item.description}</p> : null}</div><button type="button" onClick={onClose} aria-label="Tutup notifikasi" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button></div>;
}

function getTone(kind: ToastKind) {
    if (kind === "success") return { icon: "✓", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" };
    if (kind === "error") return { icon: "✕", border: "border-red-200", badge: "bg-red-100 text-red-700" };
    if (kind === "warning") return { icon: "⚠", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" };
    if (kind === "loading") return { icon: "⏳", border: "border-sky-200", badge: "bg-sky-100 text-sky-700" };
    return { icon: "ℹ", border: "border-sky-200", badge: "bg-sky-100 text-sky-700" };
}