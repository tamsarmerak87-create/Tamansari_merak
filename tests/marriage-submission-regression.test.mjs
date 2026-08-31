import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const ui = readFileSync(new URL("components/pengajuan/marriage-submission-form.tsx", root), "utf8");
const domain = readFileSync(new URL("services/marriage-submission.ts", root), "utf8");
const service = readFileSync(new URL("services/surat-online.service.ts", root), "utf8");
const route = readFileSync(new URL("app/api/surat-online/pengajuan/route.ts", root), "utf8");
const pdf = readFileSync(new URL("services/official-letter-pdf.ts", root), "utf8");
const trust = readFileSync(new URL("services/submission-trust.ts", root), "utf8");
const compressor = readFileSync(new URL("services/warga-file-compress.ts", root), "utf8");
const { getMarriageDayName } = await import(new URL("services/marriage-submission.ts", root));

test("identitas dan identifier Pengantar Nikah authoritative", () => {
  assert.match(domain, /76d94250-77ba-4dca-8d98-032f0bc8bf8e/);
  assert.match(domain, /TAMSAR_PENGANTAR_NIKAH_V1/);
  assert.match(ui, /profile\.nik/); assert.match(service, /warga_profiles/);
  assert.match(service, /nik: profile\.nik/); assert.match(service, /agama: profile\.agama/);
});
test("struktur nested additional_data memisahkan nikah pasangan orang tua wali dan pernyataan", () => {
  for (const key of ["nikah", "pasangan", "orang_tua", "wali", "dokumen", "pernyataan", "tanda_tangan", "meterai"]) assert.match(domain, new RegExp(key));
  assert.match(service, /validateMarriageAdditionalData/); assert.doesNotMatch(ui, /alamat_sekarang/);
});
test("stepper khusus delapan tahap, review read-only, dan endpoint existing", () => {
  assert.match(domain, /Data Pemohon.*Data Pernikahan.*Data Pasangan.*Data Orang Tua \/ Wali/s);
  assert.match(ui, /REVIEW PENGAJUAN/); assert.match(ui, /createSubmission/); assert.match(ui, /router\.push\("\/dashboard\/pengajuan"\)/);
});

