"use client";
import Image from "next/image";
import { Bot } from "lucide-react";
import { site } from "@/constants/site";

export function FloatingActions() {
    const openChat = () => window.dispatchEvent(new CustomEvent("tamsar-chat:open"));

    return (
        <div className="fixed bottom-[calc(24px+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-[18px] sm:right-6">
            <a className="group grid size-[60px] place-items-center rounded-full bg-white p-2 shadow-[0_18px_45px_rgba(18,140,126,.24)] ring-1 ring-white/80 transition duration-300 ease-out hover:scale-[1.08] focus:outline-none focus:ring-4 focus:ring-[#25d366]/30" href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`} aria-label="WhatsApp Kelurahan">
                <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-[#25d366]">
                    <Image src="/assets/icon-whatsapp.png" alt="" aria-hidden="true" fill sizes="60px" className="object-cover transition duration-300 group-hover:scale-[1.06]" />
                </span>
            </a>
            <button type="button" onClick={openChat} className="grid size-[60px] place-items-center rounded-full bg-gov-900 text-white shadow-[0_18px_45px_rgba(13,43,92,.24)] ring-1 ring-white/60 transition duration-300 ease-out hover:scale-[1.08] focus:outline-none focus:ring-4 focus:ring-gov-100" aria-label="Buka Chat TAMSAR AI">
                <Bot size={28} aria-hidden="true" />
            </button>
        </div>
    );
}