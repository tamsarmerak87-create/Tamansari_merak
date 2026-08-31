import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSupabaseAdminClient } from "@/services/supabase";
import { assertTemplateContentSafe, isFinalDocument, templateFromSnapshot, validateTemplateFields } from "@/services/official-document";
import { MARRIAGE_TEMPLATE_ID, validateMarriageAdditionalData, type MarriagePerson, type ParentData } from "@/services/marriage-submission";

type SuratRow = {
    [key: string]: any;
    nomor_surat?: string | null;
    nomor_pengajuan?: string | null;
    status?: string | null;
    nama_lengkap?: string | null;
    nik?: string | null;
    agama?: string | null;
    status_perkawinan?: string | null;
    status_pekerjaan?: string | null;
    alamat?: string | null;
    keperluan?: string | null;
    tanggal_surat?: string | null;
    lurah_name?: string | null;
    signer_nip?: string | null;
    signer_jabatan?: string | null;
    verification_code?: string | null;
    layanan?: { nama?: string | null } | { nama?: string | null }[] | null;
};

export type OfficialPdfProfile = { alamat?: string | null };

const F4_WIDTH_MM = 215;
const F4_HEIGHT_MM = 330;
const F4_WIDTH_PT = 609.45;
const F4_HEIGHT_PT = 935.43;
const FOOTER_BOTTOM_MARGIN_MM = 10;
const FOOTER_LINE_GAP_MM = 3;
const FOOTER_X_MM = 10;
const FOOTER_RIGHT_MM = 205;
const FOOTER_FONT_SIZE_PT = 6.5;
const FOOTER_LINE_HEIGHT_MM = 3;
const FOOTER_ITEM_GAP_MM = 0.35;
const FOOTER_NUMBER_INDENT_MM = 5;
const BSRE_LOGO_WIDTH_MM = 28;
const BSRE_LOGO_HEIGHT_MM = 10.5;
const BSRE_LOGO_AREA_WIDTH_MM = 30;
const FOOTER_BOUNDARY_TOLERANCE_MM = 0.01;
const SIGNATURE_BODY_GAP_MM = 18;
const SIGNATURE_JOB_OFFSET_MM = 6;
const SIGNATURE_QR_OFFSET_MM = 10;
const SIGNATURE_NAME_GAP_MM = 6;
const SIGNATURE_NIP_GAP_MM = 6;
const SIGNATURE_FOOTER_GAP_MM = 6;
const SYSTEM_NOTES = [
    "Dokumen ini diterbitkan sistem Simapan Berdasarkan data dari Penduduk selaku Pemohon, Tersimpan dalam sistem Simapan, Yang menjadi tanggung jawab Pemohon.",
    "Dalam hal terjadi kekeliruan isi dokumen ini akan dilakukan perbaikan sebagaimana mestinya.",
    "Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh BSrE-BSSN.",
    "Data lengkap dokumen ini bisa dilihat melalui aplikasi simapan, Dengan menggunakan hak akses yang diberikan pemohon.",
];

function createF4PortraitPdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [F4_WIDTH_MM, F4_HEIGHT_MM], compress: true });
    const pointsPerMillimeter = 72 / 25.4;
    const widthPt = doc.internal.pageSize.getWidth() * pointsPerMillimeter;
    const heightPt = doc.internal.pageSize.getHeight() * pointsPerMillimeter;
    if (Math.abs(widthPt - F4_WIDTH_PT) > 0.01 || Math.abs(heightPt - F4_HEIGHT_PT) > 0.01) {
        throw new Error(`Ukuran halaman PDF tidak valid: ${widthPt.toFixed(2)} x ${heightPt.toFixed(2)} pt.`);
    }
    return doc;
}

function bottomAnchoredFooter(pageHeight: number, notesHeight: number, logoHeight: number) {
    const footerContentHeight = Math.max(notesHeight, logoHeight);
    const footerStartY = pageHeight - FOOTER_BOTTOM_MARGIN_MM - footerContentHeight;
    return {
        footerStartY,
        footerLineY: footerStartY - FOOTER_LINE_GAP_MM,
        footerSafeEndY: pageHeight - FOOTER_BOTTOM_MARGIN_MM,
    };
}

function administrativeFooterLayout(doc: jsPDF) {
    const textX = FOOTER_X_MM + FOOTER_NUMBER_INDENT_MM;
    const notesWidth = FOOTER_RIGHT_MM - textX - BSRE_LOGO_AREA_WIDTH_MM;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FOOTER_FONT_SIZE_PT);
    const wrappedNotes = SYSTEM_NOTES.map((note) => doc.splitTextToSize(note, notesWidth) as string[]);
    const notesHeight = wrappedNotes.reduce((height, lines, index) => height + Math.max(lines.length, 1) * FOOTER_LINE_HEIGHT_MM + (index < wrappedNotes.length - 1 ? FOOTER_ITEM_GAP_MM : 0), 0);
    const pageHeight = doc.internal.pageSize.getHeight();
    return { textX, wrappedNotes, notesHeight, ...bottomAnchoredFooter(pageHeight, notesHeight, BSRE_LOGO_HEIGHT_MM) };
}

