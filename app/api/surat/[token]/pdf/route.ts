import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { createSupabaseAdminClient } from "@/services/supabase";

type SuratRow = {
    nomor_surat?: string | null;
    nomor_pengajuan?: string | null;
    status?: string | null;
    nama_lengkap?: string | null;
    nik?: string | null;
    alamat?: string | null;
    keperluan?: string | null;
    tanggal_surat?: string | null;
    lurah_name?: string | null;
    layanan?: { nama?: string | null } | { nama?: string | null }[] | null;
};

function baseUrl(request: NextRequest) {
    return process.env.NEXT_PUBLIC_SITE_URL ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("pengajuan_surat")
        .select("nomor_surat,nomor_pengajuan,status,nama_lengkap,nik,alamat,keperluan,tanggal_surat,lurah_name,verification_token,layanan(nama)")
        .eq("verification_token", token)
        .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const surat = data as SuratRow | null;
    if (!surat || !["SELESAI", "Selesai"].includes(String(surat.status))) return NextResponse.json({ ok: false, error: "Surat tidak valid atau belum diterbitkan." }, { status: 404 });

    const verifyUrl = `${baseUrl(request)}/verifikasi/${token}`;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
    const layanan = Array.isArray(surat.layanan) ? surat.layanan[0]?.nama : surat.layanan?.nama;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PEMERINTAH KOTA CILEGON", 105, 18, { align: "center" });
    doc.text("KELURAHAN TAMANSARI", 105, 26, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Kecamatan Pulomerak - Kota Cilegon", 105, 33, { align: "center" });
    doc.line(20, 38, 190, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(layanan ?? "SURAT KETERANGAN").toUpperCase(), 105, 52, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Nomor: ${surat.nomor_surat}`, 105, 60, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Nomor Pengajuan: ${surat.nomor_pengajuan}`, 20, 78);
    doc.text(`Nama: ${surat.nama_lengkap}`, 20, 88);
    doc.text(`NIK: ${surat.nik}`, 20, 98);
    doc.text(`Alamat: ${surat.alamat ?? "-"}`, 20, 108);
    doc.text("Menerangkan bahwa data pemohon tersebut telah diproses dan divalidasi melalui Sistem Pelayanan Digital Kelurahan Tamansari.", 20, 126, { maxWidth: 170 });
    doc.text(`Keperluan: ${surat.keperluan ?? "-"}`, 20, 146, { maxWidth: 170 });
    doc.addImage(qr, "PNG", 24, 164, 32, 32);
    doc.setFontSize(8);
    doc.text("Pindai QR untuk verifikasi keaslian surat.", 20, 201);
    doc.setFontSize(11);
    doc.text(`Cilegon, ${surat.tanggal_surat ?? new Date().toISOString().slice(0, 10)}`, 140, 168);
    doc.text("Lurah Tamansari", 140, 178);
    doc.setFont("helvetica", "bold");
    doc.text(surat.lurah_name ?? "LURAH TAMANSARI", 140, 205);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Dokumen ini diterbitkan melalui Sistem Pelayanan Digital Kelurahan Tamansari.", 105, 282, { align: "center" });
    const bytes = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="surat-${surat.nomor_pengajuan}.pdf"` } });
}