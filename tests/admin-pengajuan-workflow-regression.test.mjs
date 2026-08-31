import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const api = read("app/api/admin/pengajuan/route.ts");
const shell = read("components/admin/admin-shell.tsx");
const suratResolver = read("app/api/admin/pengajuan/[id]/surat/route.ts");
const verifyResolver = read("app/api/admin/pengajuan/[id]/verifikasi/route.ts");
const finalizationRoute = read("app/api/petugas/pengajuan/[id]/surat-ttd/route.ts");
const finalizationService = read("services/official-letter-finalization.ts");
const pdfRoute = read("app/api/surat/[token]/pdf/route.ts");
const pdfService = read("services/official-letter-pdf.ts");

test("admin dipastikan oleh session server dan browser tidak menentukan role atau tahap", () => {
  assert.match(api, /getAdminSession\(request, \{ cookie: ["']admin["'] \}\)/);
  assert.match(api, /requireAdmin\(session\.profile\)/);
  assert.doesNotMatch(api, /body\.(role|petugas_id|user_id|tahap|status)/);
});

test("admin dapat memproses Seklur lalu Lurah melalui tahap aktif existing", () => {
  assert.match(api, /getActiveStage\(orderedStages\)/);
  assert.match(api, /Seklur harus disetujui sebelum Lurah dapat diproses/);
  assert.match(shell, /✓ SETUJUI SEKLUR/);
  assert.match(shell, /✓ VALIDASI & TERBITKAN/);
});

test("route admin memberlakukan kontrak action approval berdasarkan tahap aktif", () => {
  assert.match(api, /activeStage\.tahap === 4 && body\.action !== ["']proses_tahap["']/);
  assert.match(api, /activeStage\.tahap === 5 && body\.action !== ["']validasi_terbitkan["']/);
  assert.doesNotMatch(api, /activeStage\.tahap === 5 && body\.action !== ["']selesai["']/);
  assert.doesNotMatch(api, /type Action\s*=.*["']selesai["']/);
});

test("admin tahap 5 memanggil finalizer surat-ttd yang sama tanpa HTTP fetch", () => {
  assert.match(api, /import \{ finalizeOfficialLetter \} from ["']@\/services\/official-letter-finalization["']/);
  assert.match(api, /activeStage\.tahap === 5[\s\S]*?return finalizeOfficialLetter\(request,/);
  assert.doesNotMatch(api, /Penerbitan surat wajib dijalankan melalui proses finalisasi surat-ttd/);
  assert.doesNotMatch(finalizationRoute, /export function finalizeOfficialLetter\(/);
  assert.match(finalizationService, /export function finalizeOfficialLetter\(/);
  assert.match(finalizationRoute, /handleOfficialLetterPost/);
});

test("route helpers berada di service dan tidak membuat circular import route", () => {
  assert.doesNotMatch(pdfRoute, /export (?:async )?function renderOfficialLetterPdf\(/);
  assert.match(pdfService, /export function renderOfficialLetterPdf\(/);
  assert.match(finalizationRoute, /from ["']@\/services\/official-letter-finalization["']/);
  assert.match(finalizationService, /from ["']@\/services\/official-letter-pdf["']/);
  assert.doesNotMatch(finalizationService, /from ["']@\/app\/api\/.*\/route["']/);
  assert.doesNotMatch(pdfService, /from ["']@\/app\/api\/.*\/route["']/);
});

test("admin workflow boleh memicu finalizer tanpa menjadi role signer", () => {
  assert.match(api, /const adminHasFullAccess = isAdmin\(session\.profile\)/);
  assert.match(api, /if \(!adminHasFullAccess && activeStage\.role_petugas !== workflowRole\)/);
  assert.match(finalizationService, /if \(!internal && !workflowRole\) return jsonError\("Role tidak memiliki kewenangan workflow\."/);
  assert.match(api, /actorProfile: session\.profile/);
  assert.match(api, /signerProfile: lurahProfiles\[0\]/);
  assert.notStrictEqual(api.indexOf("actorProfile: session.profile"), api.indexOf("signerProfile: lurahProfiles[0]"));
});

test("foreign workflow role remains forbidden and admin cannot be supplied by browser", () => {
  assert.match(finalizationService, /if \(!internal && !isPetugas\(session\.profile\)\) return jsonError\("Akses khusus petugas\."[^\n]*403\)/);
  assert.doesNotMatch(api, /body\.(role|signerProfile|signer_id|petugas_id|tahap|status)/);
});

test("finalizer menetapkan field final dari server dan menerbitkan dokumen sebelum menyelesaikan pengajuan", () => {
  assert.doesNotMatch(api, /body\.(role|tahap|petugas_id|status|selesai_at|selesai_by)/);
  const issuedIndex = finalizationService.indexOf('update({ status: "TERBIT"');
  const completedIndex = finalizationService.indexOf('status: "Selesai", nomor_surat');
  assert.ok(issuedIndex >= 0 && completedIndex > issuedIndex);
  assert.match(finalizationService, /message: "Surat berhasil difinalisasi\."/);
  assert.match(finalizationService, /id: issuedDocument\.id, pengajuan_id: id, status: "Selesai"/);
});

test("tahap 5 menolak proses_tahap dan action legacy selesai", () => {
  const stageFiveGuard = api.match(/if \(!isReject && activeStage\.tahap === 5[^\n]+/u)?.[0] ?? "";
  assert.match(stageFiveGuard, /body\.action !== ["']validasi_terbitkan["']/);
  assert.doesNotMatch(stageFiveGuard, /["']proses_tahap["']|["']selesai["']/);
});

test("transisi menyimpan pelaksana, waktu proses, dan status Disetujui", () => {
  assert.match(api, /status: decision\.status, petugas_id: petugasId, acted_at: now/);
  assert.match(api, /status: ["']Disetujui["']/);
  assert.match(api, /activeStage\.tahap === 5 \? ["']Selesai["']/);
  assert.match(api, /pengajuanUpdate\.selesai_at = now/);
});

test("audit memakai aksi dan kolom status sebelum\/sesudah yang benar", () => {
  assert.match(api, /user_id: petugasId/);
  assert.match(api, /aksi: decision\.auditLabel/);
  assert.match(api, /status_sebelum: requiredStatus/);
  assert.match(api, /status_sesudah: status/);
  assert.doesNotMatch(api, /\n\s*action: decision\.auditLabel/);
});

test("UI refresh dari database, loading aman, dan selesai tidak menawarkan proses", () => {
  assert.match(shell, /disabled=\{busy\}/);
  assert.match(shell, /Memproses\.\.\./);
  assert.match(shell, /finally \{[\s\S]*?await load\(\)/);
  assert.match(shell, /✓ PENGAJUAN SELESAI/);
});

test("klik persetujuan detail langsung menjalankan PATCH dengan tracing lengkap", () => {
  assert.match(shell, /\[ADMIN ACTION CLICK\][\s\S]*?onApprove\(row\)/);
  assert.match(shell, /\[ADMIN ACTION START\][\s\S]*?\[ADMIN ACTION FETCH\][\s\S]*?fetch\(["']\/api\/admin\/pengajuan["']/);
  assert.match(shell, /\[ADMIN ACTION RESPONSE\][\s\S]*?\[ADMIN ACTION RESPONSE BODY\]/);
  assert.match(shell, /body: JSON\.stringify\(\{ id: row\.id, action, \.\.\.extra \}\)/);
});

test("action detail dipetakan dari tahap aktif server untuk Seklur dan Lurah", () => {
  assert.match(shell, /activeStage\(row\)\?\.tahap === 5 \? ["']validasi_terbitkan["'] : ["']proses_tahap["']/);
  assert.match(shell, /active\?\.tahap === 5 \? ["']validasi_terbitkan["'] : ["']proses_tahap["']/);
  assert.match(shell, /active\?\.tahap === 4 \? ["']✓ SETUJUI SEKLUR["']/);
  assert.match(shell, /active\?\.tahap === 5 \? ["']✓ VALIDASI & TERBITKAN["']/);
  assert.doesNotMatch(shell, /body: JSON\.stringify\(\{[^}]*\b(role|tahap|petugas_id|status)\b/);
  assert.doesNotMatch(shell, /updateStatus\([^\n]*["']selesai["']/);
});

test("status final ditentukan server dan tidak diterima dari browser", () => {
  assert.doesNotMatch(api, /body\.(status|selesai_at|selesai_by)/);
  assert.match(api, /activeStage\.tahap === 5 \? ["']Selesai["'] : ["']Diproses["']/);
  assert.match(api, /pengajuanUpdate\.selesai_at = now/);
  assert.match(api, /pengajuanUpdate\.selesai_by = petugasId/);
});

test("session Admin yang sama dapat mengakses resolver hasil surat berdasarkan ID row", () => {
  assert.match(shell, /\/api\/admin\/pengajuan\/\$\{row\.id\}\/surat/);
  assert.match(shell, /downloadPdfUrl/);
  assert.match(shell, /\/api\/admin\/pengajuan\/\$\{row\.id\}\/verifikasi/);
  assert.doesNotMatch(shell, /generatedPdfUrl.*verification_token/);
  assert.match(suratResolver, /getAdminSession\(request, \{ cookie: ["']admin["'] \}\)/);
  assert.match(suratResolver, /session\.error \|\| !session\.profile[^\n]*["']Sesi admin tidak valid\.["'][^\n]*401/);
  assert.match(suratResolver, /requireAdmin\(session\.profile\)[^\n]*["']Akses khusus admin\.["'][^\n]*403/);
  assert.doesNotMatch(suratResolver, /isPetugas\(session\.profile\)/);
  assert.match(suratResolver, /\.eq\("id", id\)/);
  assert.match(suratResolver, /isFinalDocument\(data\)/);
  assert.match(suratResolver, /api\/surat\/\$\{data\.verification_token\}\/pdf/);
  assert.match(suratResolver, /download=1/);
  assert.match(verifyResolver, /\.eq\("id", id\)/);
  assert.match(verifyResolver, /\/verifikasi\/\$\{data\.verification_token\}/);
  assert.doesNotMatch(suratResolver + verifyResolver, /dummy|placeholder|access_token|service_role/i);
});