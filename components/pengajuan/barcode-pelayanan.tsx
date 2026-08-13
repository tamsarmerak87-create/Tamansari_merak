"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Download, Printer } from "lucide-react";

const START_B = 104;
const STOP = 106;
const PATTERNS = ["11011001100", "11001101100", "11001100110", "10010011000", "10010001100", "10001001100", "10011001000", "10011000100", "10001100100", "11001001000", "11001000100", "11000100100", "10110011100", "10011011100", "10011001110", "10111001100", "10011101100", "10011100110", "11001110010", "11001011100", "11001001110", "11011100100", "11001110100", "11101101110", "11101001100", "11100101100", "11100100110", "11101100100", "11100110100", "11100110010", "11011011000", "11011000110", "11000110110", "10100011000", "10001011000", "10001000110", "10110001000", "10001101000", "10001100010", "11010001000", "11000101000", "11000100010", "10110111000", "10110001110", "10001101110", "10111011000", "10111000110", "10001110110", "11101110110", "11010001110", "11000101110", "11011101000", "11011100010", "11011101110", "11101011000", "11101000110", "11100010110", "11101101000", "11101100010", "11100011010", "11101111010", "11001000010", "11110001010", "10100110000", "10100001100", "10010110000", "10010000110", "10000101100", "10000100110", "10110010000", "10110000100", "10011010000", "10011000010", "10000110100", "10000110010", "11000010010", "11001010000", "11110111010", "11000010100", "10001111010", "10100111100", "10010111100", "10010011110", "10111100100", "10011110100", "10011110010", "11110100100", "11110010100", "11110010010", "11011011110", "11011110110", "11110110110", "10101111000", "10100011110", "10001011110", "10111101000", "10111100010", "11110101000", "11110100010", "10111011110", "10111101110", "11101011110", "11110101110", "11010000100", "11010010000", "11010011100", "1100011101011"];

function encodeCode128(value: string) {
    const text = value.trim() || "-";
    const codes = [START_B, ...Array.from(text).map((char) => Math.min(95, Math.max(0, char.charCodeAt(0) - 32)))];
    const checksum = codes.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
    return [...codes, checksum, STOP].map((code) => PATTERNS[code] ?? "").join("");
}

export function BarcodePelayanan({ nomorPengajuan, status, tanggal, compact = false }: { nomorPengajuan?: string | null; status?: string | null; tanggal?: string | null; compact?: boolean }) {
    const number = nomorPengajuan || "-";
    const bits = useMemo(() => encodeCode128(number), [number]);
    const width = Math.max(220, bits.length * 2);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [svgText, setSvgText] = useState("");
    useEffect(() => { if (svgRef.current) setSvgText(new XMLSerializer().serializeToString(svgRef.current)); }, [bits]);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    function printBarcode() {
        const html = `<html><head><title>Barcode Pelayanan</title><style>body{font-family:Arial,sans-serif;margin:0;padding:32px;text-align:center;color:#172033}.box{border:1px solid #ddd;padding:28px;max-width:720px;margin:auto}h1{font-size:18px;margin:0}h2{font-size:24px;margin:10px 0 24px}img{width:100%;max-width:560px}.num{font:700 22px 'Courier New',monospace;margin-top:14px}.meta{margin-top:10px;color:#555}@media print{.box{border:0}}</style></head><body><div class="box"><h1>KELURAHAN TAMANSARI</h1><h2>BARCODE PELAYANAN</h2><img src="${dataUrl}" alt="Barcode ${number}"/><p>Nomor Agenda:</p><div class="num">${number}</div><div class="meta">${status || "Status pengajuan"}${tanggal ? ` - ${tanggal}` : ""}</div></div><script>window.onload=function(){window.print()}</script></body></html>`;
        const win = window.open("", "_blank", "width=820,height=720");
        win?.document.write(html); win?.document.close();
    }
    return <section className={`rounded-[22px] border border-[#E8E8E8] bg-white p-4 shadow-sm ${compact ? "" : "sm:p-5"}`} aria-label={`Barcode pelayanan ${number}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-black text-[#172033]"><Barcode className="text-[#16A34A]" size={18} />Barcode Pelayanan</div><p className="mt-1 text-xs font-semibold text-slate-500">Tunjukkan barcode ini kepada petugas saat datang ke Kelurahan.</p></div><div className="flex flex-wrap gap-2"><a aria-label="Unduh barcode pelayanan" href={dataUrl} download={`barcode-${number}.svg`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#16A34A]/40 bg-white px-3 text-sm font-black text-[#15803D] focus:outline-none focus:ring-4 focus:ring-[#FFC400]/40"><Download size={16} />Unduh</a><button aria-label="Cetak barcode pelayanan" onClick={printBarcode} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FFC400] px-3 text-sm font-black text-[#172033] focus:outline-none focus:ring-4 focus:ring-[#16A34A]/25"><Printer size={16} />Cetak</button></div></div>
        <div className="mt-4 rounded-2xl bg-[#F7F8F5] p-3 text-center"><svg ref={svgRef} role="img" aria-label={`Barcode ${number}`} viewBox={`0 0 ${width} 88`} className="mx-auto h-20 w-full max-w-[520px]"><rect width={width} height="88" fill="#fff" />{Array.from(bits).map((bit, i) => bit === "1" ? <rect key={i} x={i * 2} y="8" width="2" height="58" fill="#172033" /> : null)}<text x={width / 2} y="82" textAnchor="middle" fontFamily="monospace" fontSize="12" fontWeight="700" fill="#172033">{number}</text></svg></div>
    </section>;
}