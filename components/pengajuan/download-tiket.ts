import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { WargaPengajuan } from "@/services/warga-pengajuan.service";
import { getSiteUrl } from "@/lib/auth-url";

export function getNomorTiket(item: Pick<WargaPengajuan, "nomor_pengajuan"> & { nomor_tiket?: string | null }) {
    return item.nomor_tiket || item.nomor_pengajuan || "-";
}

export function getTrackingUrl(nomorPengajuan?: string | null) {
    return `${getSiteUrl()}/surat-online/tracking?nomor=${encodeURIComponent(nomorPengajuan || "")}`;
}

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

export async function downloadTiketPengajuan(item: WargaPengajuan) {
    const nomorPengajuan = item.nomor_pengajuan || "-";
    const nomorTiket = getNomorTiket(item);
    const trackingUrl = getTrackingUrl(item.nomor_pengajuan);
    const qr = await QRCode.toDataURL(trackingUrl, { margin: 1, width: 240 });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 297, "F");
    pdf.setDrawColor(11, 44, 106);
    pdf.setLineWidth(0.8);
    pdf.roundedRect(15, 15, 180, 267, 3, 3);
    pdf.setTextColor(11, 44, 106);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("PEMERINTAH KOTA CILEGON", 105, 28, { align: "center" });
    pdf.text("KECAMATAN PULOMERAK", 105, 35, { align: "center" });
    pdf.text("KELURAHAN TAMANSARI", 105, 42, { align: "center" });
    pdf.setDrawColor(201, 154, 59);
    pdf.line(25, 49, 185, 49);

    pdf.setFontSize(16);
    pdf.text("BUKTI TIKET PENGAJUAN", 105, 64, { align: "center" });
    pdf.setFontSize(11);
    pdf.text("PELAYANAN ONLINE", 105, 71, { align: "center" });
    pdf.setFillColor(11, 44, 106);
    pdf.roundedRect(35, 82, 140, 22, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.text(nomorTiket, 105, 96, { align: "center" });

    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(11);
    const rows: [string, string][] = [["Nomor Pengajuan", nomorPengajuan], ["Nama Pemohon", item.nama_lengkap || "-"], ["NIK", item.nik || "-"], ["Layanan", item.layanan?.nama || "Nama layanan tidak tersedia"], ["Tanggal Pengajuan", formatDate(item.created_at)], ["Keperluan", item.keperluan || "-"], ["Status", item.status || "Menunggu Verifikasi"]];
    let y = 120;
    rows.forEach(([label, value]) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(label, 30, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(`: ${value}`, 78, y, { maxWidth: 95 });
        y += 10;
    });

    pdf.addImage(qr, "PNG", 80, 194, 50, 50);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(11, 44, 106);
    pdf.text("Scan QR Code untuk memantau status pengajuan.", 105, 252, { align: "center" });
    pdf.setFontSize(9);
    pdf.text(trackingUrl, 105, 259, { align: "center", maxWidth: 160 });
    pdf.setTextColor(71, 85, 105);
    pdf.text("Kelurahan Tamansari • Kecamatan Pulomerak • Kota Cilegon", 105, 271, { align: "center" });
    pdf.text("Dokumen ini merupakan bukti tiket pengajuan pelayanan online.", 105, 277, { align: "center" });
    pdf.save(`Tiket-${nomorPengajuan}.pdf`);
}