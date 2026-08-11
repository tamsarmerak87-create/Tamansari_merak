"use client";
import Image from "next/image";
import { site } from "@/constants/site";

function CustomerService3DIcon() {
    return (
        <svg viewBox="0 0 96 96" role="img" aria-hidden="true" className="size-full drop-shadow-[0_12px_16px_rgba(15,50,120,.3)]">
            <defs>
                <radialGradient id="csGlow" cx="34%" cy="18%" r="72%">
                    <stop offset="0%" stopColor="#aee5ff" />
                    <stop offset="34%" stopColor="#3ba4ff" />
                    <stop offset="100%" stopColor="#1556d6" />
                </radialGradient>
                <linearGradient id="csSkin" x1="28" x2="66" y1="31" y2="65" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffe7c5" />
                    <stop offset="55%" stopColor="#f5bf86" />
                    <stop offset="100%" stopColor="#d98a4b" />
                </linearGradient>
                <linearGradient id="csDark" x1="25" x2="70" y1="23" y2="53" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2d3748" />
                    <stop offset="100%" stopColor="#080d18" />
                </linearGradient>
            </defs>
            <circle cx="48" cy="48" r="45" fill="url(#csGlow)" />
            <ellipse cx="48" cy="81" rx="25" ry="8" fill="#07306e" opacity=".28" />
            <path d="M23 46c0-16 10.5-27 25-27s25 11 25 27" fill="none" stroke="#172033" strokeWidth="7" strokeLinecap="round" />
            <path d="M27 52c0-14 8.5-24 21-24s21 10 21 24c0 16-9.5 26-21 26S27 68 27 52Z" fill="url(#csSkin)" />
            <path d="M29 40c4-13 13-18 24-16 8 1.5 13 7 15 15-9-1-15-4-20-10-4 7-10 10-19 11Z" fill="url(#csDark)" />
            <path d="M28 63c6 8 13 12 20 12s14-4 20-12v15H28V63Z" fill="#f5f8ff" opacity=".96" />
            <path d="M32 76h32l6 15H26l6-15Z" fill="#0d3d8f" />
            <circle cx="38" cy="52" r="3.4" fill="#162033" />
            <circle cx="58" cy="52" r="3.4" fill="#162033" />
            <path d="M40 62c4.5 4 11.5 4 16 0" fill="none" stroke="#7c3f20" strokeWidth="3" strokeLinecap="round" />
            <rect x="17" y="43" width="12" height="22" rx="6" fill="#101828" />
            <rect x="67" y="43" width="12" height="22" rx="6" fill="#101828" />
            <path d="M75 61c0 9-7 14-18 14" fill="none" stroke="#101828" strokeWidth="5" strokeLinecap="round" />
            <circle cx="56" cy="75" r="4.5" fill="#f8fbff" />
            <circle cx="31" cy="25" r="5" fill="#ffffff" opacity=".35" />
            <path d="M63 21c8 3 13 9 16 18" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".28" />
        </svg>
    );
}

export function FloatingActions() {
    const openChat = () => window.dispatchEvent(new CustomEvent("tamsar-chat:open"));

    return (
        <div className="fixed bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(14px,env(safe-area-inset-right))] z-[9999] flex flex-col items-end gap-4 md:bottom-[calc(20px+env(safe-area-inset-bottom))] md:right-[18px] lg:bottom-[calc(24px+env(safe-area-inset-bottom))] lg:right-6 lg:gap-5">
            <a
                className="group relative grid size-[58px] place-items-center rounded-full transition-transform duration-200 ease-out hover:scale-[1.06] focus:outline-none focus:ring-4 focus:ring-[#25d366]/25 md:size-[62px] lg:size-[68px]"
                href={`${site.wa}?text=Assalamualaikum%2C%20saya%20ingin%20bertanya%20layanan%20Tamansari`}
                aria-label="WhatsApp Kelurahan"
            >
                <Image src="/assets/icon-whatsapp-v3.svg" alt="" width={72} height={72} className="size-full transition-transform duration-200 group-hover:scale-[1.03]" aria-hidden="true" priority />
            </a>
            <button
                type="button"
                onClick={openChat}
                className="group relative grid size-[58px] place-items-center rounded-full transition-transform duration-200 ease-out hover:scale-[1.06] focus:outline-none focus:ring-4 focus:ring-sky-100 md:size-[62px] lg:size-[68px]"
                aria-label="Buka Chat TAMSAR AI"
            >
                <CustomerService3DIcon />
            </button>
        </div>
    );
}