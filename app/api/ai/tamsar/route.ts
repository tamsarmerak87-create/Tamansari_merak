import { NextResponse } from "next/server";
import { getTamsarCsReply, type ChatMessage } from "@/services/chat.service";
import { searchSubmission } from "@/services/surat-online.service";

const fallback = "Maaf, TAMSAR sedang mengalami gangguan.\n\nSilakan coba lagi beberapa saat kemudian atau hubungi petugas Kelurahan Tamansari.";

function actionsFor(message: string) {
    const q = message.toLowerCase();
    const actions = [] as { label: string; url: string }[];
    if (q.includes("buat") || q.includes("ajukan") || q.includes("surat")) actions.push({ label: "Buka Surat Online", url: "/surat-online" });
    if (q.includes("status") || q.includes("cek") || q.includes("lacak")) actions.push({ label: "Cek Pengajuan", url: "/surat-online/tracking" });
    if (q.includes("posbankum") || q.includes("hukum")) actions.push({ label: "Buka POSBANKUM", url: "/posbankum" });
    if (q.includes("kontak") || q.includes("hubungi") || q.includes("whatsapp")) actions.push({ label: "Hubungi Kelurahan", url: "/kontak" });
    return actions;
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as { message?: string; messages?: ChatMessage[] };
        const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
        const messages = Array.isArray(body.messages) ? body.messages : message ? [{ role: "user" as const, content: message }] : [];
        if (!messages.length) return NextResponse.json({ ok: false, error: "Pertanyaan belum diisi." }, { status: 400 });
        const latest = messages.at(-1)?.content ?? "";
        const trackingNumber = latest.toUpperCase().match(/TMS-\d{8}-\d{4,}/)?.[0];
        if (trackingNumber) {
            const rows = await searchSubmission(trackingNumber);
            const row = rows[0] as { status?: string; jenis_surat?: string; nomor_pengajuan?: string } | undefined;
            if (!row) return NextResponse.json({ ok: true, reply: `Assalamualaikum. Nomor pengajuan ${trackingNumber} tidak ditemukan. Silakan periksa kembali nomor tersebut.`, actions: [{ label: "Cek Pengajuan", url: `/surat-online/tracking?nomor=${encodeURIComponent(trackingNumber)}` }] });
            return NextResponse.json({ ok: true, reply: `Assalamualaikum. Status pengajuan ${row.nomor_pengajuan ?? trackingNumber} untuk ${row.jenis_surat ?? "dokumen Kelurahan"} adalah: ${row.status ?? "belum tersedia"}.`, actions: [{ label: "Lihat Pengajuan", url: `/surat-online/tracking?nomor=${encodeURIComponent(trackingNumber)}` }] });
        }
        const reply = await getTamsarCsReply(messages.slice(-10));
        return NextResponse.json({ ok: true, reply: reply || fallback, actions: actionsFor(messages.at(-1)?.content ?? "") });
    } catch {
        return NextResponse.json({ ok: false, reply: fallback, actions: [], error: "Layanan TAMSAR tidak dapat dihubungi." }, { status: 503 });
    }
}