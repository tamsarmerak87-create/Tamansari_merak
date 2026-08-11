"use client";
import Image from "next/image";
import { site } from "@/constants/site";

export function FloatingActions() {
    const openChat = () => window.dispatchEvent(new CustomEvent("tamsar-chat:open"));

    return (
        <div className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-[max(14px,env(safe-area-inset-right))] z-[9999] flex flex-col items-end gap-3 md:bottom-[calc(18px+env(safe-area-inset-bottom))] md:right-[18px] lg:bottom-[calc(24px+env(safe-area-inset-bottom))] lg:right-6 lg:gap-4">
            <a
                className="group relative grid size-[46px] place-items-center rounded-full border-[5px] border-white bg-[radial-gradient(circle_at_31%_20%,#78f6a4_0_18%,transparent_36%),linear-gradient(145deg,#25D366_0%,#16b958_46%,#128C7E_100%)] shadow-[8px_12px_18px_rgba(2,44,24,.28),0_4px_0_rgba(255,255,255,.95),inset_5px_6px_10px_rgba(255,255,255,.32),inset_-7px_-10px_13px_rgba(0,74,36,.34)] transition-[transform,box-shadow] duration-200 ease-out before:absolute before:inset-[3px] before:rounded-full before:border before:border-white/30 before:shadow-[inset_2px_3px_5px_rgba(255,255,255,.28),inset_-5px_-7px_10px_rgba(0,0,0,.22)] after:absolute after:left-[8px] after:top-[5px] after:h-[13px] after:w-[24px] after:rotate-[-22deg] after:rounded-full after:bg-white/48 after:blur-[1px] hover:scale-[1.05] hover:shadow-[10px_14px_22px_rgba(2,44,24,.34),0_4px_0_rgba(255,255,255,.95),inset_5px_6px_10px_rgba(255,255,255,.34),inset_-7px_-10px_13px_rgba(0,74,36,.36)] focus:outline-none focus:ring-4 focus:ring-[#25d366]/25 md:size-[50px] lg:size-14"
                href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`}
                aria-label="WhatsApp Kelurahan"
            >
                <span className="absolute -bottom-[6px] right-[-5px] h-4 w-9 rounded-full bg-black/20 blur-md" aria-hidden="true" />
                <Image src="/assets/icon-whatsapp-v3.svg" alt="" width={40} height={40} className="relative z-10 size-[34px] drop-shadow-[0_4px_5px_rgba(0,0,0,.26)] transition duration-200 group-hover:scale-[1.04] md:size-[37px] lg:size-[42px]" aria-hidden="true" />
            </a>
            <button
                type="button"
                onClick={openChat}
                className="group relative grid size-[46px] place-items-center overflow-hidden rounded-full border-[5px] border-white bg-[radial-gradient(circle_at_31%_20%,#83c7ff_0_17%,transparent_34%),linear-gradient(145deg,#2D8CFF_0%,#1d73ee_48%,#1556D6_100%)] shadow-[8px_12px_18px_rgba(15,50,120,.3),0_4px_0_rgba(255,255,255,.95),inset_5px_6px_10px_rgba(255,255,255,.34),inset_-7px_-10px_13px_rgba(7,38,117,.36)] transition-[transform,box-shadow] duration-200 ease-out before:absolute before:inset-[3px] before:rounded-full before:border before:border-white/30 before:shadow-[inset_2px_3px_5px_rgba(255,255,255,.28),inset_-5px_-7px_10px_rgba(0,0,0,.22)] after:absolute after:left-[8px] after:top-[5px] after:h-[13px] after:w-[24px] after:rotate-[-22deg] after:rounded-full after:bg-white/48 after:blur-[1px] hover:scale-[1.05] hover:shadow-[10px_14px_22px_rgba(15,50,120,.36),0_4px_0_rgba(255,255,255,.95),inset_5px_6px_10px_rgba(255,255,255,.36),inset_-7px_-10px_13px_rgba(7,38,117,.38)] focus:outline-none focus:ring-4 focus:ring-sky-100 md:size-[50px] lg:size-14"
                aria-label="Buka Chat TAMSAR AI"
            >
                <span className="absolute -bottom-[6px] right-[-5px] h-4 w-9 rounded-full bg-black/20 blur-md" aria-hidden="true" />
                <span className="relative z-10 grid size-[35px] place-items-center rounded-full transition duration-200 group-hover:scale-[1.03] md:size-[38px] lg:size-[42px]" aria-hidden="true">
                    <span className="absolute bottom-[2px] h-[13px] w-[29px] rounded-t-[14px] bg-[linear-gradient(145deg,#1f7ced,#0f4db7)] shadow-[inset_2px_2px_4px_rgba(255,255,255,.24),inset_-3px_-4px_6px_rgba(0,32,91,.35),0_3px_4px_rgba(0,0,0,.18)] md:w-[31px] lg:h-[15px] lg:w-[34px]" />
                    <span className="absolute top-[5px] h-[21px] w-[23px] rounded-[48%_48%_44%_44%] bg-[radial-gradient(circle_at_34%_28%,#ffe8c6_0_12%,transparent_24%),linear-gradient(145deg,#ffd9a8_0%,#f0ad72_100%)] shadow-[inset_2px_2px_4px_rgba(255,255,255,.5),inset_-3px_-4px_5px_rgba(155,75,22,.22),0_3px_4px_rgba(0,0,0,.22)] md:h-[22px] md:w-[24px] lg:top-[6px] lg:h-[24px] lg:w-[26px]" />
                    <span className="absolute top-[3px] h-[12px] w-[25px] rounded-t-[16px] rounded-bl-[10px] bg-[radial-gradient(circle_at_32%_20%,#4b4b4b_0_8%,transparent_20%),linear-gradient(145deg,#222_0%,#111827_56%,#05070a_100%)] shadow-[inset_2px_2px_3px_rgba(255,255,255,.18),0_2px_4px_rgba(0,0,0,.25)] md:w-[26px] lg:top-[4px] lg:h-[13px] lg:w-[28px]" />
                    <span className="absolute left-[6px] top-[14px] size-[3px] rounded-full bg-[#1f2937] shadow-[13px_0_0_#1f2937] md:left-[7px] md:top-[15px] md:shadow-[14px_0_0_#1f2937] lg:left-[8px] lg:top-[17px] lg:shadow-[15px_0_0_#1f2937]" />
                    <span className="absolute top-[20px] h-[2px] w-[10px] rounded-b-full border-b-2 border-[#7c3f20] md:top-[21px] lg:top-[23px]" />
                    <span className="absolute left-[2px] top-[10px] h-[15px] w-[5px] rounded-full bg-[linear-gradient(145deg,#2b3646,#0c1320)] shadow-[26px_0_0_#0c1320] md:top-[11px] md:shadow-[28px_0_0_#0c1320] lg:left-[3px] lg:top-[12px] lg:h-[17px] lg:shadow-[31px_0_0_#0c1320]" />
                    <span className="absolute left-[1px] top-[8px] h-[17px] w-[3px] rounded-full bg-[#2563eb] shadow-[31px_0_0_#2563eb] md:shadow-[33px_0_0_#2563eb] lg:left-[2px] lg:top-[9px] lg:h-[19px] lg:shadow-[35px_0_0_#2563eb]" />
                    <span className="absolute right-[3px] top-[22px] h-[2px] w-[12px] origin-left rotate-[18deg] rounded-full bg-[#111827] md:right-[4px] md:top-[24px] lg:right-[5px] lg:top-[26px]" />
                    <span className="absolute right-[2px] top-[25px] size-[4px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.28)] md:right-[3px] md:top-[27px] lg:right-[4px] lg:top-[29px]" />
                </span>
            </button>
        </div>
    );
}