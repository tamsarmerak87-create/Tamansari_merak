"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, ImageUp, Loader2, QrCode, RotateCcw } from "lucide-react";

type ScanState = "idle" | "starting" | "scanning" | "decoded" | "invalid" | "error";

const scannerId = "qr-pengajuan-scanner";
const agendaPattern = /^TMS-\d{8}-\d{4,}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeTrackingValue(raw: string) {
    const scannedValue = raw.trim();
    if (!scannedValue) return null;
    try {
        const url = new URL(scannedValue);
        const nomor = url.searchParams.get("nomor") || url.searchParams.get("q") || url.searchParams.get("tracking");
        if (nomor) return normalizeTrackingValue(nomor);
        const segment = url.pathname.split("/").filter(Boolean).pop() || "";
        return normalizeTrackingValue(segment);
    } catch { }
    const cleaned = scannedValue.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 80);
    if (agendaPattern.test(cleaned)) return cleaned;
    const uuid = scannedValue.toLowerCase();
    if (uuidPattern.test(uuid)) return uuid;
    return null;
}

export function QRScanner({ redirectBase = "/surat-online/tracking" }: { redirectBase?: string }) {
    const router = useRouter();
    const scanner = useRef<Html5Qrcode | null>(null);
    const handled = useRef(false);
    const [state, setState] = useState<ScanState>("idle");
    const [message, setMessage] = useState("Izinkan akses kamera untuk memindai QR Code.");

    const canUseCamera = useMemo(() => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia), []);

    useEffect(() => {
        void startCamera();
        return () => { void stopCamera(); };
    }, []);

    async function stopCamera() {
        handled.current = false;
        if (!scanner.current) return;
        try {
            if (scanner.current.isScanning) await scanner.current.stop();
            await scanner.current.clear();
        } catch { }
        scanner.current = null;
    }

    async function startCamera() {
        if (!canUseCamera) {
            setState("error");
            setMessage("Kamera tidak tersedia pada perangkat ini.");
            return;
        }
        await stopCamera();
        setState("starting");
        setMessage("Arahkan kamera ke QR Code pelayanan Anda.");
        try {
            const instance = new Html5Qrcode(scannerId, false);
            scanner.current = instance;
            await instance.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 }, onDecoded, () => undefined);
            setState("scanning");
        } catch {
            setState("error");
            setMessage("Kamera tidak dapat digunakan. Izinkan akses kamera atau upload gambar QR dari galeri.");
        }
    }

    async function onDecoded(decodedText: string) {
        if (handled.current) return;
        handled.current = true;
        const value = normalizeTrackingValue(decodedText);
        if (!value) {
            setState("invalid");
            setMessage("QR Code tidak dikenali.");
            await stopCamera();
            return;
        }
        setState("decoded");
        setMessage("QR berhasil dibaca. Mencari dokumen...");
        await stopCamera();
        router.push(`${redirectBase}?nomor=${encodeURIComponent(value)}`);
    }

    async function scanFile(file?: File | null) {
        if (!file) return;
        await stopCamera();
        setState("starting");
        setMessage("Membaca QR dari gambar...");
        try {
            const instance = new Html5Qrcode(scannerId, false);
            scanner.current = instance;
            const decoded = await instance.scanFile(file, true);
            await onDecoded(decoded);
        } catch {
            setState("invalid");
            setMessage("QR belum terbaca. Pastikan gambar jelas dan QR berada di dalam frame.");
        }
    }

    return <section className="mx-auto max-w-xl rounded-[32px] border border-[#E8E8E8] bg-white p-5 text-center shadow-sm sm:p-7">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF8DB] text-[#F0A000]"><QrCode size={30} /></div>
        <h1 className="mt-4 text-3xl font-black text-[#172033]">Scan QR Pengajuan</h1>
        <p className="mt-2 text-sm font-bold text-slate-500">Arahkan kamera ke QR Code pelayanan Anda.</p>
        <div className="relative mx-auto mt-6 aspect-square w-[min(80vw,320px)] overflow-hidden rounded-[28px] border-4 border-[#FFC400] bg-[#172033] shadow-inner">
            <div id={scannerId} className="h-full w-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {(state === "scanning" || state === "starting") && <span className="pointer-events-none absolute left-6 right-6 top-8 h-1 animate-[scanline_1.8s_ease-in-out_infinite] rounded-full bg-[#16A34A] shadow-[0_0_18px_rgba(22,163,74,.8)]" />}
            {state === "starting" && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="animate-spin text-[#16A34A]" /></div>}
        </div>
        <p className={`mt-4 text-sm font-black ${state === "invalid" || state === "error" ? "text-red-600" : "text-[#15803D]"}`}>{message}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void startCamera()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFC400] px-4 text-sm font-black text-[#172033] focus:outline-none focus:ring-4 focus:ring-[#FFC400]/40"><RotateCcw size={16} />Scan Lagi</button>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#16A34A]/40 bg-white px-4 text-sm font-black text-[#15803D] focus-within:ring-4 focus-within:ring-[#16A34A]/20"><ImageUp size={16} />Upload QR<input type="file" accept="image/*" className="sr-only" onChange={(e) => void scanFile(e.target.files?.[0])} /></label>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-500"><Camera size={14} className="inline" /> Kamera hanya aktif saat halaman scanner dibuka dan akan berhenti saat ditutup.</p>
        <style jsx global>{`@keyframes scanline{0%,100%{transform:translateY(0)}50%{transform:translateY(230px)}}`}</style>
    </section>;
}