function drawAdministrativeFooter(doc: jsPDF) {
    const numberX = FOOTER_X_MM;
    const { textX, wrappedNotes, notesHeight, footerLineY, footerStartY, footerSafeEndY } = administrativeFooterLayout(doc);
    doc.setLineWidth(0.2);
    doc.line(FOOTER_X_MM, footerLineY, FOOTER_RIGHT_MM, footerLineY);
    let noteY = footerStartY;
    wrappedNotes.forEach((lines, index) => {
        doc.text(`${index + 1}.`, numberX, noteY);
        lines.forEach((line, lineIndex) => doc.text(line, textX, noteY + lineIndex * FOOTER_LINE_HEIGHT_MM));
        noteY += Math.max(lines.length, 1) * FOOTER_LINE_HEIGHT_MM + (index < wrappedNotes.length - 1 ? FOOTER_ITEM_GAP_MM : 0);
    });
    const bsre = readFileSync(join(process.cwd(), "public", "assets", "logo", "Bsre.png"));
    const logoX = FOOTER_RIGHT_MM - BSRE_LOGO_WIDTH_MM;
    const logoY = footerStartY + Math.max((notesHeight - BSRE_LOGO_HEIGHT_MM) / 2, 0);
    doc.addImage(bsre, "PNG", logoX, logoY, BSRE_LOGO_WIDTH_MM, BSRE_LOGO_HEIGHT_MM);
    // Decimal millimetre increments can accumulate a tiny IEEE-754 drift even
    // when the footer ends exactly at the calculated safe boundary.
    if (Math.max(noteY, logoY + BSRE_LOGO_HEIGHT_MM) > footerSafeEndY + FOOTER_BOUNDARY_TOLERANCE_MM) throw new Error("Footer surat melewati batas aman F4.");
}

function signatureBlockLayout(doc: jsPDF, bodyEnd: number, qrHeight: number) {
    const signatureBlockY = bodyEnd + SIGNATURE_BODY_GAP_MM;
    const signatureDateY = signatureBlockY;
    const signatureJobY = signatureDateY + SIGNATURE_JOB_OFFSET_MM;
    const signatureQrY = signatureBlockY + SIGNATURE_QR_OFFSET_MM;
    const signatureNameY = signatureQrY + qrHeight + SIGNATURE_NAME_GAP_MM;
    const signatureNipY = signatureNameY + SIGNATURE_NIP_GAP_MM;
    const signatureEndY = signatureNipY;

    const { footerLineY } = administrativeFooterLayout(doc);
    const signatureSafeEndY = footerLineY - SIGNATURE_FOOTER_GAP_MM;
    if (signatureEndY > signatureSafeEndY) throw new Error("Blok tanda tangan melewati batas aman footer F4.");

    return { signatureDateY, signatureJobY, signatureQrY, signatureNameY, signatureNipY };
}

function baseUrl(request: NextRequest) {
    return process.env.NEXT_PUBLIC_SITE_URL ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

function value(value: unknown) {
    const result = String(value ?? "").trim();
    return result || "-";
}

function formatDate(valueToFormat: unknown) {
    const raw = String(valueToFormat ?? "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (!match) return raw || "-";
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

function drawWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 4.5) {
    const lines = doc.splitTextToSize(text, width) as string[];
    doc.text(lines, x, y);
    return y + Math.max(lines.length, 1) * lineHeight;
}

function drawJustified(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 4.8) {
    const lines = doc.splitTextToSize(text, width) as string[];
    lines.forEach((line, index) => doc.text(line, x, y + index * lineHeight, { maxWidth: width, align: index === lines.length - 1 ? "left" : "justify" }));
    return y + Math.max(lines.length, 1) * lineHeight;
}

function drawJustifiedParagraph(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number, firstLineIndent = 0) {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let current = "";
    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        const availableWidth = lines.length === 0 ? width - firstLineIndent : width;
        if (current && doc.getTextWidth(candidate) > availableWidth) {
            lines.push(current);
            current = word;
        } else current = candidate;
    });
    if (current) lines.push(current);
    lines.forEach((line, index) => {
        const lineX = index === 0 ? x + firstLineIndent : x;
        const lineWidth = index === 0 ? width - firstLineIndent : width;
        doc.text(line, lineX, y + index * lineHeight, {
            maxWidth: lineWidth,
            align: index === lines.length - 1 ? "left" : "justify",
        });
    });
    return y + Math.max(lines.length, 1) * lineHeight;
}

function cilegonLogo() {
    return readFileSync(join(process.cwd(), "public", "assets", "logo-cilegon-transparent.png"));
}

