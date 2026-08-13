"use client";

import Link from "next/link";
import { QrCode } from "lucide-react";

export function ScanQRButton({ className = "" }: { className?: string }) {
    return <Link href="/dashboard/tracking/scan" className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#FFC400] px-5 text-sm font-black text-[#172033] shadow-sm transition hover:bg-[#FFD84D] focus:outline-none focus:ring-4 focus:ring-[#FFC400]/40 ${className}`}><QrCode size={18} />Scan QR</Link>;
}