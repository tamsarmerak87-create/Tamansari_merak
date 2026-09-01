import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const email = read("services/email.service.ts");
const submission = read("services/surat-online.service.ts");
const admin = read("app/api/admin/pengajuan/route.ts");
const petugas = read("app/api/petugas/pengajuan/route.ts");
const verification = read("app/api/petugas/pengajuan/[id]/verifikasi/route.ts");
const finalization = read("services/official-letter-finalization.ts");
const envExample = read(".env.example");

test("service email mendukung seluruh status dan subjek resmi", () => {
  const expected = { submitted: "Pengajuan Layanan Berhasil Diterima", processing: "Pengajuan Layanan Sedang Diproses", verified: "Pengajuan Layanan Telah Diverifikasi", completed: "Pengajuan Layanan Selesai", rejected: "Pengajuan Layanan Ditolak", documents_received: "Berkas Pengajuan Telah Diterima" };
  for (const [status, subject] of Object.entries(expected)) assert.match(email, new RegExp(`${status}: \\{ subject: "${subject}"`));
});

test("sender wajib dari RESEND_FROM_EMAIL dan tidak memiliki fallback palsu", () => {
  assert.match(email, /const from = process\.env\.RESEND_FROM_EMAIL\?\.trim\(\)/);
  assert.match(email, /body: JSON\.stringify\(\{ from,/);
  assert.doesNotMatch(email + submission, /noreply@example\.com|RESEND_API_KEY\s*=\s*["'][^"']+/);
  assert.match(envExample, /^RESEND_API_KEY=$/m);
  assert.match(envExample, /^RESEND_FROM_EMAIL=$/m);
});

test("template memiliki identitas, rincian, catatan, dan tombol tracking", () => {
  for (const text of ["Kelurahan Tamansari", "Kecamatan Pulomerak, Kota Cilegon", "Nomor Pengajuan", "Jenis Layanan", "Status Terbaru", "Catatan Petugas", "Lihat Status Pengajuan"]) assert.match(email, new RegExp(text));
  assert.match(email, /name="viewport"/);
  assert.match(email, /escapeHtml\(input\.trackingUrl\)/);
});

test("submit dan semua route perubahan status memanggil service setelah persistence", () => {
  assert.match(submission, /status: "submitted"/);
  for (const source of [admin, petugas, verification, finalization]) assert.match(source, /sendApplicationStatusEmailSafely\(statusEmailInputFromSubmission/);
  assert.ok(admin.indexOf("audit_pengajuan") < admin.lastIndexOf("sendApplicationStatusEmailSafely"));
  assert.ok(petugas.indexOf("audit_pengajuan") < petugas.lastIndexOf("sendApplicationStatusEmailSafely"));
  assert.ok(verification.indexOf("insertAuditPengajuan") < verification.lastIndexOf("sendApplicationStatusEmailSafely"));
  assert.ok(finalization.indexOf('status: "Selesai", nomor_surat') < finalization.lastIndexOf("sendApplicationStatusEmailSafely"));
});

test("kegagalan email tidak dilempar ke transaksi dan log tidak memuat credential", () => {
  assert.match(email, /export async function sendApplicationStatusEmailSafely/);
  assert.match(email, /catch \(error\)[\s\S]*return \{ ok: false \}/);
  assert.match(email, /nomorPengajuan: input\.nomorPengajuan, status: input\.status/);
  assert.doesNotMatch(email, /console\.error\([^\n]*(apiKey|Authorization|token|password)/i);
});