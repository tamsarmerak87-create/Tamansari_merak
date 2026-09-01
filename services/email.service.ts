import { getAppBaseUrl } from "@/services/integrations";

export type ApplicationEmailStatus = "submitted" | "processing" | "verified" | "completed" | "rejected" | "documents_received";

export type ApplicationStatusEmailInput = {
    email: string;
    nama: string;
    nomorPengajuan: string;
    nomorTiket?: string | null;
    jenisPelayanan: string;
    status: ApplicationEmailStatus;
    catatan?: string | null;
    trackingUrl: string;
    tanggal: string | Date;
};

const STATUS_CONTENT: Record<ApplicationEmailStatus, { subject: string; label: string; message: string }> = {
    submitted: { subject: "Pengajuan Layanan Berhasil Diterima", label: "Diterima", message: "Pengajuan layanan Anda telah berhasil diterima dan akan masuk ke proses verifikasi." },
    processing: { subject: "Pengajuan Layanan Sedang Diproses", label: "Sedang Diproses", message: "Pengajuan layanan Anda sedang diproses oleh petugas Kelurahan Tamansari." },
    verified: { subject: "Pengajuan Layanan Telah Diverifikasi", label: "Terverifikasi", message: "Pengajuan layanan Anda telah melalui tahap verifikasi." },
    completed: { subject: "Pengajuan Layanan Selesai", label: "Selesai", message: "Pengajuan layanan Anda telah selesai. Silakan lihat halaman status untuk informasi selengkapnya." },
    rejected: { subject: "Pengajuan Layanan Ditolak", label: "Ditolak", message: "Pengajuan layanan Anda belum dapat dilanjutkan. Silakan perhatikan catatan petugas berikut." },
    documents_received: { subject: "Berkas Pengajuan Telah Diterima", label: "Berkas Diterima", message: "Berkas pengajuan Anda telah diterima dan divalidasi oleh petugas." },
};

const recentlySent = new Map<string, number>();
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

function escapeHtml(value: unknown) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function dateLabel(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date);
}

function emailHtml(input: ApplicationStatusEmailInput) {
    const content = STATUS_CONTENT[input.status];
    const ticket = input.nomorTiket ? `<tr><td style="padding:7px 0;color:#64748b">Nomor Tiket</td><td style="padding:7px 0;text-align:right;font-weight:700">${escapeHtml(input.nomorTiket)}</td></tr>` : "";
    const note = input.catatan?.trim() ? `<div style="margin-top:22px;padding:16px;border-left:4px solid #0f766e;background:#f0fdfa;border-radius:8px"><strong>Catatan Petugas</strong><p style="margin:8px 0 0;white-space:pre-line">${escapeHtml(input.catatan)}</p></div>` : "";
    return `<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08)"><tr><td style="padding:26px;background:#064e3b;color:#fff"><div style="font-size:22px;font-weight:800">Kelurahan Tamansari</div><div style="margin-top:5px;color:#d1fae5">Kecamatan Pulomerak, Kota Cilegon</div></td></tr><tr><td style="padding:30px 26px"><p style="margin-top:0">Yth. <strong>${escapeHtml(input.nama)}</strong>,</p><h1 style="font-size:23px;line-height:1.35;margin:18px 0 10px">${escapeHtml(content.subject)}</h1><p style="color:#475569;line-height:1.65">${escapeHtml(content.message)}</p><table role="presentation" width="100%" style="margin-top:20px;border-collapse:collapse;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0"><tr><td style="padding:14px 0 7px;color:#64748b">Nomor Pengajuan</td><td style="padding:14px 0 7px;text-align:right;font-weight:700">${escapeHtml(input.nomorPengajuan)}</td></tr>${ticket}<tr><td style="padding:7px 0;color:#64748b">Jenis Layanan</td><td style="padding:7px 0;text-align:right;font-weight:700">${escapeHtml(input.jenisPelayanan)}</td></tr><tr><td style="padding:7px 0;color:#64748b">Status Terbaru</td><td style="padding:7px 0;text-align:right;font-weight:700;color:#047857">${escapeHtml(content.label)}</td></tr><tr><td style="padding:7px 0 14px;color:#64748b">Tanggal</td><td style="padding:7px 0 14px;text-align:right">${escapeHtml(dateLabel(input.tanggal))} WIB</td></tr></table>${note}<div style="text-align:center;margin:28px 0 12px"><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:14px 22px;border-radius:9px;font-weight:700">Lihat Status Pengajuan</a></div><p style="font-size:12px;color:#64748b;word-break:break-all">Jika tombol tidak dapat dibuka, salin tautan ini:<br>${escapeHtml(input.trackingUrl)}</p></td></tr><tr><td style="padding:20px 26px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;text-align:center">Email ini dikirim otomatis oleh layanan resmi<br><strong>Kelurahan Tamansari</strong><br>Kecamatan Pulomerak, Kota Cilegon</td></tr></table></td></tr></table></body></html>`;
}

export async function sendApplicationStatusEmail(input: ApplicationStatusEmailInput) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!apiKey || !from) throw new Error(`Konfigurasi email Resend belum lengkap: ${!apiKey ? "RESEND_API_KEY" : "RESEND_FROM_EMAIL"} belum tersedia.`);
    if (!input.email?.trim()) throw new Error("Alamat email warga pada pengajuan tidak tersedia.");

    const fingerprint = `${input.nomorPengajuan}:${input.status}:${new Date(input.tanggal).toISOString()}`;
    const previous = recentlySent.get(fingerprint);
    if (previous && Date.now() - previous < IDEMPOTENCY_WINDOW_MS) return { skipped: true, reason: "duplicate" } as const;

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: input.email.trim(), subject: STATUS_CONTENT[input.status].subject, html: emailHtml(input) }),
    });
    if (!response.ok) throw new Error(`Resend gagal mengirim email (HTTP ${response.status}).`);
    recentlySent.set(fingerprint, Date.now());
    return { ok: true } as const;
}

export function statusEmailInputFromSubmission(row: Record<string, unknown>, status: ApplicationEmailStatus, catatan?: string | null, tanggal?: string) {
    const layanan = row.layanan && typeof row.layanan === "object" ? row.layanan as Record<string, unknown> : null;
    const nomorPengajuan = String(row.nomor_pengajuan ?? row.id ?? "");
    return {
        email: String(row.email ?? ""), nama: String(row.nama_lengkap ?? "Warga"), nomorPengajuan,
        nomorTiket: typeof row.nomor_tiket === "string" ? row.nomor_tiket : null,
        jenisPelayanan: String(layanan?.nama ?? row.jenis_surat ?? "Layanan Kelurahan"), status, catatan,
        trackingUrl: `${getAppBaseUrl()}/surat-online/tracking?nomor=${encodeURIComponent(nomorPengajuan)}`,
        tanggal: tanggal ?? String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    } satisfies ApplicationStatusEmailInput;
}

export async function sendApplicationStatusEmailSafely(input: ApplicationStatusEmailInput) {
    try { return await sendApplicationStatusEmail(input); }
    catch (error) {
        console.error("[APPLICATION STATUS EMAIL ERROR]", { nomorPengajuan: input.nomorPengajuan, status: input.status, message: error instanceof Error ? error.message : "Pengiriman email gagal." });
        return { ok: false } as const;
    }
}