"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
    className?: string;
    label?: string;
    onClick?: () => void;
};

export function BackButton({ className = "", label = "← Kembali ke Dashboard", onClick }: BackButtonProps) {
    const router = useRouter();

    return <button type="button" onClick={onClick ?? (() => router.push("/dashboard"))} className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-200 sm:w-auto ${className}`}>{label}</button>;
}