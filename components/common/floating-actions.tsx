"use client";
import { ArrowUp, MessageCircle } from "lucide-react";
import { site } from "@/constants/site";

export function FloatingActions() {
    return (
        <div className="fixed bottom-5 right-4 z-50 flex flex-col gap-3 sm:right-5">
            <a className="grid size-12 place-items-center rounded-full bg-gov-800 text-white shadow-glass transition hover:-translate-y-1" href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`} aria-label="WhatsApp Kelurahan">
                <MessageCircle size={20} />
            </a>
            <a href="#top" className="grid size-10 place-items-center rounded-full border border-white/70 bg-white/80 text-gov-700 shadow-soft backdrop-blur-xl transition hover:-translate-y-1" aria-label="Kembali ke atas">
                <ArrowUp size={18} />
            </a>
        </div>
    );
}