function drawLetterHeader(doc: jsPDF, title: string, number: string, pageWidth: number) {
    const center = pageWidth / 2;
    const left = 22;
    const right = pageWidth - 22;
    const logo = cilegonLogo();
    const properties = doc.getImageProperties(logo);
    const height = 23;
    doc.addImage(logo, properties.fileType, 23, 11.5, height * properties.width / properties.height, height);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("PEMERINTAH KOTA CILEGON", center, 15, { align: "center" });
    doc.text("KECAMATAN PULOMERAK", center, 20.5, { align: "center" });
    doc.setFontSize(14);
    doc.text("KELURAHAN TAMANSARI", center, 27, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Jln. Langon Indah RT.04/06 Merak Pulomerak - Cilegon", center, 33, { align: "center" });
    doc.text("Telp : 0254570624   Email :   Website :", center, 38, { align: "center" });
    doc.setLineWidth(0.22);
    doc.line(left, 42, right, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title.toUpperCase(), center, 52, { align: "center" });
    doc.setLineWidth(0.25);
    doc.line(center - 38, 53.3, center + 38, 53.3);
    doc.setFontSize(10.5);
    doc.text(`NOMOR : ${number}`, center, 59, { align: "center" });
}

type NikahRows = Array<[string, unknown]>;
const NIKAH_LEFT = 20;
const NIKAH_RIGHT = 195;

function startNikahPage(doc: jsPDF) {
    const firstPageContent = (doc.internal.pages as unknown as Record<number, unknown>)[1];
    const firstPageHasDrawing = Array.isArray(firstPageContent) && firstPageContent.length > 2;
    if (doc.getNumberOfPages() > 1 || firstPageHasDrawing) doc.addPage([F4_WIDTH_MM, F4_HEIGHT_MM], "portrait");
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
}

function drawNikahAppendixHeader(doc: jsPDF, appendix: string, form: string, model: string) {
    startNikahPage(doc); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    [appendix, "KEPUTUSAN DIREKTUR JENDERAL BIMBINGAN MASYARAKAT ISLAM", "NOMOR 473 TAHUN 2020", "TENTANG", "PETUNJUK TEKNIS PELAKSANAAN PENCATATAN PERNIKAHAN"].forEach((line, index) => doc.text(line, NIKAH_LEFT, 15 + index * 4));
    doc.setFontSize(11); doc.text(form, F4_WIDTH_MM / 2, 41, { align: "center" }); doc.setFontSize(9.5); doc.text(model, NIKAH_RIGHT, 47, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); return 55;
}

function drawNikahRows(doc: jsPDF, rows: NikahRows, y: number, options: { numbered?: boolean; labelX?: number; colonX?: number; valueX?: number; width?: number; lineHeight?: number } = {}) {
    const labelX = options.labelX ?? NIKAH_LEFT, colonX = options.colonX ?? 79, valueX = options.valueX ?? 83, width = options.width ?? NIKAH_RIGHT - valueX, lineHeight = options.lineHeight ?? 4.25;
    rows.forEach(([label, raw], index) => {
        const prefix = options.numbered ? `${index + 1}.` : ""; if (prefix) doc.text(prefix, labelX, y);
        doc.text(label, labelX + (prefix ? 7 : 0), y); doc.text(":", colonX, y);
        const lines = doc.splitTextToSize(String(raw ?? ""), width) as string[]; if (lines.length) doc.text(lines, valueX, y);
        y += Math.max(lines.length, 1) * lineHeight;
    }); return y;
}

function marriagePersonRows(person: MarriagePerson): NikahRows { return [["Nama Lengkap", person.nama_lengkap], ["Nomor Induk Kependudukan", person.nik], ["Jenis Kelamin", person.jenis_kelamin], ["Tempat dan Tanggal Lahir", `${person.tempat_lahir}, ${formatDate(person.tanggal_lahir)}`], ["Kewarganegaraan", person.kewarganegaraan], ["Agama", person.agama], ["Pekerjaan", person.pekerjaan], ["Alamat", `${person.alamat}, RT ${person.rt}/RW ${person.rw}, ${person.kelurahan}, ${person.kecamatan}`]]; }
function marriageApplicantRows(s: SuratRow): NikahRows { return [["Nama Lengkap", s.nama_lengkap], ["Nomor Induk Kependudukan", s.nik], ["Jenis Kelamin", s.jenis_kelamin], ["Tempat dan Tanggal Lahir", `${value(s.tempat_lahir)}, ${formatDate(s.tanggal_lahir)}`], ["Kewarganegaraan", "Warga Negara Indonesia"], ["Agama", s.agama], ["Pekerjaan", s.status_pekerjaan], ["Alamat", `${value(s.alamat)}, RT ${value(s.rt)}/RW ${value(s.rw)}, ${value(s.kelurahan)}, ${value(s.kecamatan)}`]]; }
function marriageParentRows(parent: ParentData): NikahRows { return [["Nama Lengkap", parent.nama_lengkap], ["Nomor Induk Kependudukan", parent.nik], ["Jenis Kelamin", parent.jenis_kelamin], ["Tempat dan Tanggal Lahir", parent.tempat_lahir ? `${parent.tempat_lahir}, ${formatDate(parent.tanggal_lahir)}` : ""], ["Kewarganegaraan", parent.kewarganegaraan], ["Agama", parent.agama], ["Pekerjaan", parent.pekerjaan], ["Alamat", parent.alamat]]; }
function drawCitizenSignatures(doc: jsPDF, leftLabel: string, rightLabel: string, date: string, y: number) { doc.text(leftLabel, 50, y, { align: "center" }); doc.text(`Tamansari, ${date}`, 160, y, { align: "center" }); doc.text(rightLabel, 160, y + 5, { align: "center" }); doc.text("(________________________)", 50, y + 27, { align: "center" }); doc.text("(________________________)", 160, y + 27, { align: "center" }); }

function drawNikahNotice(doc: jsPDF, surat: SuratRow, data: ReturnType<typeof validateMarriageAdditionalData>, wife: NikahRows, husband: NikahRows) {
    startNikahPage(doc); doc.setFontSize(10); const date = formatDate(surat.tanggal_surat);
    drawNikahRows(doc, [["Nomor", surat.nomor_surat], ["Lampiran", "-"], ["Hal", "Pemberitahuan Kehendak Nikah"]], 20, { colonX: 38, valueX: 42, width: 65 });
    doc.text(`Tamansari, ${date}`, 130, 20); doc.text("Kepada", 130, 30); doc.text("Yth. Pegawai Pencatat Nikah", 137, 36); doc.text("KUA Kecamatan/PPN", 137, 41); doc.text("Di Tempat", 137, 46);
    doc.text("Assalamu'alaikum Wr. Wb,", NIKAH_LEFT, 59); const wifeName = value(wife[0][1]), husbandName = value(husband[0][1]);
    let y = drawJustified(doc, `Dengan ini kami memberitahukan bahwa kami bermaksud akan melangsungkan pernikahan antara ${wifeName} dengan ${husbandName} pada hari ${data.nikah.hari_akad}, ${formatDate(data.nikah.tanggal_akad)} pukul ${data.nikah.jam_akad} WIB dengan mas kawin ${data.nikah.mas_kawin} dibayar ${data.nikah.cara_pembayaran_mas_kawin}. Bertempat di ${data.nikah.tempat_akad}, KUA tujuan ${data.nikah.kua_tujuan}, dengan lampiran surat-surat yang diperlukan untuk diperiksa sebagai berikut:`, NIKAH_LEFT, 69, 175, 5);
    const attachments = ["Formulir Surat Pengantar Nikah, Model N1, N2", ...(data.paket_dokumen.n3 ? ["Formulir Permohonan Pencatatan Isbat, Model N3"] : []), "Formulir Persetujuan Calon Pengantin, Model N4", "Formulir Surat Izin Orang Tua, Model N5"];
    attachments.forEach((line, index) => { doc.text(`${index + 1}.`, 27, y); doc.text(line, 35, y); y += 5; });
    y = drawWrapped(doc, "Kiranya dapat dihadiri dan dicatat pelaksanaannya sesuai dengan ketentuan perundang-undangan yang berlaku.", NIKAH_LEFT, y + 3, 175, 5); doc.text("Wassalamu'alaikum Wr. Wb,", NIKAH_LEFT, y + 2);
    doc.text("Diterima tanggal .....................", 25, y + 17); doc.text("Yang memberitahukan", 158, y + 17, { align: "center" }); doc.text("Yang menerima", 25, y + 23); doc.text("Calon Mempelai/Wali/Wakil Wali*)", 158, y + 23, { align: "center" }); doc.text("PPN/Pembantu PPN*)", 25, y + 29); doc.text("(________________________)", 52, y + 51, { align: "center" }); doc.text("(________________________)", 158, y + 51, { align: "center" });
    drawAdministrativeFooter(doc);
}

function drawN1(doc: jsPDF, surat: SuratRow, data: ReturnType<typeof validateMarriageAdditionalData>, qr: string) {
    let y = drawNikahAppendixHeader(doc, "LAMPIRAN IV", "FORMULIR SURAT PENGANTAR NIKAH", "Model N1");
    y = drawNikahRows(doc, [["KANTOR DESA/KELURAHAN", "TAMANSARI"], ["KECAMATAN", "PULOMERAK"], ["KABUPATEN/KOTA", "KOTA CILEGON"]], y, { colonX: 70, valueX: 75, lineHeight: 5 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("FORMULIR PENGANTAR NIKAH", F4_WIDTH_MM / 2, y + 3, { align: "center" }); doc.setFontSize(9.5); doc.text(`Nomor : ${value(surat.nomor_surat)}`, F4_WIDTH_MM / 2, y + 8, { align: "center" }); doc.setFont("helvetica", "normal");
    y += 17; doc.text("Yang bertanda tangan dibawah ini menerangkan dengan sesungguhnya bahwa:", NIKAH_LEFT, y); y += 6;
    y = drawNikahRows(doc, [...marriageApplicantRows(surat), ["Status pernikahan", surat.status_perkawinan]], y, { numbered: true, lineHeight: 3.8 });
    doc.text("Adalah benar anak dari perkawinan seorang pria:", NIKAH_LEFT, y + 2); y += 7; y = drawNikahRows(doc, marriageParentRows(data.orang_tua.ayah), y, { lineHeight: 3.65 });
    doc.text("Dengan seorang wanita:", NIKAH_LEFT, y + 2); y += 7; y = drawNikahRows(doc, marriageParentRows(data.orang_tua.ibu), y, { lineHeight: 3.65 });
    y = drawWrapped(doc, "Demikian, Surat pengantar ini dibuat dengan mengingat sumpah jabatan dan untuk dipergunakan sebagaimana mestinya.", NIKAH_LEFT, y + 3, 105, 4);
    const signX = 160, signY = Math.max(y + 2, 220); doc.text(`Tamansari, ${formatDate(surat.tanggal_surat)}`, signX, signY, { align: "center" }); doc.text(value(surat.signer_jabatan ?? "LURAH"), signX, signY + 5, { align: "center" }); doc.addImage(qr, "PNG", signX - 11, signY + 7, 22, 22); doc.setFont("helvetica", "bold"); doc.text(value(surat.lurah_name), signX, signY + 33, { align: "center" }); doc.setFont("helvetica", "normal"); doc.text(`NIP. ${value(surat.signer_nip)}`, signX, signY + 38, { align: "center" }); drawAdministrativeFooter(doc);
}

function drawN2(doc: jsPDF, surat: SuratRow, data: ReturnType<typeof validateMarriageAdditionalData>, wife: NikahRows, husband: NikahRows) {
    let y = drawNikahAppendixHeader(doc, "LAMPIRAN VI", "FORMULIR SURAT PENGANTAR NIKAH", "Model N2"); doc.text("Prihal : Permohonan kehendak nikah", NIKAH_LEFT, y); doc.text(`Tamansari, ${formatDate(surat.tanggal_surat)}`, 145, y); y += 12;
    doc.text("Kepada Yth.", 125, y); doc.text("Kepala Kantor Urusan Agama (KUA)", 125, y + 5); doc.text("Kecamatan Pulomerak", 125, y + 10); doc.text("di Tempat", 125, y + 15); y += 28;
    y = drawWrapped(doc, "Dengan hormat, kami mengajukan permohonan kehendak nikah untuk atas nama:", NIKAH_LEFT, y, 175, 5); y = drawNikahRows(doc, [["Calon Istri", wife[0][1]], ["Calon Suami", husband[0][1]], ["Hari/Tanggal/Jam", `${data.nikah.hari_akad}, ${formatDate(data.nikah.tanggal_akad)}, ${data.nikah.jam_akad} WIB`], ["Tempat Akad Nikah", data.nikah.tempat_akad]], y + 2, { colonX: 68, valueX: 73 });
    doc.text("Bersama ini kami sampaikan dokumen sebagai berikut:", NIKAH_LEFT, y + 3); y += 9; ["Fotokopi akte kelahiran", "Fotokopi kartu keluarga", "Paspoto 2x3 3 lembar berlatar belakang biru", "Persetujuan calon mempelai", "Surat pengantar nikah dari Desa atau Kelurahan", "........................................................", "........................................................"].forEach((line, index) => { doc.text(`${index + 1}. ${line}`, 27, y); y += 5; });
    doc.text("Diterima Tanggal .....................", 28, y + 12); doc.text("Wassalam,", 158, y + 12, { align: "center" }); doc.text("Yang Menerima,", 45, y + 18, { align: "center" }); doc.text("Pemohon", 158, y + 18, { align: "center" }); doc.text("Kantor Urusan Agama (KUA)", 45, y + 24, { align: "center" }); doc.text("(________________________)", 45, y + 50, { align: "center" }); doc.text("(________________________)", 158, y + 45, { align: "center" }); doc.text(`(${value(surat.nama_lengkap)})`, 158, y + 51, { align: "center" }); drawAdministrativeFooter(doc);
}

function drawN3(doc: jsPDF, surat: SuratRow, wife: NikahRows, husband: NikahRows) {
    let y = drawNikahAppendixHeader(doc, "LAMPIRAN VII", "FORMULIR PERMOHONAN PENCATATAN ISBAT", "Model N3"); doc.text("Prihal : Permohonan pencatatan isbat", NIKAH_LEFT, y); y += 12; doc.text("Kepada Yth.", 125, y); doc.text("Kepala Kantor Urusan Agama (KUA)", 125, y + 5); doc.text("Kecamatan Pulomerak", 125, y + 10); doc.text("di Tempat", 125, y + 15); y += 29;
    y = drawNikahRows(doc, [["Istri", wife[0][1]], ["Suami", husband[0][1]], ["Tanggal penetapan", ""], ["Pengadilan Agama", ""]], y, { colonX: 68, valueX: 73, lineHeight: 5 }); doc.text("Dengan ini mengajukan pencatatan isbat dengan dokumen:", NIKAH_LEFT, y + 3); y += 10;
    ["Putusan Isbat", "Fotokopi KTP", "Fotokopi kartu keluarga", "Pasfoto 2x3 = 3 lembar berlatar belakang biru", "........................................................", "........................................................"].forEach((line, index) => { doc.text(`${index + 1}. ${line}`, 27, y); y += 5; });
    doc.text("Diterima Tanggal .....................", 28, y + 15); doc.text("Wassalam,", 158, y + 15, { align: "center" }); doc.text("Yang Menerima", 45, y + 21, { align: "center" }); doc.text("Pemohon", 158, y + 21, { align: "center" }); doc.text("Kantor Urusan Agama (KUA)", 45, y + 27, { align: "center" }); doc.text("(________________________)", 45, y + 53, { align: "center" }); doc.text("(________________________)", 158, y + 48, { align: "center" }); doc.text(`(${value(surat.nama_lengkap)})`, 158, y + 54, { align: "center" }); drawAdministrativeFooter(doc);
}

function drawN4(doc: jsPDF, surat: SuratRow, wife: NikahRows, husband: NikahRows) {
    let y = drawNikahAppendixHeader(doc, "LAMPIRAN VIII", "FORMULIR PERSETUJUAN CALON PENGANTIN", "Model N4"); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("SURAT PERSETUJUAN PENGANTIN", F4_WIDTH_MM / 2, y, { align: "center" }); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); y += 9; doc.text("Yang bertanda tangan dibawah ini:", NIKAH_LEFT, y); y += 7; doc.setFont("helvetica", "bold"); doc.text("A. Calon Istri", NIKAH_LEFT, y); doc.setFont("helvetica", "normal"); y = drawNikahRows(doc, wife, y + 5, { numbered: true, lineHeight: 4 }); doc.setFont("helvetica", "bold"); doc.text("B. Calon Suami", NIKAH_LEFT, y + 2); doc.setFont("helvetica", "normal"); y = drawNikahRows(doc, husband, y + 7, { numbered: true, lineHeight: 4 });
    y = drawWrapped(doc, "Menyatakan dengan sesungguhnya bahwa atas dasar sukarela dengan kesadaran sendiri, tanpa paksaan dari siapapun juga, setuju untuk melangsungkan pernikahan.", NIKAH_LEFT, y + 4, 175, 4.5); drawCitizenSignatures(doc, "Calon Istri", "Calon Suami", formatDate(surat.tanggal_surat), y + 8); drawAdministrativeFooter(doc);
}

function drawN5(doc: jsPDF, surat: SuratRow, data: ReturnType<typeof validateMarriageAdditionalData>, applicant: NikahRows, partner: NikahRows) {
    let y = drawNikahAppendixHeader(doc, "LAMPIRAN IX", "FORMULIR SURAT IZIN ORANG TUA", "Model N5"); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("SURAT IZIN ORANG TUA", F4_WIDTH_MM / 2, y, { align: "center" }); doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); y += 8;
    doc.setFont("helvetica", "bold"); doc.text("A. Ayah", NIKAH_LEFT, y); doc.setFont("helvetica", "normal"); y = drawNikahRows(doc, marriageParentRows(data.orang_tua.ayah), y + 4, { numbered: true, lineHeight: 3.5 }); doc.setFont("helvetica", "bold"); doc.text("B. Ibu", NIKAH_LEFT, y + 1); doc.setFont("helvetica", "normal"); y = drawNikahRows(doc, marriageParentRows(data.orang_tua.ibu), y + 5, { numbered: true, lineHeight: 3.5 });
    doc.text("Adalah ayah kandung dan ibu kandung dari:", NIKAH_LEFT, y + 1); y = drawNikahRows(doc, applicant, y + 6, { numbered: true, lineHeight: 3.5 }); doc.text("Memberikan ijin kepada anak kami untuk melakukan perkawinan dengan:", NIKAH_LEFT, y + 1); y = drawNikahRows(doc, partner, y + 6, { numbered: true, lineHeight: 3.5 });
    y = drawWrapped(doc, "Demikian Surat Ijin ini dibuat dengan kesadaran tanpa ada paksaan dari siapapun dan untuk digunakan sebagaimana mestinya.", NIKAH_LEFT, y + 2, 175, 3.8); drawCitizenSignatures(doc, "Ayah", "Ibu", formatDate(surat.tanggal_surat), y + 3); drawAdministrativeFooter(doc);
}

function drawNikahStatement(doc: jsPDF, surat: SuratRow, data: ReturnType<typeof validateMarriageAdditionalData>) {
    startNikahPage(doc); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("SURAT PERNYATAAN", F4_WIDTH_MM / 2, 20, { align: "center" }); doc.setLineWidth(0.2); doc.line(76, 22, 139, 22); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text("Yang bertanda tangan dibawah ini menerangkan dengan sesungguhnya bahwa:", NIKAH_LEFT, 33);
    const rows: NikahRows = [["Nama Lengkap dan alias", surat.nama_lengkap], ["Bin / Binti", ""], ["Nomor Induk Kependudukan", surat.nik], ["Jenis Kelamin", surat.jenis_kelamin], ["Tempat dan Tanggal Lahir", `${value(surat.tempat_lahir)}, ${formatDate(surat.tanggal_lahir)}`], ["Kewarganegaraan", "Warga Negara Indonesia"], ["Agama", surat.agama], ["Pekerjaan", surat.status_pekerjaan], ["Alamat", surat.alamat]];
    doc.text("I.", NIKAH_LEFT, 43); let y = drawNikahRows(doc, rows, 43, { numbered: true, labelX: 27, lineHeight: 4.5 }); const status = value(surat.status_perkawinan);
    y = drawWrapped(doc, `Dengan ini Saya menyatakan bahwa saat ini masih berstatus ${status} dan (belum pernah menikah / menikah Lagi) dengan siapapun.`, NIKAH_LEFT, y + 5, 175, 5); y = drawWrapped(doc, "Demikian Surat pernyataan ini dibuat untuk melengkapi persyaratan pernikahan saya.", NIKAH_LEFT, y + 3, 175, 5); y = drawWrapped(doc, "Demikianlah, surat keterangan ini dibuat dengan sebenarnya dalam keadaan sehat jasmani dan rohani.", NIKAH_LEFT, y + 3, 175, 5); y = drawWrapped(doc, "Apabila di kemudian hari ada gugatan dari pihak manapun, Saya siap bertanggung jawab sepenuhnya dan tidak akan melibatkan pihak manapun.", NIKAH_LEFT, y + 3, 175, 5);
    const signY = y + 10; doc.text(`Tamansari, ${formatDate(surat.tanggal_surat)}`, 157, signY, { align: "center" }); doc.rect(139, signY + 5, 36, 20); doc.text("MATERAI 10000", 157, signY + 16, { align: "center" }); doc.text("(________________________)", 157, signY + 38, { align: "center" }); doc.setFont("helvetica", "bold"); doc.text(`(${value(surat.nama_lengkap)})`, 157, signY + 44, { align: "center" }); doc.setFont("helvetica", "normal"); doc.text("SAKSI-SAKSI RT/RW (STEMPEL):", NIKAH_LEFT, signY + 10); doc.text("1. ..................................................... (       )", NIKAH_LEFT + 5, signY + 20); doc.text("2. ..................................................... (       )", NIKAH_LEFT + 5, signY + 29); drawAdministrativeFooter(doc);
}

function drawMarriagePackage(doc: jsPDF, surat: SuratRow, qr: string) {
    const data = validateMarriageAdditionalData(surat.additional_data); const applicantIsMale = /laki/i.test(value(surat.jenis_kelamin));
    const applicant = marriageApplicantRows(surat), partner = marriagePersonRows(data.pasangan); const husband = applicantIsMale ? applicant : partner, wife = applicantIsMale ? partner : applicant;
    drawNikahNotice(doc, surat, data, wife, husband); drawN1(doc, surat, data, qr); drawN2(doc, surat, data, wife, husband);
    if (data.paket_dokumen.n3) drawN3(doc, surat, wife, husband);
    drawN4(doc, surat, wife, husband); drawN5(doc, surat, data, applicant, partner); drawNikahStatement(doc, surat, data);
}

function drawTmsPdf(doc: jsPDF, surat: SuratRow, qr: string, _layanan: string) {
    const left = 22;
    const right = 188;
    const width = right - left;
    const pageCenter = 105;
    const bodyLineHeight = 5.1;
    const paragraphGap = 4.5;
    const purposeClosingGap = 5;
    drawLetterHeader(doc, "SURAT KETERANGAN DOMISILI", value(surat.nomor_surat), 210);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    let y = 68;
    y = drawJustifiedParagraph(doc, "Yang bertanda tangan dibawah ini Lurah Tamansari Kecamatan Pulomerak Kota Cilegon, menerangkan bahwa :", left, y, width, bodyLineHeight) + paragraphGap;

    const rows: Array<[string, string]> = [
        ["NIK", value(surat.nik)], ["Nama Lengkap", value(surat.nama_lengkap)],
        ["Tempat/Tgl.Lahir", `${value(surat.tempat_lahir)} / ${formatDate(surat.tanggal_lahir)}`],
        ["Jenis Kelamin", value(surat.jenis_kelamin)], ["Agama", value(surat.agama)],
        ["Status Perkawinan", value(surat.status_perkawinan)], ["Pekerjaan", value(surat.status_pekerjaan)],
        ["Alamat Asal", value(surat.alamat)], ["Alamat Tempat Tinggal Sekarang", value(surat.alamat)],
    ];
    const colonX = left + 52;
    const valueX = colonX + 5;
    for (const [label, rowValue] of rows) {
        const labelLines = doc.splitTextToSize(label, colonX - left - 4) as string[];
        labelLines.forEach((line, index) => doc.text(line, left, y + index * bodyLineHeight));
        doc.text(":", colonX, y);
        const valueLines = doc.splitTextToSize(rowValue, right - valueX) as string[];
        valueLines.forEach((line, index) => doc.text(line, valueX, y + index * bodyLineHeight));
        y += Math.max(labelLines.length, valueLines.length) * bodyLineHeight;
    }
    y += paragraphGap;
    y = drawJustifiedParagraph(doc, "Nama tersebut tercatat sebagai penduduk/warga Kelurahan Tamansari Kecamatan Pulomerak Kota Cilegon, dan berdomisili di alamat sebagaimana yang tercantum diatas.", left, y, width, bodyLineHeight, 10) + paragraphGap;
    y = drawJustifiedParagraph(doc, "Surat Keterangan ini dibuat untuk :", left, y, width, bodyLineHeight);
    y += 1;
    doc.setFont("helvetica", "bold");
    const purposeLines = doc.splitTextToSize(`"${value(surat.keperluan)}"`, width) as string[];
    purposeLines.forEach((line, index) => doc.text(line, pageCenter, y + index * bodyLineHeight, { align: "center", maxWidth: width }));
    y += Math.max(purposeLines.length, 1) * bodyLineHeight + purposeClosingGap;
    doc.setFont("helvetica", "normal");
    const bodyEnd = drawJustifiedParagraph(doc, "Demikian Surat Keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.", left, y, width, bodyLineHeight, 10);

    const signatureX = 151;
    const { signatureDateY, signatureJobY, signatureQrY, signatureNameY, signatureNipY } = signatureBlockLayout(doc, bodyEnd, 24);
    doc.setFontSize(11);
    doc.text(`Tamansari, ${formatDate(surat.tanggal_surat)}`, signatureX, signatureDateY, { align: "center" });
    doc.text(value(surat.signer_jabatan).toUpperCase(), signatureX, signatureJobY, { align: "center" });
    doc.addImage(qr, "PNG", signatureX - 12, signatureQrY, 24, 24);
    doc.setFont("helvetica", "bold");
    doc.text(value(surat.lurah_name), signatureX, signatureNameY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`NIP. ${value(surat.signer_nip)}`, signatureX, signatureNipY, { align: "center" });

    drawAdministrativeFooter(doc);
}

function drawDomisiliPdf(doc: jsPDF, surat: SuratRow, profile: OfficialPdfProfile, qr: string) {
    const pageCenter = 105;
    const left = 22;
    const right = 188;
    const width = right - left;
    const bodyLineHeight = 5.1;
    const paragraphGap = 4.5;
    const purposeClosingGap = 5;
    const additional = surat.additional_data && typeof surat.additional_data === "object" ? surat.additional_data : {};
    const profileAddress = profile.alamat ?? "";
    const currentAddress = value(surat.alamat_sekarang ?? additional.alamat_sekarang ?? profileAddress);
    const originalAddress = value(surat.alamat_asal ?? additional.alamat_asal ?? profileAddress);

    doc.setTextColor(0, 0, 0);
    const signerName = value(surat.lurah_name);
    const signerJob = value(surat.signer_jabatan);
    const signerNip = value(surat.signer_nip);
    const logo = cilegonLogo();
    const logoHeight = 23;
    const logoProperties = doc.getImageProperties(logo);
    const logoWidth = logoHeight * (logoProperties.width / logoProperties.height);
    doc.addImage(logo, logoProperties.fileType, 23, 11.5, logoWidth, logoHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("PEMERINTAH KOTA CILEGON", pageCenter, 15, { align: "center" });
    doc.text("KECAMATAN PULOMERAK", pageCenter, 20.5, { align: "center" });
    doc.setFontSize(14);
    doc.text("KELURAHAN TAMANSARI", pageCenter, 27, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Jln. Langon Indah RT.04/06 Merak Pulomerak - Cilegon", pageCenter, 33, { align: "center" });
    doc.text("Telp : 0254570624   Email :   Website :", pageCenter, 38, { align: "center" });
    doc.setLineWidth(0.22);
    doc.line(left, 42, right, 42);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("SURAT KETERANGAN DOMISILI", pageCenter, 52, { align: "center" });
    doc.setLineWidth(0.25);
    doc.line(70, 53.3, 146, 53.3);
    doc.setFontSize(10.5);
    doc.text(`NOMOR : ${value(surat.nomor_surat)}`, pageCenter, 59, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    let y = drawJustifiedParagraph(doc, "Yang bertanda tangan dibawah ini Lurah Tamansari Kecamatan Pulomerak Kota Cilegon, menerangkan bahwa :", left, 68, width, bodyLineHeight) + paragraphGap;
    const rows: Array<[string, string]> = [
        ["NIK", value(surat.nik)],
        ["Nama Lengkap", value(surat.nama_lengkap)],
        ["Tempat/Tgl.Lahir", `${value(surat.tempat_lahir)} / ${formatDate(surat.tanggal_lahir)}`],
        ["Jenis Kelamin", value(surat.jenis_kelamin)],
        ["Agama", value(surat.agama)],
        ["Status Perkawinan", value(surat.status_perkawinan)],
        ["Pekerjaan", value(surat.status_pekerjaan)],
    ];
    const labelX = left;
    const colonX = left + 52;
    const valueX = colonX + 5;
    for (const [label, rowValue] of rows) {
        const labelLines = doc.splitTextToSize(label, colonX - labelX - 4) as string[];
        labelLines.forEach((line, index) => doc.text(line, labelX, y + index * bodyLineHeight));
        doc.text(":", colonX, y);
        const valueLines = doc.splitTextToSize(rowValue, right - valueX) as string[];
        valueLines.forEach((line, index) => doc.text(line, valueX, y + index * bodyLineHeight));
        y += Math.max(labelLines.length, valueLines.length, 1) * bodyLineHeight;
    }
    for (const [label, rowValue] of [["Alamat Asal", originalAddress], ["Alamat Tempat Tinggal Sekarang", currentAddress]] as const) {
        const labelLines = doc.splitTextToSize(label, colonX - labelX - 4) as string[];
        labelLines.forEach((line, index) => doc.text(line, labelX, y + index * bodyLineHeight));
        doc.text(":", colonX, y);
        const valueLines = doc.splitTextToSize(rowValue, right - valueX) as string[];
        valueLines.forEach((line, index) => doc.text(line, valueX, y + index * bodyLineHeight));
        y += Math.max(labelLines.length, valueLines.length, 1) * bodyLineHeight;
    }
    y += paragraphGap;
    y = drawJustifiedParagraph(doc, "Nama tersebut tercatat sebagai penduduk/ warga Kelurahan Tamansari Kecamatan Pulomerak Kota Cilegon, dan berdomisli di alamat sebagaimana yang tercantum diatas.", left, y, width, bodyLineHeight, 10) + paragraphGap;
    y = drawJustifiedParagraph(doc, "Surat Keterangan ini dibuat untuk :", left, y, width, bodyLineHeight);
    y += 1;
    doc.setFont("helvetica", "bold");
    const purposeLines = doc.splitTextToSize(`"${value(surat.keperluan ?? additional.keperluan)}"`, width) as string[];
    purposeLines.forEach((line, index) => doc.text(line, pageCenter, y + index * bodyLineHeight, { align: "center", maxWidth: width }));
    y += Math.max(purposeLines.length, 1) * bodyLineHeight + purposeClosingGap;
    doc.setFont("helvetica", "normal");
    const bodyEnd = drawJustifiedParagraph(doc, "Demikian Surat Keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.", left, y, width, bodyLineHeight, 10);

    // Master layout keeps the signer block in the right half, with QR centered
    // between the title and the signer's name rather than pushed to the edge.
    const signatureX = 151;
    const { signatureDateY, signatureJobY, signatureQrY, signatureNameY, signatureNipY } = signatureBlockLayout(doc, bodyEnd, 20);
    doc.setFontSize(11);
    doc.text(`Tamansari, ${formatDate(surat.tanggal_surat)}`, signatureX, signatureDateY, { align: "center" });
    doc.text(signerJob.toUpperCase(), signatureX, signatureJobY, { align: "center" });
    doc.addImage(qr, "PNG", signatureX - 10, signatureQrY, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(signerName, signatureX, signatureNameY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`NIP. ${signerNip}`, signatureX, signatureNipY, { align: "center" });
    drawAdministrativeFooter(doc);
}

export function renderOfficialLetterPdf(surat: SuratRow, profile: OfficialPdfProfile, qr: string, verifyUrl: string, layanan: string, template: NonNullable<ReturnType<typeof templateFromSnapshot>>) {
    const profileAddress = profile.alamat ?? "";
    assertTemplateContentSafe(template.body, template.fieldSchema ?? []);
    validateTemplateFields(template.fieldSchema ?? [], surat.additional_data ?? {}, { alamat_asal: profileAddress, alamat_sekarang: profileAddress });
    const isDomisili = /domisili/i.test(String(layanan ?? template.title ?? ""));
    const doc = createF4PortraitPdf();
    if (template.templateId === MARRIAGE_TEMPLATE_ID) drawMarriagePackage(doc, surat, qr);
    else if (isDomisili) drawDomisiliPdf(doc, surat, profile, qr);
    else drawTmsPdf(doc, surat, qr, String(layanan ?? template.title ?? "SURAT KETERANGAN"));
    return Buffer.from(doc.output("arraybuffer"));
}

export async function renderOfficialLetterPdfRoute(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("pengajuan_surat")
        .select("*,layanan(nama)")
        .eq("verification_token", token)
        .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const surat = data as SuratRow | null;
    if (!isFinalDocument(surat)) return NextResponse.json({ ok: false, error: "Surat tidak valid atau belum diterbitkan." }, { status: 404 });
    for (const [field, label] of [["agama", "agama"], ["status_perkawinan", "status perkawinan"], ["status_pekerjaan", "status pekerjaan"]] as const) {
        if (typeof surat[field] !== "string" || !surat[field]?.trim()) return NextResponse.json({ ok: false, error: `Snapshot final tidak memuat ${label} warga.` }, { status: 409 });
    }

    const verifyUrl = `${baseUrl(request)}/verifikasi/${surat.verification_code}`;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
    const layanan = Array.isArray(surat.layanan) ? surat.layanan[0]?.nama : surat.layanan?.nama;
    const template = templateFromSnapshot(surat.template_snapshot);
    if (!template) return NextResponse.json({ ok: false, error: "Snapshot template dokumen tidak tersedia." }, { status: 409 });
    if (!surat.nomor_surat || !surat.tanggal_surat || !surat.lurah_name || !surat.signer_nip || !surat.signer_jabatan || !surat.verification_code) return NextResponse.json({ ok: false, error: "Metadata dokumen final tidak lengkap." }, { status: 409 });
    const profileAddress = surat.alamat ?? "";
    try {
        assertTemplateContentSafe(template.body, template.fieldSchema ?? []);
        validateTemplateFields(template.fieldSchema ?? [], surat.additional_data ?? {}, {
            alamat_asal: profileAddress,
            alamat_sekarang: profileAddress,
        });
    } catch (validationError) {
        return NextResponse.json({ ok: false, error: validationError instanceof Error ? validationError.message : "Snapshot dokumen tidak valid." }, { status: 409 });
    }
    const isDomisili = /domisili/i.test(String(layanan ?? template.title ?? ""));
    const doc = createF4PortraitPdf();
    if (template.templateId === MARRIAGE_TEMPLATE_ID) drawMarriagePackage(doc, surat, qr);
    else if (isDomisili) {
        drawDomisiliPdf(doc, surat, { alamat: profileAddress }, qr);
    } else drawTmsPdf(doc, surat, qr, String(layanan ?? template.title ?? "SURAT KETERANGAN"));
    const bytes = Buffer.from(doc.output("arraybuffer"));
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `${disposition}; filename="surat-${surat.nomor_pengajuan}.pdf"`, "cache-control": "private, no-store, no-cache, must-revalidate", "pragma": "no-cache", "expires": "0" } });
}