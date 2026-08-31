import { CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { createSupabaseAdminClient } from "@/services/supabase";
import { isFinalDocument, isVerificationToken, templateFromSnapshot } from "@/services/official-document";

type SuratRow = { [key: string]: any; nama_lengkap?: string | null; nomor_surat?: string | null; nomor_pengajuan?: string | null; status?: string | null; tanggal_surat?: string | null; lurah_name?: string | null; signer_jabatan?: string | null; layanan?: { nama?: string | null } | { nama?: string | null }[] | null };

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

function maskName(value?: string | null) {
    return value?.trim().split(/\s+/).map((part) => part.length > 2 ? `${part.slice(0, 2)}${"*".repeat(Math.min(part.length - 2, 6))}` : `${part[0] ?? ""}*`).join(" ") || "-";
}

export default async function VerifikasiSuratPage({ params }: { params: Promise<{ token: string }> }) {
    const { token: code } = await params;
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
        .from("pengajuan_surat")
        .select("nama_lengkap,nomor_surat,nomor_pengajuan,status,tanggal_surat,issued_at,lurah_name,signer_nip,signer_jabatan,verification_token,verification_code,document_locked,template_snapshot,keperluan,layanan(nama)")
        .eq("verification_code", code.toUpperCase())
        .maybeSingle();
    const surat = data as SuratRow | null;
    const valid = Boolean(surat && isFinalDocument(surat) && templateFromSnapshot(surat.template_snapshot) && surat.nomor_surat && surat.tanggal_surat && surat.lurah_name && surat.signer_nip && surat.signer_jabatan && surat.verification_code && isVerificationToken(surat.verification_token));
    const inactive = Boolean(surat && !valid);
    const pdfToken = valid && surat ? surat.verification_token : null;
    const layanan = Array.isArray(surat?.layanan) ? surat?.layanan[0]?.nama : surat?.layanan?.nama;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-12 text-slate-800 sm:px-10 lg:px-20">
        <section className="mx-auto max-w-3xl overflow-hidden rounded-[36px] border border-white bg-white/90 shadow-[0_28px_90px_rgba(15,39,72,.13)] backdrop-blur">
            <div className={`p-8 text-white ${valid ? "bg-[linear-gradient(135deg,#0f766e,#0B2C6A)]" : "bg-[linear-gradient(135deg,#991b1b,#3f0b0b)]"}`}>
                <div className="inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[.2em] backdrop-blur">
                    {valid ? <CheckCircle2 className="size-4" /> : <ShieldAlert className="size-4" />} Verifikasi Surat
                </div>
                <h1 className="mt-6 text-3xl font-black sm:text-5xl">VERIFIKASI SURAT KELURAHAN TAMANSARI</h1>
                <p className="mt-4 text-lg font-bold text-white/80">{valid ? "✓ DOKUMEN TERVERIFIKASI" : inactive ? "⚠ DOKUMEN TIDAK AKTIF" : "✕ DOKUMEN TIDAK DAPAT DIVERIFIKASI"}</p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
                <Info label="Nama" value={valid ? maskName(surat?.nama_lengkap) : undefined} />
                <Info label="Nomor Surat" value={valid ? surat?.nomor_surat : undefined} />
                <Info label="Keperluan" value={valid ? surat?.keperluan : undefined} />
                <Info label="Jenis Surat" value={valid ? layanan : undefined} />
                <Info label="Tanggal Terbit" value={valid ? formatDate(surat?.tanggal_surat) : undefined} />
                <Info label="Pejabat Penandatangan" value={valid ? surat?.lurah_name : undefined} />
                <Info label="NIP" value={valid ? surat?.signer_nip : undefined} />
                <Info label="Kelurahan" value="Tamansari" />
                <Info label="Kecamatan" value="Pulomerak" />
                <Info label="Kota" value="Cilegon" />
                {pdfToken ? <div className="flex gap-2"><a className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent-400 px-5 py-3 font-black text-gov-950" href={`/api/surat/${pdfToken}/pdf`} target="_blank" rel="noreferrer"><FileText className="size-5" /> Lihat PDF</a><a className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gov-950 px-5 py-3 font-black text-gov-950" href={`/api/surat/${pdfToken}/pdf?download=1`}>Download</a></div> : null}
            </div>
            <p className="border-t border-slate-100 p-6 text-center text-sm font-bold text-slate-500">{valid ? "Dokumen ini terdaftar dan diterbitkan secara elektronik oleh Kelurahan Tamansari." : "Kode verifikasi tidak ditemukan atau dokumen tidak valid."}</p>
        </section>
    </main>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
    return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</p><p className="mt-2 font-black text-gov-950">{value || "-"}</p></div>;
}