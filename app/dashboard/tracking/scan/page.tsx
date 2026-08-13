git "use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { QRScanner } from "@/components/tracking/qr-scanner";

export default function ScanTrackingPage() {
    return <main className="min-h-screen bg-[#F7F8F5] px-4 py-8 text-[#172033] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl">
            <Link href="/dashboard" className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-[#E8E8E8] bg-white px-4 py-3 text-sm font-black shadow-sm transition hover:bg-[#FFF8DB] focus:outline-none focus:ring-4 focus:ring-[#FFC400]/30"><ChevronLeft size={18} />Kembali</Link>
            <QRScanner />
        </section>
    </main>;
}