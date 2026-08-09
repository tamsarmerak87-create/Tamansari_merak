import { CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { createSupabaseAdminClient } from "@/services/supabase";

type SuratRow = { nomor_surat?: string | null; nomor_pengajuan?: string | null; status?: string | null; nama_lengkap?: string | null; tanggal_surat?: string | null; lurah_name?: string | null; layanan?: { nama?: string | null } | { nama?: string | null }[] | null };

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

export default async function VerifikasiSuratPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
        .from("pengajuan_surat")
        .select("nomor_surat,nomor_pengajuan,status,workflow_status,nama_lengkap,tanggal_surat,lurah_name,verification_token,layanan(nama)")
        .eq("verification_token", token)
        .maybeSingle();
    const surat = data as SuratRow | null;
    const valid = Boolean(surat && ["SELESAI", "Selesai"].includes(String(surat.status)));
    const layanan = Array.isArray(surat?.layanan) ? surat?.layanan[0]?.nama : surat?.layanan?.nama;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-12 text-slate-800 sm:px-10 lg:px-20">
        <section className="mx-auto max-w-3xl overflow-hidden rounded-[36px] border border-white bg-white/90 shadow-[0_28px_90px_rgba(15,39,72,.13)] backdrop-blur">
            <div className={`p-8 text-white ${valid ? "bg-[linear-gradient(135deg,#0f766e,#0B2C6A)]" : "bg-[linear-gradient(135deg,#991b1b,#3f0b0b)]"}`}>
                <div className="inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[.2em] backdrop-blur">
                    {valid ? <CheckCircle2 className="size-4" /> : <ShieldAlert className="size-4" />} Verifikasi Surat
                </div>
                <h1 className="mt-6 text-3xl font-black sm:text-5xl">VERIFIKASI SURAT KELURAHAN TAMANSARI</h1>
                <p className="mt-4 text-lg font-bold text-white/80">{valid ? "Surat Valid" : "Surat Tidak Valid"}</p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
                <Info label="Nomor Surat" value={surat?.nomor_surat} />
                <Info label="Nomor Pengajuan" value={surat?.nomor_pengajuan} />
                <Info label="Jenis Surat" value={layanan} />
                <Info label="Nama Pemohon" value={surat?.nama_lengkap} />
                <Info label="Tanggal Terbit" value={formatDate(surat?.tanggal_surat)} />
                <Info label="Pejabat Penandatangan" value={surat?.lurah_name} />
                <Info label="Status Surat" value={valid ? "SELESAI / VALID" : (surat?.status ?? "Tidak ditemukan")} />
                {valid ? <a className="flex items-center justify-center gap-2 rounded-2xl bg-accent-400 px-5 py-3 font-black text-gov-950" href={`/api/surat/${token}/pdf`} target="_blank" rel="noreferrer"><FileText className="size-5" /> Lihat PDF</a> : null}
            </div>
            <p className="border-t border-slate-100 p-6 text-center text-sm font-bold text-slate-500">Dokumen ini diterbitkan melalui Sistem Pelayanan Digital Kelurahan Tamansari.</p>
        </section>
    </main>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
    return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</p><p className="mt-2 font-black text-gov-950">{value || "-"}</p></div>;
}