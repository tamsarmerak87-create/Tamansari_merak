import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("services/warga-pengajuan.service.ts", "utf8");
const listRoute = readFileSync("app/api/warga/pengajuan/route.ts", "utf8");
const detailRoute = readFileSync("app/api/warga/pengajuan/[id]/route.ts", "utf8");
const documentRoute = readFileSync("app/api/warga/dokumen/[id]/route.ts", "utf8");
const officialPdf = readFileSync("services/official-letter-pdf.ts", "utf8");
const documentsPage = readFileSync("app/dashboard/dokumen/page.tsx", "utf8");
const detailPage = readFileSync("app/dashboard/pengajuan/[id]/page.tsx", "utf8");
const submissionService = readFileSync("services/surat-online.service.ts", "utf8");
const storageHelper = readFileSync("services/submission-storage.ts", "utf8");
const adminDataRoute = readFileSync("app/api/admin/data/route.ts", "utf8");
const petugasDataRoute = readFileSync("app/api/petugas/data/route.ts", "utf8");
const petugasPortal = readFileSync("components/petugas/petugas-portal.tsx", "utf8");

test("Dokumen Saya filters service results using existing status and metadata", () => {
    assert.match(service, /filter\(isWargaUploadedDocument\)/);
    assert.match(service, /metadata\.source/);
    assert.match(service, /metadata\.origin/);
    assert.match(service, /generated_by/);
    assert.match(service, /SIAP_DIVERIFIKASI/);
    assert.match(service, /TERBIT/);
    assert.match(service, /HASIL_PELAYANAN/);
    assert.doesNotMatch(service, /filename\.includes/i);
});

test("pengelolaan dokumen memvalidasi session, kepemilikan NIK, dan kategori di backend", () => {
    assert.match(documentRoute, /auth\.getUser\(token\)/);
    assert.match(documentRoute, /submission\.nik !== profileResult\.data\.nik/);
    assert.match(documentRoute, /getDocumentManagementPolicy\(document as DokumenPengajuan\) !== "MANAGEABLE"/);
    assert.match(documentRoute, /Dokumen ini terkunci/);
});

test("1. KTP dikunci berdasarkan metadata atau jenis, bukan filename", () => {
    assert.match(service, /metadata\.document_type, metadata\.category, metadata\.identity_type/);
    assert.match(service, /"KTP"/);
    assert.match(service, /"LOCKED_IDENTITY"/);
});

test("2. KK dikunci berdasarkan metadata atau jenis", () => {
    assert.match(service, /"KK", "KARTU_KELUARGA"/);
    assert.match(documentRoute, /getDocumentManagementPolicy\(document as DokumenPengajuan\) !== "MANAGEABLE"/);
});

test("3. Buku Nikah memakai fallback MANAGEABLE", () => {
    assert.match(service, /: "MANAGEABLE"/);
    assert.doesNotMatch(service, /BUKU_NIKAH.*LOCKED_IDENTITY/);
});

test("4. Sertifikat Tanah memakai fallback MANAGEABLE", () => {
    assert.match(documentsPage, /getDocumentManagementPolicy\(doc\) === "MANAGEABLE"/);
    assert.doesNotMatch(service, /SERTIFIKAT_TANAH.*LOCKED_IDENTITY/);
});

test("5. hasil pelayanan immutable dan dikecualikan dari Dokumen Saya", () => {
    assert.match(service, /if \(isServiceResultDocument\(doc\)\) return "SERVICE_RESULT"/);
    assert.match(service, /filter\(isWargaUploadedDocument\)/);
});

