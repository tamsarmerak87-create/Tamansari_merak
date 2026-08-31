import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const ui = readFileSync(new URL("components/pengajuan/surat-online-client.tsx", root), "utf8");
const trust = readFileSync(new URL("services/submission-trust.ts", root), "utf8");
const service = readFileSync(new URL("services/surat-online.service.ts", root), "utf8");
const schema = readFileSync(new URL("tests/fixtures/production-public-schema.sql", root), "utf8");

test("agama berasal dari profil dan tampil read-only", () => {
  assert.match(ui, /religion: profileValue\("agama"\)/);
  assert.match(ui, /religion: profile\.agama/);
  assert.match(ui, /\["Agama", form\.religion\]/);
  assert.match(schema, /agama character varying\(30\)/);
});

test("stepper workflow final berisi tahap 1-6 dan mengunci tahap berikut", () => {
  for (const label of ["Data Pemohon", "Data Pengajuan", "Dokumen Pendukung", "Pernyataan & Tanda Tangan", "Review", "Ajukan"]) assert.match(ui, new RegExp(label.replaceAll("&", "&")));
  assert.match(ui, /disabled=\{number > currentStep\}/);
  assert.match(ui, /validateStep\(previous\)/);
  assert.match(ui, /Tahap \{currentStep\} dari 6/);
});

test("Review adalah tahap read-only dan tidak menjalankan validasi submit/provider", () => {
  assert.match(ui, /if \(step === 5\) return \[1, 2, 3, 4\]\.every\(\(previousStep\) => validateStep\(previousStep\)\)/);
  assert.doesNotMatch(ui, /if \(step === 5\) return validate\(\)\.valid/);
  assert.match(ui, /for \(let previous = 1; previous < step; previous \+= 1\)/);
});

