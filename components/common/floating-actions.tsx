"use client";
import { ArrowUp, MessageCircle } from "lucide-react";
import { site } from "@/constants/site";

export function FloatingActions() {
    return (
        <div className="fixed bottom-[calc(100px+env(safe-area-inset-bottom))] right-3 z-50 flex flex-col gap-3 sm:bottom-5 sm:right-5">
            <a className="grid size-11 place-items-center rounded-full bg-gov-800 text-white shadow-glass transition hover:-translate-y-1 sm:size-12" href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`} aria-label="WhatsApp Kelurahan">
                <MessageCircle size={20} />
            </a>
            <a href="#top" className="grid size-9 place-items-center rounded-full border border-white/70 bg-white/80 text-gov-700 shadow-soft backdrop-blur-xl transition hover:-translate-y-1 sm:size-10" aria-label="Kembali ke atas">
                <ArrowUp size={18} />
            </a>
        </div>
    );
}