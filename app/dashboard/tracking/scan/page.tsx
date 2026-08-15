"use client";

import { BackButton } from "@/components/warga/back-button";
import { QRScanner } from "@/components/tracking/qr-scanner";

export default function ScanTrackingPage() {
    return <main className="min-h-screen bg-[#F7F8F5] px-4 py-8 text-[#172033] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl">
            <BackButton className="mb-5" />
            <QRScanner />
        </section>
    </main>;
}