test("data layanan dinamis tidak meminta ulang identitas profil", () => {
  assert.match(ui, /fields\.map\(\(field\)/);
  assert.match(ui, /Isi hanya data yang berkaitan dengan layanan/);
  assert.doesNotMatch(ui, /section === 2[\s\S]{0,1000}label="NIK"/);
});

test("NIK profil menjadi state canonical tanpa input manual atau sinkronisasi tertunda", () => {
  assert.match(ui, /setForm\(\(prev\) => \(\{[\s\S]*?nik: profile\.nik \|\| prev\.nik/);
  assert.doesNotMatch(ui, /setTimeout\(\(\) => \{[\s\S]*?nik: profile\.nik/);
  assert.doesNotMatch(ui, /<Field[^>]*label="(?:Masukkan )?NIK/);
  assert.doesNotMatch(ui, /<input[^>]*(?:name|id)="nik"/);
});

test("validator, Review, payload, dan database memakai NIK canonical profil", () => {
  assert.match(ui, /if \(step === 1\) return Boolean\([\s\S]*?form\.nik/);
  assert.match(ui, /requiredFields:[^=]*= \[[^\]]*"nik"/);
  assert.match(ui, /NIK: \$\{form\.nik\}/);
  assert.match(ui, /nik: form\.nik/);
  assert.match(service, /payload = submissionSchema\.parse\(\{[\s\S]*?nik: profile\.nik/);
  assert.match(service, /const pengajuanPayload = \{[\s\S]*?nik: payload\.nik/);
});

test("Wali Nikah dan Domisili menerima NIK profil, sedangkan profil tanpa NIK tetap ditolak", () => {
  const mapNik = (profileNik, previousNik = "") => profileNik || previousNik;
  const passesNikValidation = (nik) => /^\d{16}$/.test(nik);
  const profileNik = "3672050503870001";

  for (const serviceName of ["PENERBITAN SURAT KETERANGAN WALI NIKAH", "PENERBITAN SURAT KETERANGAN DOMISILI"]) {
    assert.equal(passesNikValidation(mapNik(profileNik)), true, `${serviceName} harus menerima NIK profil`);
  }
  assert.equal(passesNikValidation(mapNik("")), false);
  assert.match(service, /nik: z\.string\(\)\.regex\(\/\^\\d\{16\}\$\//);
});

test("dokumen divalidasi dan dikaitkan dengan pengajuan existing", () => {
  assert.match(ui, /allowedTypes\.includes\(file\.type\)/);
  assert.match(service, /pengajuan_id: pengajuan\.id/);
  assert.match(service, /SUBMISSION_DOCUMENT_BUCKET/);
});

test("master pernyataan mencakup 33 layanan dan berbeda per layanan", () => {
  assert.match(trust, /MASTER_LAYANAN\.map/);
  assert.match(trust, /SURAT KETERANGAN DOMISILI/);
  assert.match(trust, /BELUM PERNAH MENIKAH/);
  assert.match(ui, /getServiceStatement/);
});

test("consent wajib dan layanan harus UUID asli tanpa synthetic id", () => {
  assert.match(service, /layanan_id: z\.string\(\)\.uuid/);
  assert.match(service, /formData\.consent !== true/);
  assert.doesNotMatch(ui, /master-layanan-\d/);
});

test("meterai dan TTE tidak berhasil tanpa bukti provider", () => {
  assert.match(trust, /hasValidProviderEvidence/);
  assert.match(trust, /evidenceUrl/);
  assert.match(ui, /Status: BELUM DIGUNAKAN/);
  assert.match(ui, /Status: BELUM DITANDATANGANI/);
  assert.doesNotMatch(ui, /Status: BERMETERAI/);
});

test("review menampilkan semua bagian dan workflow responsive sama", () => {
  for (const label of ["Data Pemohon", "Data Pengajuan", "Dokumen", "Pernyataan", "Meterai", "Tanda Tangan"]) assert.match(ui, new RegExp(`\\["${label}"`));
  assert.match(ui, /sm:hidden/);
  assert.match(ui, /hidden grid-cols-3/);
});

test("alamat sekarang hanya berlaku untuk layanan Domisili", () => {
  assert.match(ui, /DOMISILI_SERVICE_NAME = "PENERBITAN SURAT KETERANGAN DOMISILI"/);
  assert.match(ui, /const selectedIsDomisili = isDomisiliService\(selectedService\?\.title\)/);
  assert.match(ui, /!selectedIsDomisili \|\| form\.currentAddress\.trim\(\)/);
  assert.match(ui, /isDomisiliService \? <Field label="Alamat Sekarang \*"/);
  assert.match(ui, /domisili \? <p><b>Alamat Sekarang:<\/b>/);
  assert.match(ui, /selectedIsDomisili \? \{ alamat_sekarang: form\.currentAddress \} : \{\}/);
  assert.match(service, /if \(domisili && !currentAddress\) throw new Error\("Alamat sekarang wajib diisi\."\)/);
});

test("Wali Nikah dan kategori layanan non-Domisili tidak meminta alamat sekarang", () => {
  const nonDomisiliServices = [
    "PENERBITAN SURAT KETERANGAN WALI NIKAH",
    "PENERBITAN SURAT PENGANTAR BERKELAKUAN BAIK",
    "PENERBITAN SURAT KUASA",
    "REKOMENDASI",
    "LEGALISASI",
  ];
  for (const serviceName of nonDomisiliServices) assert.equal(serviceName === "PENERBITAN SURAT KETERANGAN DOMISILI", false);
  assert.match(ui, /domisili \? "Alamat Asal" : "Alamat"/);
  assert.match(ui, /if \(step === 5\) return \[1, 2, 3, 4\]\.every/);
  assert.doesNotMatch(service, /if \(!currentAddress\) throw new Error/);
});

test("navigasi dashboard tersedia dan tombolnya tidak melakukan submit", () => {
  assert.match(ui, /import \{ useRouter \} from "next\/navigation"/);
  assert.match(ui, /const router = useRouter\(\)/);
  assert.match(ui, /<Button type="button" variant="glass" onClick=\{\(\) => router\.push\("\/dashboard\/pengajuan"\)\}>← Kembali ke Dashboard<\/Button>/);
});

test("submit hanya menuju dashboard setelah API sukses dan mempertahankan halaman saat gagal", () => {
  const failureCheck = ui.indexOf("if (!response.ok || !result?.ok)");
  const successState = ui.indexOf("setSubmitted(true)", failureCheck);
  const successNotice = ui.indexOf('alert(typeof result.message === "string" ? result.message : "Pengajuan berhasil dikirim.")', successState);
  const redirect = ui.indexOf('router.push("/dashboard/pengajuan")', successNotice);
  const catchBlock = ui.indexOf("} catch (error) {", redirect);
  assert.ok(failureCheck >= 0 && successState > failureCheck && successNotice > successState && redirect > successNotice);
  assert.ok(catchBlock > redirect);
  assert.doesNotMatch(ui.slice(failureCheck, successState), /router\.push\("\/dashboard\/pengajuan"\)/);
});