test("review Pengantar Nikah menampilkan data aktual dalam card responsif tanpa mengubah workflow", () => {
  for (const label of ["DATA PEMOHON", "DATA PERNIKAHAN", "Hari akad", "CALON PASANGAN", "AYAH", "IBU", "WALI", "DOKUMEN PENDUKUNG", "PERNYATAAN WARGA", "TANDA TANGAN", "METERAI", "CHECKLIST PENGAJUAN", "PENTING"]) assert.match(ui, new RegExp(label));
  assert.match(ui, /berkas\.map\(x=>/); assert.match(ui, /x\.file\?`tersedia/);
  assert.match(ui, /BELUM DITANDATANGANI/); assert.match(ui, /BELUM DIGUNAKAN/);
  for (const step of [1, 2, 3, 4, 5, 6]) assert.match(ui, new RegExp(`step=\\{${step}\\}`));
  assert.match(ui, /overflow-x-hidden/); assert.match(ui, /lg:grid-cols-2/); assert.match(ui, /break-words/);
  assert.match(ui, /step<8&&<Button[^>]+onClick=\{\(\)=>valid\(step\)&&setStep\(step\+1\)\}/);
  assert.match(ui, /YA, AJUKAN/); assert.match(ui, /router\.push\("\/dashboard\/pengajuan"\)/);
  assert.equal((ui.match(/const additional=validateMarriageAdditionalData/g) || []).length, 1);
});
test("paket N1 N2 N4 N5, N3 conditional dan renderer authoritative F4", () => {
  for (const model of ["Model N1", "Model N2", "Model N4", "Model N5"]) assert.match(pdf, new RegExp(model));
  assert.match(pdf, /data\.paket_dokumen\.n3/); assert.match(pdf, /F4_WIDTH_MM/); assert.match(pdf, /drawAdministrativeFooter/);
});
test("provider warga dan meterai fail closed", () => {
  assert.match(ui, /BELUM DITANDATANGANI/); assert.match(ui, /BELUM DIGUNAKAN/);
  assert.match(ui, /Status Meterai|e-Meterai/);
  assert.match(trust, /ElectronicSignatureProvider/); assert.match(trust, /ElectronicMateraiProvider/);
});

test("hari akad otomatis dihitung dari tanggal akad tanpa input manual", () => {
  assert.deepEqual(
    ["2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15"].map(getMarriageDayName),
    ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  );
  assert.equal(getMarriageDayName(""), "");
  assert.match(domain, /export function getMarriageDayName/);
  assert.match(domain, /new Date\(Number\(year\), Number\(month\) - 1, Number\(day\)\)/);
  assert.match(ui, /getMarriageDayName\(v\)/);
  assert.match(ui, /readOnly aria-readonly="true"/);
  assert.match(ui, /Hari akad otomatis menyesuaikan tanggal yang dipilih/);
  assert.doesNotMatch(ui, /setN\("hari_akad"\)/);
  assert.match(domain, /hari_akad: required\(getMarriageDayName\(nikah\.tanggal_akad\)/);
});

test("validasi navigasi dipisahkan berdasarkan step", () => {
  assert.match(domain, /export function validateMarriageStep/);
  assert.match(domain, /if \(step === 2\)/);
  assert.match(domain, /if \(step === 3\) \{ validatePerson\(root\.pasangan\); return; \}/);
  assert.match(ui, /validateMarriageStep\(raw\(\),s\)/);
  assert.doesNotMatch(ui, /if\(s>=2&&s<=4\)validateMarriageAdditionalData\(raw\(\)\)/);
});

test("dokumen Pengantar Nikah memakai kamera, preprocessing maksimal 1 MB, dan upload existing", () => {
  assert.match(compressor, /MAX_WARGA_FILE_SIZE = 1024 \* 1024/);
  assert.match(compressor, /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/);
  assert.match(compressor, /URL\.revokeObjectURL\(url\)/);
  assert.match(ui, /capture="environment"/);
  assert.match(ui, /AMBIL FOTO/); assert.match(ui, /PILIH FILE/);
  assert.match(ui, /application\/pdf,image\/jpeg,image\/jpg,image\/png,image\/webp/);
  assert.match(ui, /processed\.size>MAX_WARGA_FILE_SIZE/);
  assert.match(ui, /uploadSubmissionAttachment\("pendukung"/);
  assert.match(service, /SUBMISSION_DOCUMENT_BUCKET/); assert.match(service, /compressWargaFile\(file\)/);
  assert.match(ui, /Ukuran PDF maksimal 1 MB/);
  assert.match(domain, /Data Pemohon.*Data Pernikahan.*Data Pasangan.*Data Orang Tua \/ Wali.*Dokumen Pendukung.*Pernyataan/s);
  assert.doesNotMatch(ui, /access_token|session_token|JWT/);
});

test("error submit client mempertahankan status dan body API tanpa membocorkan kredensial", () => {
  assert.match(service, /fetch\("\/api\/surat-online\/pengajuan"/);
  assert.match(service, /const responseText = await response\.text\(\)/);
  assert.match(service, /submitError\.httpStatus = response\.status/);
  assert.match(service, /submitError\.httpStatusText = response\.statusText/);
  assert.match(service, /submitError\.responseBody = responseText/);
  assert.match(service, /resultError/);
  assert.match(service, /resultMessage/);
  assert.match(service, /submitError\.validationError = result\?\.validationError \?\? result\?\.details/);
  const diagnosticBlock = service.match(/console\.error\(\s*"SURAT ONLINE CLIENT SUBMIT ERROR[\s\S]*?\);/)?.[0] ?? "";
  assert.ok(diagnosticBlock);
  assert.match(diagnosticBlock, /HTTP_STATUS=|HTTP_STATUS_TEXT=|RESPONSE_BODY=|RESULT_ERROR=|RESULT_MESSAGE=|VALIDATION_ERROR=|ERROR_NAME=|ERROR_MESSAGE=/);
  assert.doesNotMatch(diagnosticBlock, /accessToken|authorization|password|service.role|refresh.token|verification.token/i);
});

test("submit nikah tetap membuat pengajuan baru dan tidak mengirim identifier memory atau dokumen lama", () => {
  const payload = ui.match(/const payload=\{[\s\S]*?consent:true\}/)?.[0] ?? "";
  assert.ok(payload);
  assert.match(payload, /layanan_id:MARRIAGE_SERVICE_ID/);
  assert.match(payload, /nik:profile\.nik/);
  assert.match(payload, /agama:profile\.agama/);
  assert.match(payload, /additional_data:additional/);
  assert.match(payload, /consent:true/);
  assert.doesNotMatch(payload, /pengajuan_id|verification|signed_url|provider_evidence|memory|draft/i);
  assert.match(ui, /await createSubmission\(payload\)/);
});

test("NIK top-level Pengantar Nikah hanya berasal dari profile authoritative dan fail closed", () => {
  const submit = ui.match(/async function submit\(\)\{[\s\S]*?finally\{setBusy\(false\)\}\}/)?.[0] ?? "";
  const payload = submit.match(/const payload=\{[\s\S]*?consent:true\}/)?.[0] ?? "";
  assert.ok(submit); assert.ok(payload);
  assert.match(payload, /nik:profile\.nik/);
  assert.doesNotMatch(payload, /nik:(?:memory|user\.id|profile\.email|form\.)/);
  assert.match(submit, /if\(!user\|\|!profile\?\.nik\)/);
  assert.match(submit, /Data NIK belum tersedia pada profil\. Silakan lengkapi profil terlebih dahulu\./);
  assert.match(submit, /router\.push\("\/dashboard\/profil"\)/);
  assert.match(submit, /if\(!\/\^\\d\{16\}\$\/\.test\(profile\.nik\)\)/);
  assert.doesNotMatch(submit, /DEBUG-NIK|NIK-TRACE|console\.(?:debug|info|log|error)\([^\n]*profile\.nik/);
  assert.doesNotMatch(ui, /<input[^>]*(?:name|id)=["']nik["']/);
});

test("backend menerima compatibility NIK lalu override canonical profile sebelum insert", () => {
  assert.match(service, /nik: getValue\("nik"\)/);
  assert.match(service, /const source = formData;/);
  assert.match(service, /const value = source\[key\];/);
  assert.doesNotMatch(`${route}\n${service}`, /DEBUG-NIK|NIK-TRACE|TRACE-SUBMIT/);
  assert.match(service, /\.eq\("id", authenticatedUserId\)/);
  assert.match(service, /payload = submissionSchema\.parse\(\{[\s\S]*?nik: profile\.nik/);
  assert.match(service, /nik: z\.string\(\)\.regex\(\/\^\\d\{16\}\$\//);
});