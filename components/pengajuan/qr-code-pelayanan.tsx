"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer, QrCode } from "lucide-react";

type QRCodePelayananProps = {
    nomorPengajuan?: string | null;
    size?: number;
    showActions?: boolean;
    status?: string | null;
    tanggal?: string | null;
    layanan?: string | null;
};

export function QRCodePelayanan({ nomorPengajuan, size = 180, showActions = true, status, tanggal, layanan }: QRCodePelayananProps) {
    const number = nomorPengajuan || "-";
    const [dataUrl, setDataUrl] = useState("");

    useEffect(() => {
        let mounted = true;
        void QRCode.toDataURL(number, {
            width: size * 2,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#172033", light: "#FFFFFF" },
        }).then((url) => {
            if (mounted) setDataUrl(url);
        });
        return () => { mounted = false; };
    }, [number, size]);

    function downloadQr() {
        if (!dataUrl) return;
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `QR-${number}.png`;
        link.click();
    }

    function printQr() {
        const html = `<html><head><title>QR Code Pelayanan</title><style>body{font-family:Arial,sans-serif;margin:0;padding:32px;text-align:center;color:#172033}.box{max-width:520px;margin:auto;border:1px solid #e8e8e8;border-radius:24px;padding:28px}h1{font-size:18px;margin:0}h2{font-size:26px;margin:10px 0 22px}img{width:240px;height:240px;object-fit:contain}.label{margin-top:18px;color:#555}.num{font:700 22px 'Courier New',monospace;margin-top:6px}.meta{margin-top:12px;font-weight:700}.hint{margin-top:18px;color:#555}@media print{body{padding:0}.box{border:0;border-radius:0}}</style></head><body><div class="box"><h1>KELURAHAN TAMANSARI</h1><h2>QR CODE PELAYANAN</h2><img src="${dataUrl}" alt="QR Code ${number}"/><p class="label">Nomor Agenda:</p><div class="num">${number}</div><div class="meta">${layanan || status || "Layanan pengajuan"}${tanggal ? ` - ${tanggal}` : ""}</div><p class="hint">Tunjukkan QR Code ini kepada petugas.</p></div><script>window.onload=function(){window.print()}</script></body></html>`;
        const win = window.open("", "_blank", "width=680,height=760");
        win?.document.write(html);
        win?.document.close();
    }

    return <section className="rounded-[24px] border border-[#E8E8E8] bg-white p-5 text-center shadow-sm" aria-label={`QR Code pelayanan ${number}`}>
        <div className="mb-4 text-left"><div className="flex items-center gap-2 text-sm font-black text-[#172033]"><QrCode className="text-[#16A34A]" size={18} />QR Pengajuan</div><p className="mt-1 text-xs font-semibold text-slate-500">Tunjukkan QR ini kepada petugas jika diperlukan.</p></div>
        <div className="mx-auto flex aspect-square items-center justify-center rounded-3xl border border-[#E8E8E8] bg-white p-3" style={{ width: size + 28, maxWidth: "100%" }}>{dataUrl ? <img src={dataUrl} width={size} height={size} alt={`QR Code ${number}`} className="aspect-square object-contain" /> : <div className="h-full w-full animate-pulse rounded-2xl bg-slate-100" />}</div>
        <p className="mt-3 font-mono text-sm font-black text-[#172033]">{number}</p>
        {showActions && <div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={downloadQr} aria-label="Download QR pengajuan" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#16A34A]/50 bg-white px-4 text-sm font-black text-[#15803D] transition hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-[#16A34A]/20"><Download size={16} />Download QR</button><button type="button" onClick={printQr} aria-label="Cetak QR pengajuan" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFC400] px-4 text-sm font-black text-[#172033] transition hover:bg-[#FFD84D] focus:outline-none focus:ring-4 focus:ring-[#FFC400]/40"><Printer size={16} />Cetak QR</button></div>}
    </section>;
}