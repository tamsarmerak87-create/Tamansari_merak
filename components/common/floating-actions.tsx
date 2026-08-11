"use client";
import Image from "next/image";
import { site } from "@/constants/site";

export function FloatingActions() {
    const openChat = () => window.dispatchEvent(new CustomEvent("tamsar-chat:open"));

    return (
        <div className="fixed bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(14px,env(safe-area-inset-right))] z-[80] flex flex-col items-end gap-3 sm:bottom-[calc(24px+env(safe-area-inset-bottom))] sm:right-6 sm:gap-4">
            <a
                className="group relative grid size-12 place-items-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#54f28b_0%,#22c55e_42%,#0f8f43_100%)] shadow-[0_16px_28px_rgba(10,111,54,.34),inset_0_-8px_14px_rgba(4,77,36,.28),inset_0_7px_12px_rgba(255,255,255,.42)] ring-[3px] ring-white/95 transition duration-300 ease-out hover:scale-[1.05] focus:outline-none focus:ring-4 focus:ring-[#25d366]/30 sm:size-14"
                href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`}
                aria-label="WhatsApp Kelurahan"
            >
                <span className="pointer-events-none absolute left-2 top-1.5 h-4 w-7 rounded-full bg-white/55 blur-[1px] sm:left-2.5 sm:top-2 sm:h-4 sm:w-8" />
                <span className="pointer-events-none absolute inset-[4px] rounded-full border border-white/30" />
                <span className="relative grid size-7 place-items-center overflow-hidden rounded-full drop-shadow-[0_2px_3px_rgba(0,0,0,.18)] sm:size-8">
                    <Image src="/assets/icon-whatsapp.png" alt="" aria-hidden="true" fill sizes="32px" className="object-cover brightness-0 invert transition duration-300 group-hover:scale-[1.04]" />
                </span>
            </a>
            <button
                type="button"
                onClick={openChat}
                className="group relative grid size-12 place-items-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#dff7ff_0%,#46a8e8_45%,#124878_100%)] shadow-[0_16px_28px_rgba(18,72,120,.32),inset_0_-8px_14px_rgba(10,54,96,.32),inset_0_7px_12px_rgba(255,255,255,.48)] ring-[3px] ring-white/95 transition duration-300 ease-out hover:scale-[1.05] focus:outline-none focus:ring-4 focus:ring-sky-100 sm:size-14"
                aria-label="Buka Chat TAMSAR AI"
            >
                <span className="pointer-events-none absolute left-2 top-1.5 h-4 w-7 rounded-full bg-white/60 blur-[1px] sm:left-2.5 sm:top-2 sm:h-4 sm:w-8" />
                <span className="pointer-events-none absolute inset-[4px] rounded-full border border-white/35" />
                <span className="relative grid size-9 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_30%,#ffe6c7_0_38%,#f5b876_39%_54%,transparent_55%),linear-gradient(180deg,#0f766e_0_43%,#0b4f57_44%_100%)] shadow-[inset_0_2px_5px_rgba(255,255,255,.55),0_3px_6px_rgba(0,0,0,.18)] transition duration-300 group-hover:scale-[1.03] sm:size-10" aria-hidden="true">
                    <span className="absolute top-[8px] h-[7px] w-[20px] rounded-t-full bg-[#17324d] sm:top-[9px] sm:w-[22px]" />
                    <span className="absolute top-[15px] h-[9px] w-[20px] rounded-b-full rounded-t-[6px] bg-[#ffd6a3] sm:top-[16px] sm:w-[22px]" />
                    <span className="absolute top-[18px] h-[2px] w-[11px] rounded-full bg-[#8d5b32] opacity-70 sm:top-[20px]" />
                    <span className="absolute left-[7px] top-[13px] h-[13px] w-[3px] rounded-full bg-white shadow-[20px_0_0_#fff] sm:left-[8px] sm:top-[14px] sm:shadow-[21px_0_0_#fff]" />
                    <span className="absolute left-[6px] top-[12px] h-[14px] w-[4px] rounded-full bg-[#12395f] shadow-[23px_0_0_#12395f] sm:left-[7px] sm:top-[13px] sm:shadow-[24px_0_0_#12395f]" />
                    <span className="absolute right-[8px] top-[23px] h-[2px] w-[11px] origin-left rotate-[18deg] rounded-full bg-[#12395f] sm:right-[9px] sm:top-[25px]" />
                    <span className="absolute right-[7px] top-[25px] size-[4px] rounded-full bg-white sm:right-[8px] sm:top-[27px]" />
                </span>
            </button>
        </div>
    );
}