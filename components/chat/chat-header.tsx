"use client";

import { Bot, ChevronDown, X } from "lucide-react";

type ChatHeaderProps = {
    onMinimize: () => void;
    onClose: () => void;
};

export function ChatHeader({ onMinimize, onClose }: ChatHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4 bg-gov-800 p-4 text-white sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-400 text-gov-950"><Bot size={20} /></div>
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-200">TAMSAR CS</p>
                    <h3 className="truncate text-lg font-black">Layanan cepat Kelurahan Tamansari</h3>
                </div>
            </div>
            <div className="flex gap-1">
                <button type="button" onClick={onMinimize} className="rounded-full p-2 hover:bg-white/10" aria-label="Minimize Chat"><ChevronDown size={16} /></button>
                <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Tutup Chat"><X size={16} /></button>
            </div>
        </div>
    );
}