"use client";
import Image from "next/image";
import { Bot } from "lucide-react";
import { site } from "@/constants/site";

export function FloatingActions() {
    const openChat = () => window.dispatchEvent(new CustomEvent("tamsar-chat:open"));

    return (
        <div className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-3 sm:right-5">
            <a
                className="group flex size-[52px] items-center justify-center rounded-full bg-[#25d366] shadow-[0_12px_30px_rgba(37,211,102,.28)] ring-2 ring-white transition duration-300 ease-out hover:scale-[1.1] hover:bg-[#20b85a] focus:outline-none focus:ring-4 focus:ring-[#25d366]/30"
                href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`}
                aria-label="WhatsApp Kelurahan"
            >
                <span className="relative grid size-8 place-items-center overflow-hidden rounded-full">
                    <Image src="/assets/icon-whatsapp.png" alt="" aria-hidden="true" fill sizes="32px" className="object-cover transition duration-300 group-hover:scale-[1.06]" />
                </span>
            </a>
            <button
                type="button"
                onClick={openChat}
                className="grid size-[52px] place-items-center rounded-full bg-[#1a3a5c] text-white shadow-[0_12px_30px_rgba(26,58,92,.24)] ring-2 ring-white transition duration-300 ease-out hover:scale-[1.1] hover:bg-gov-900 focus:outline-none focus:ring-4 focus:ring-gov-100"
                aria-label="Buka Chat TAMSAR AI"
            >
                <Bot size={24} aria-hidden="true" />
            </button>
        </div>
    );
}