import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const verificationRoute = readFileSync("app/api/petugas/pengajuan/[id]/verifikasi/route.ts", "utf8");
const finalizationRoute = readFileSync("services/official-letter-finalization.ts", "utf8");
const pdfRenderer = readFileSync("services/official-letter-pdf.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260820020000_enforce_unique_official_letter_number.sql", "utf8");
const snapshotMigration = readFileSync("supabase/migrations/20260826100000_add_legal_identity_snapshot_to_pengajuan_surat.sql", "utf8");
const publicVerification = readFileSync("app/verifikasi/[token]/page.tsx", "utf8");
const verificationApi = readFileSync("app/api/verifikasi/[code]/route.ts", "utf8");
const officialDocument = readFileSync("services/official-document.ts", "utf8");
const pdfRoute = readFileSync("app/api/surat/[token]/pdf/route.ts", "utf8");

test("general verification cannot complete Lurah stage 5", () => {
    assert.match(verificationRoute, /activeStage\.tahap === 5 && !isReject/);
    assert.match(verificationRoute, /finalisasi Lurah hanya dapat dilakukan melalui endpoint surat-ttd/);
});

test("Lurah finalization is restricted to surat-ttd and server allocator", () => {
    assert.match(finalizationRoute, /workflowRole !== "lurah"/);
    assert.match(finalizationRoute, /claim_official_letter_finalization/);
    assert.doesNotMatch(finalizationRoute, /rpc\("allocate_official_letter_number"/);
});

test("client-supplied official number is rejected", () => {
    assert.match(finalizationRoute, /hasOwnProperty\.call\(body, "nomor_surat"\)/);
    assert.match(finalizationRoute, /Nomor surat final hanya dapat dialokasikan oleh server/);
});

test("migration fails closed on duplicates and adds a unique index", () => {
    assert.match(migration, /having count\(\*\) > 1/i);
    assert.match(migration, /raise exception 'Duplicate nomor_surat ditemukan/);
    assert.match(migration, /create unique index if not exists pengajuan_surat_nomor_surat_uidx/i);
    assert.doesNotMatch(migration, /\b(delete|drop table|truncate)\b/i);
});

test("duplicate or locked approval cannot allocate a second number", () => {
    assert.match(migration, /for update/);
    assert.match(migration, /if v_locked or v_issued_at is not null/);
    assert.match(migration, /v_existing_number/);
    assert.match(finalizationRoute, /document_locked\) return jsonError\("Dokumen sudah final dan terkunci\.", 409\)/);
});

test("unhandled finalizer exception is logged server-side with the submission id", () => {
    assert.match(finalizationRoute, /\.catch\(\(error: unknown\) =>/);
    assert.match(finalizationRoute, /\[FINALIZE UNHANDLED ERROR\]/);
    assert.match(finalizationRoute, /pengajuanId: options\.id/);
    assert.match(finalizationRoute, /name: error\.name, message: error\.message, stack: error\.stack/);
    assert.match(finalizationRoute, /name: typeof error, message: String\(error\), stack: undefined/);
    assert.match(finalizationRoute, /Finalisasi surat gagal karena kesalahan server\./);
});

test("finalizer logs safe operation steps before QR generation", () => {
    for (const step of ["LOAD_SERVICE", "LOAD_TEMPLATE", "CREATE_DRAFT", "LOAD_PROFILE", "VALIDATE_TEMPLATE", "CLAIM_NUMBER"]) {
        assert.match(finalizationRoute, new RegExp(`logFinalizeStep\\("${step}"\\)`));
    }
    assert.match(finalizationRoute, /logFinalizeStep\("CLAIM_NUMBER"\)[\s\S]*?claim_official_letter_finalization/);
    assert.match(finalizationRoute, /logFinalizeStep\("LOAD_PROFILE"\)[\s\S]*?\.from\("warga_profiles"\)/);
});

test("QR payload contains only the verification URL with random token", () => {
    assert.match(finalizationRoute, /const token = randomUUID\(\)/);
    assert.match(finalizationRoute, /process\.env\.NEXT_PUBLIC_SITE_URL \?\? request\.nextUrl\.origin/);
    assert.doesNotMatch(finalizationRoute, /NEXT_PUBLIC_SITE_URL \?\? origin/);
    assert.match(finalizationRoute, /verificationUrl = `\$\{site\}\/verifikasi\/\$\{code\}`/);
    assert.match(finalizationRoute, /QRCode\.toBuffer\(verificationUrl/);
    assert.doesNotMatch(finalizationRoute, /QRCode\.toBuffer\([^\n]*(nik|nomor_kk|alamat|nama_lengkap)/i);
});

test("public verification uses the stored unpredictable code and authoritative PDF token", () => {
    assert.match(officialDocument, /token\.replace\(\/-\/g, ""\)\.toUpperCase\(\)/);
    assert.match(publicVerification, /\.eq\("verification_code", code\.toUpperCase\(\)\)/);
    assert.match(publicVerification, /\/api\/surat\/\$\{pdfToken\}\/pdf/);
    assert.match(pdfRenderer, /\/verifikasi\/\$\{surat\.verification_code\}/);
    assert.doesNotMatch(publicVerification, /\bnik\b/i);
});

test("renderer authoritative memakai F4 dan footer ditambatkan ke tinggi halaman", () => {
    assert.match(pdfRoute, /renderOfficialLetterPdfRoute\(request, context\)/);
    assert.match(pdfRenderer, /const F4_WIDTH_MM = 215/);
    assert.match(pdfRenderer, /const F4_HEIGHT_MM = 330/);
    assert.match(pdfRenderer, /format: \[F4_WIDTH_MM, F4_HEIGHT_MM\]/);
    assert.match(pdfRenderer, /pageHeight - FOOTER_BOTTOM_MARGIN_MM - footerContentHeight/);
    assert.match(pdfRenderer, /footerSafeEndY: pageHeight - FOOTER_BOTTOM_MARGIN_MM/);
    assert.doesNotMatch(pdfRenderer, /footerLineY = signatureEndY/);
    assert.doesNotMatch(pdfRenderer, /format: ["']a4["']|format: \[210, 330\]/i);
});

test("blok tanda tangan memakai satu anchor vertikal dan tetap aman dari footer", () => {
    assert.match(pdfRenderer, /const signatureBlockY = bodyEnd \+ SIGNATURE_BODY_GAP_MM/);
    assert.match(pdfRenderer, /const signatureDateY = signatureBlockY/);
    assert.match(pdfRenderer, /const signatureJobY = signatureDateY \+ SIGNATURE_JOB_OFFSET_MM/);
    assert.match(pdfRenderer, /const signatureQrY = signatureBlockY \+ SIGNATURE_QR_OFFSET_MM/);
    assert.match(pdfRenderer, /const signatureNameY = signatureQrY \+ qrHeight \+ SIGNATURE_NAME_GAP_MM/);
    assert.match(pdfRenderer, /const signatureNipY = signatureNameY \+ SIGNATURE_NIP_GAP_MM/);
    assert.match(pdfRenderer, /const signatureSafeEndY = footerLineY - SIGNATURE_FOOTER_GAP_MM/);
    assert.match(pdfRenderer, /if \(signatureEndY > signatureSafeEndY\)/);
    assert.doesNotMatch(pdfRenderer, /signatureBlockY\s*=\s*footer/);
    assert.equal(pdfRenderer.match(/signatureBlockLayout\(doc, bodyEnd, (?:24|20)\)/g)?.length, 2);
});

test("Domisili dan seluruh layanan tetap memakai satu renderer dan footer bersama", () => {
    assert.match(pdfRenderer, /const isDomisili = \/domisili\/i/);
    assert.match(pdfRenderer, /if \(isDomisili\) drawDomisiliPdf[\s\S]*else drawTmsPdf/);
  assert.ok((pdfRenderer.match(/drawAdministrativeFooter\(doc\)/g) || []).length >= 2);
    assert.equal(pdfRenderer.match(/bottomAnchoredFooter\(pageHeight,/g)?.length, 1);
    assert.match(finalizationRoute, /renderOfficialLetterPdf\(finalValues/);
});

test("footer administratif lebar, rapat, sejajar, dan memakai logo proporsional", () => {
    assert.match(pdfRenderer, /const FOOTER_X_MM = 10/);
    assert.match(pdfRenderer, /const FOOTER_RIGHT_MM = 205/);
    assert.match(pdfRenderer, /const FOOTER_FONT_SIZE_PT = 6\.5/);
    assert.match(pdfRenderer, /const FOOTER_LINE_HEIGHT_MM = 3/);
    assert.match(pdfRenderer, /const FOOTER_NUMBER_INDENT_MM = 5/);
    assert.match(pdfRenderer, /doc\.text\(`\$\{index \+ 1\}\.`, numberX, noteY\)/);
    assert.match(pdfRenderer, /doc\.text\(line, textX, noteY \+ lineIndex \* FOOTER_LINE_HEIGHT_MM\)/);
    assert.match(pdfRenderer, /doc\.line\(FOOTER_X_MM, footerLineY, FOOTER_RIGHT_MM, footerLineY\)/);
    assert.match(pdfRenderer, /const BSRE_LOGO_WIDTH_MM = 28/);
    assert.match(pdfRenderer, /const BSRE_LOGO_HEIGHT_MM = 10\.5/);
    assert.match(pdfRenderer, /const logoX = FOOTER_RIGHT_MM - BSRE_LOGO_WIDTH_MM/);
});

test("verification API fails closed without exposing NIK or PDF token", () => {
    assert.match(verificationApi, /status: "INVALID"/);
    assert.match(verificationApi, /status: "INACTIVE"/);
    assert.match(verificationApi, /status: "VALID"/);
    assert.doesNotMatch(verificationApi, /\.select\([^\n]*\bnik\b/i);
    assert.match(verificationApi, /verification_token: undefined/);
});

test("finalizer and PDF renderer request only deployed warga_profiles columns", () => {
    const legalColumns = "nik,nomor_kk,nama_lengkap,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,alamat,rt,rw,kelurahan,kecamatan,status_verifikasi,tahap_verifikasi";
    assert.match(finalizationRoute, new RegExp(`\\.select\\("${legalColumns}"\\)`));
    for (const field of ["agama", "status_perkawinan", "status_pekerjaan"]) assert.match(finalizationRoute, new RegExp(`\\b${field}\\b`));
    assert.match(finalizationRoute, /\.eq\("status_verifikasi", "Terverifikasi"\)/);
    assert.doesNotMatch(pdfRenderer, /\.from\("warga_profiles"\)/);
    assert.doesNotMatch(pdfRenderer, /\.from\("warga_profiles"\)/);
    assert.match(finalizationRoute, /agama: wargaProfile\.agama/);
    assert.doesNotMatch(finalizationRoute, /(?:agama|status_perkawinan|status_pekerjaan):\s*pengajuan/);
    assert.match(finalizationRoute, /keperluan: submissionIdentity\.keperluan,[\s\S]*?additional_data: validatedAdditionalData/);
    const updatePayload = finalizationRoute.match(/const update = \{[\s\S]*?\.update\(update\)/)?.[0] ?? "";
    assert.ok(updatePayload);
    assert.doesNotMatch(updatePayload, /\.\.\.submissionIdentity/);
    assert.match(finalizationRoute, /const profileLegalIdentity = \{[\s\S]*status_pekerjaan: wargaProfile\.status_pekerjaan/);
    assert.match(updatePayload, /\.\.\.profileLegalIdentity/);
    assert.match(pdfRenderer, /\["Agama", value\(surat\.agama\)\]/);
    assert.doesNotMatch(pdfRenderer, /surat\.additional_data\?\.status_(?:perkawinan|pekerjaan)/);
});

test("legal identity snapshot schema is idempotent and finalization fails clearly for missing profile values", () => {
    for (const field of ["agama", "status_perkawinan", "status_pekerjaan"]) {
        assert.match(snapshotMigration, new RegExp(`add column if not exists ${field} text`));
        assert.match(finalizationRoute, new RegExp(`Data ${field.replace("_", " ")} pada profil warga belum tersedia`));
    }
    assert.doesNotMatch(snapshotMigration, /\b(drop|delete|truncate)\b/i);
    assert.match(finalizationRoute, /\.from\("pengajuan_surat"\)\.update\(update\)/);
    assert.match(pdfRenderer, /status_pekerjaan\?: string \| null/);
    assert.doesNotMatch(`${finalizationRoute}\n${pdfRenderer}`, /user_metadata|app_metadata|Tidak dicantumkan/);
});
