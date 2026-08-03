"use client";
import Image from "next/image";
import { ArrowUp } from "lucide-react";
import { site } from "@/constants/site";

export function FloatingActions() {
    return (
        <div className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
            <a className="group grid size-14 place-items-center rounded-full bg-white p-2 shadow-[0_18px_55px_rgba(18,140,126,.32)] ring-1 ring-white/70 transition duration-300 ease-out hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-[#25d366]/30" href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`} aria-label="WhatsApp Kelurahan">
                <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-[#25d366]">
                    <Image src="/assets/icon-whatsapp.png" alt="" aria-hidden="true" fill sizes="56px" className="object-cover transition duration-300 group-hover:scale-[1.04]" />
                </span>
            </a>
            <a href="#top" className="grid size-11 place-items-center rounded-full border border-white/70 bg-white/84 text-gov-700 shadow-soft backdrop-blur-xl transition hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-gov-100" aria-label="Kembali ke atas">
                <ArrowUp size={18} />
            </a>
        </div>
    );
}