import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const helperSource = readFileSync(new URL("services/submission-memory.ts", root), "utf8");
const ui = readFileSync(new URL("components/pengajuan/marriage-submission-form.tsx", root), "utf8");
const api = readFileSync(new URL("app/api/warga/pengajuan/route.ts", root), "utf8");

test("draft memiliki namespace user dan service, versi, debounce, step, expiry 30 hari", () => {
  assert.match(helperSource, /submission-draft.*userId.*serviceId/s);
  assert.match(helperSource, /SUBMISSION_DRAFT_VERSION = 1/);
  assert.match(helperSource, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(ui, /window\.setTimeout\([\s\S]*600/);
  assert.match(ui, /createSubmissionDraft\(step/);
});

test("draft invalid atau expired dibersihkan tanpa crash", () => {
  assert.match(helperSource, /try \{/);
  assert.match(helperSource, /Date\.parse\(value\.expiresAt\) <= now\.getTime\(\)/);
  assert.match(helperSource, /catch \{[\s\S]*storage\.removeItem\(key\);[\s\S]*return null/);
});

test("file hanya metadata dan harus upload ulang", () => {
  assert.match(helperSource, /nama_file\?: string; ukuran\?: number; status: "PERLU_UPLOAD_ULANG"/);
  assert.doesNotMatch(helperSource, /base64|blob:|storage path|signed URL/i);
  assert.match(ui, /Dokumen sebelumnya belum tersedia di sesi ini\. Silakan upload kembali\./);
});

test("submitted memory ownership dan service-bound memakai endpoint existing", () => {
  assert.match(api, /getValidatedWarga\(request\)/);
  assert.match(api, /\.eq\("nik", warga\.nik\)\.eq\("layanan_id", memoryServiceId\)/);
  assert.match(api, /MEMORY_COLUMNS = "id,layanan_id,keperluan,additional_data,created_at"/);
  assert.doesNotMatch(api.match(/const MEMORY_COLUMNS[^\n]+/)?.[0] ?? "", /verification|file_|token|qr|signature|meterai/i);
});

test("memory memerlukan pilihan, sekali diterapkan, tanggal lama dibuang dan hari dihitung ulang", () => {
  assert.match(ui, /GUNAKAN DATA SEBELUMNYA/);
  assert.match(ui, /MULAI DENGAN DATA KOSONG/);
  assert.match(ui, /function useMemory\(\)[\s\S]*tanggal_akad:"",hari_akad:""/);
  assert.match(ui, /setMemory\(null\)/);
  assert.match(ui, /hari_akad:getMarriageDayName\(n\.tanggal_akad\)/);
});

test("profile tidak disimpan dalam draft dan tetap canonical pada submit", () => {
  const draftCall = ui.match(/createSubmissionDraft\(step,[\s\S]*?\)\);setSaveState/)?.[0] ?? "";
  assert.doesNotMatch(draftCall, /profile/);
  assert.match(ui, /nik:profile\.nik/);
  assert.match(ui, /nama_lengkap:profile\.nama_lengkap/);
});

test("submit sukses menghapus draft setelah server resolve, gagal mempertahankannya", () => {
  assert.match(ui, /await createSubmission\([\s\S]*?\);if\(draftKey\)localStorage\.removeItem\(draftKey\);alert/);
  const catchBlock = ui.match(/catch\(e\)\{setError[^}]+\}/)?.[0] ?? "";
  assert.doesNotMatch(catchBlock, /removeItem/);
  assert.match(ui, /router\.push\("\/dashboard\/pengajuan"\)/);
});

test("submitted memory tidak mengembalikan dokumen atau bukti keamanan lama", () => {
  const memoryResponse = api.match(/return NextResponse\.json\(\{ ok: true, data: row \?[\s\S]*?: null \}\);/)?.[0] ?? "";
  assert.doesNotMatch(memoryResponse, /path|verification_token|verification_code|verification_url|provider_evidence|transaction|receipt|qr|tte|meterai/i);
  assert.match(memoryResponse, /dokumen_pernah_digunakan/);
});