test("6. ownership isolation menolak dokumen milik NIK lain", () => {
    assert.match(documentRoute, /submission\.nik !== profileResult\.data\.nik/);
    assert.match(documentRoute, /Dokumen bukan milik akun ini\.\", 403/);
});

test("7. rename hanya menargetkan dokumen tervalidasi", () => {
    assert.match(documentRoute, /\.update\(\{ metadata \}\)\.eq\("id", id\)\.eq\("pengajuan_id", owned\.document\.pengajuan_id\)/);
    assert.match(documentRoute, /action !== "rename"/);
});

test("8. upload ulang memperbarui row yang sama tanpa membuat duplicate", () => {
    assert.match(documentRoute, /export async function POST/);
    assert.match(documentRoute, /\.update\(\{ url_file: uploaded\.data\.path, metadata \}\)/);
    assert.doesNotMatch(documentRoute, /from\("dokumen_pengajuan"\)\.insert/);
});

test("9. delete hanya menargetkan dokumen tervalidasi", () => {
    assert.match(documentRoute, /\.delete\(\)\.eq\("id", id\)\.eq\("pengajuan_id", owned\.document\.pengajuan_id\)/);
});

test("10. file invalid dan file lebih dari 1 MB ditolak", () => {
    assert.match(documentRoute, /MAX_FILE_SIZE = 1024 \* 1024/);
    assert.match(documentRoute, /ALLOWED_TYPES/);
    assert.match(documentRoute, /if \(!ALLOWED_TYPES\.has\(file\.type\)\)/);
});

test("revision uploads are persisted with explicit warga metadata", () => {
    assert.match(detailRoute, /status: "UPLOADED"/);
    assert.match(detailRoute, /source: "WARGA"/);
    assert.match(detailRoute, /document_type: "UPLOAD_WARGA"/);
});

test("warga APIs scope submissions to the authenticated warga identity", () => {
    assert.match(listRoute, /getUser\(token\)/);
    assert.match(listRoute, /\.eq\("nik", warga\.nik\)/);
    assert.match(detailRoute, /pengajuan\.nik !== warga\.nik/);
});

test("Berkas Pengajuan API retains result documents and final PDF links", () => {
    assert.match(listRoute, /dokumen_pengajuan:/);
    assert.match(listRoute, /isServiceResultDocument\(doc\)/);
    assert.match(listRoute, /final_pdf_url/);
    assert.match(detailRoute, /isServiceResultDocument\(doc\)/);
});

test("Dokumen Saya has loading, error, empty, preview, and download states", () => {
    for (const text of ["Memuat dokumen...", "Dokumen gagal dimuat.", "Belum Ada Dokumen", "Lihat", "Download"]) {
        assert.match(documentsPage, new RegExp(text.replace(".", "\\.")));
    }
});

test("bucket canonical dokumen pengajuan digunakan untuk upload, view, download, dan admin", () => {
    assert.match(storageHelper, /SUBMISSION_DOCUMENT_BUCKET = "surat"/);
    assert.match(submissionService, /storage\.from\(SUBMISSION_STORAGE_BUCKET\)\.upload/);
    assert.match(documentRoute, /storage\.from\(BUCKET\)\.download\(path\)/);
    assert.match(documentRoute, /request\.nextUrl\.searchParams\.get\("download"\) === "1" \? "attachment" : "inline"/);
    assert.match(adminDataRoute, /storage\.from\(SUBMISSION_DOCUMENT_BUCKET\)\.createSignedUrl/);
    assert.match(petugasDataRoute, /storage\.from\(SUBMISSION_DOCUMENT_BUCKET\)\.createSignedUrl/);
});

test("caller warga mengakses route berdasarkan ID dan tidak membuat public URL bucket private", () => {
    assert.match(service, /api\/warga\/dokumen\/\$\{encodeURIComponent\(id\)\}/);
    assert.match(service, /new URL\(getWargaDokumenUrl\(id, download\), window\.location\.origin\)\.href/);
    assert.match(service, /authorization: `Bearer \$\{token\}`/);
    assert.match(service, /credentials: "same-origin"/);
    assert.match(service, /\[WARGA DOCUMENT FETCH STATUS\]/);
    assert.doesNotMatch(service, /console\.(?:log|info|error)\([^\n]*token/);
    assert.match(detailPage, /accessWargaDokumen\(documentId, download, \"final-letter\"\)/);
    assert.match(documentsPage, /accessWargaDokumen\(doc\.id!, download, \"supporting\"\)/);
    assert.doesNotMatch(service, /storage\.from\(DOKUMEN_BUCKET\)\.getPublicUrl/);
});

test("route warga merender surat final secara internal tanpa redirect browser ke origin proxy", () => {
    assert.match(documentRoute, /renderOfficialLetterPdfRoute\(request/);
    assert.match(documentRoute, /submission\.nik !== profile\.data\.nik/);
    assert.match(documentRoute, /isServiceResultDocument\(document as DokumenPengajuan\) && isFinalDocument\(submission\)/);
    assert.match(documentRoute, /submission\.verification_token/);
    assert.doesNotMatch(documentRoute, /isIssuedLetter.*document\.status/);
    assert.doesNotMatch(documentRoute, /NextResponse\.redirect\(new URL\(`\/api\/surat/);
});

test("surat final tidak mempercayai URL storage dan selalu PDF", () => {
    assert.match(documentRoute, /renderOfficialLetterPdfRoute\(request, \{ params: Promise\.resolve\(\{ token: submission\.verification_token \}\) \}\)/);
    assert.match(documentRoute, /isServiceResultDocument\(document as DokumenPengajuan\) && isFinalDocument\(submission\)/);
    assert.match(officialPdf, /\"content-type\": \"application\/pdf\"/i);
    assert.doesNotMatch(documentRoute, /if \(isIssuedLetter && submission\.verification_token\)/);
});

test("renderer PDF tidak gagal ketika footer tepat di batas aman karena floating-point drift", () => {
    assert.match(officialPdf, /const FOOTER_BOUNDARY_TOLERANCE_MM = 0\.01/);
    assert.match(officialPdf, /footerSafeEndY \+ FOOTER_BOUNDARY_TOLERANCE_MM/);
    assert.match(officialPdf, /Footer surat melewati batas aman F4/);
});

test("dokumen pendukung JPEG atau PNG valid secara context-aware", () => {
    assert.match(service, /WargaDocumentType = \"final-letter\" \| \"supporting\"/);
    assert.match(service, /normalizedType === \"image\/jpeg\"/);
    assert.match(service, /normalizedType === \"image\/png\"/);
    assert.match(service, /expectedPdf = documentType === \"final-letter\"/);
    assert.match(documentsPage, /accessWargaDokumen\(doc\.id!, download, \"supporting\"\)/);
    assert.match(documentRoute, /isServiceResultDocument\(document as DokumenPengajuan\) && isFinalDocument\(submission\)/);
});

test("preview surat tetap memerlukan PDF, authorization, dan blob URL", () => {
    assert.match(service, /expectedPdf && normalizedType !== \"application\/pdf\"/);
    assert.match(service, /authorization: `Bearer \$\{token\}`/);
    assert.match(service, /credentials: \"same-origin\"/);
    assert.match(service, /URL\.createObjectURL\(blob\)/);
    assert.doesNotMatch(service, /access_token.*URL|URL.*access_token|service_role/i);
});

test("viewer petugas menentukan tipe file dari metadata, bukan ekstensi signed URL", () => {
    assert.match(petugasPortal, /metadata\?\.mime_type/);
    assert.match(petugasPortal, /isPdf\(doc\)/);
    assert.match(petugasPortal, /isImage\(doc\)/);
});

test("NoSuchBucket dan file unavailable tidak bocor sebagai raw error", () => {
    assert.match(storageHelper, /Dokumen belum dapat diakses\. Silakan hubungi administrator\./);
    assert.match(storageHelper, /operation,[\s\S]*bucket: SUBMISSION_DOCUMENT_BUCKET,[\s\S]*code:/);
    assert.doesNotMatch(storageHelper, /access_token|password|nik|nomor_kk/i);
    assert.match(documentRoute, /logSubmissionStorageError/);
    assert.doesNotMatch(documentRoute, /storageError\.message/);
});