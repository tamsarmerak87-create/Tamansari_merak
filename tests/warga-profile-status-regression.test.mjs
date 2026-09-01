import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const register = read("app/register/page.tsx");
const auth = read("services/warga-auth.service.ts");
const registerRoute = read("app/api/warga/register/route.ts");
const pdf = read("services/official-letter-pdf.ts");
const documents = read("app/dashboard/dokumen/page.tsx");
const adminData = read("app/api/admin/data/route.ts");
const adminUsers = read("app/api/admin/pengguna/route.ts");
const migration = read("supabase/migrations/20260824011500_add_warga_profile_marital_employment_status.sql");
const submissionClient = read("components/pengajuan/surat-online-client.tsx");
const submissionService = read("services/surat-online.service.ts");
const wargaSubmissionApi = read("app/api/warga/pengajuan/route.ts");
const wargaProfilePage = read("app/dashboard/profil/page.tsx");
const submissionRoute = read("app/api/surat-online/pengajuan/route.ts");
const trackingRoute = read("app/api/warga/tracking/route.ts");
const finalizer = read("services/official-letter-finalization.ts");

test("form registrasi menyediakan status perkawinan dan semua pilihannya", () => {
    assert.match(register, /aria-label="Status Perkawinan"/);
    for (const option of ["Menikah", "Belum Menikah", "Janda", "Duda"]) assert.match(register, new RegExp(`<option>${option}</option>`));
});

test("form registrasi menyediakan status pekerjaan dan semua pilihannya", () => {
    assert.match(register, /aria-label="Status Pekerjaan"/);
    for (const option of ["Bekerja", "Belum Bekerja"]) assert.match(register, new RegExp(`<option>${option}</option>`));
});

test("agama divalidasi saat registrasi tanpa meminta kolom yang tidak ada di warga_profiles production", () => {
    assert.match(register, /aria-label="Agama"/);
    for (const option of ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"]) assert.match(register, new RegExp(`<option>${option}</option>`));
    assert.match(auth, /wargaRegisterSchema[\s\S]*agama: z\.enum/);
    assert.doesNotMatch(registerRoute, /agama:\s*payload\.agama/);
    assert.doesNotMatch(auth.match(/const WARGA_PROFILE_COLUMNS = "([^"]*)"/)?.[1] ?? "", /(?:^|,)agama(?:,|$)/);
    assert.doesNotMatch(pdf, /value\(profile\.agama\)/);
    assert.match(pdf, /value\(surat\.agama\)/);
    assert.doesNotMatch(pdf, /Tidak dicantumkan/);
});

test("finalizer mengambil profil verified dan menyimpan snapshot status authoritative", () => {
    assert.match(finalizer, /\.from\("warga_profiles"\)[\s\S]*?\.eq\("status_verifikasi", "Terverifikasi"\)/);
    assert.match(finalizer, /agama: wargaProfile\.agama/);
    assert.match(finalizer, /status_perkawinan: wargaProfile\.status_perkawinan/);
    assert.match(finalizer, /status_pekerjaan: wargaProfile\.status_pekerjaan/);
    assert.match(finalizer, /const update = \{[\s\S]*?\.\.\.profileLegalIdentity[\s\S]*?\.from\("pengajuan_surat"\)\.update\(update\)/);
    assert.doesNotMatch(finalizer, /(?:agama|status_perkawinan|status_pekerjaan):\s*pengajuan/);
});

test("register memvalidasi kedua status tanpa menyimpannya ke warga_profiles production", () => {
    assert.match(auth, /wargaRegisterSchema[\s\S]*status_perkawinan: z\.enum/);
    assert.match(auth, /wargaRegisterSchema[\s\S]*status_pekerjaan: z\.enum/);
    for (const field of ["status_perkawinan", "status_pekerjaan"]) {
        assert.doesNotMatch(registerRoute, new RegExp(`${field}:\\s*payload\\.${field}`));
    }
});

test("Surat Profil tidak meminta status yang tidak ada pada schema production", () => {
    assert.doesNotMatch(pdf, /\.from\("warga_profiles"\)/);
    assert.match(pdf, /\["Agama", value\(surat\.agama\)\]/);
    assert.match(pdf, /\["Status Perkawinan", value\(surat\.status_perkawinan\)\]/);
    assert.match(pdf, /\["Pekerjaan", value\(surat\.status_pekerjaan\)\]/);
});

test("Admin Pengguna hanya meminta kolom warga_profiles production", () => {
    const legalColumns = "id,nama_lengkap,nik,email,nomor_hp,nomor_whatsapp,nomor_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,alamat,rt,rw,kelurahan,kecamatan";
    assert.match(adminData, new RegExp(`\\.select\\("${legalColumns},role,created_at,status_verifikasi,alasan_penolakan"\\)`));
    assert.match(adminUsers, new RegExp(`const wargaColumns = "${legalColumns},status_verifikasi,alasan_penolakan,created_at"`));
    for (const source of [adminData, adminUsers]) {
        assert.match(source, /(?:agama|status_perkawinan|status_pekerjaan)/);
    }
});

test("auth dan Dokumen Saya tetap memakai ownership existing", () => {
    assert.match(auth, /auth\.getUser\(\)/);
    assert.match(auth, /\.eq\("id", currentProfile\.id\)/);
    assert.match(documents, /useWargaAuth/);
});

test("register dan auth hanya memakai kolom warga_profiles yang tersedia di production", () => {
    const insertColumns = auth.match(/export const wargaProfileInsertColumns = \[([\s\S]*?)\] as const/)?.[1] ?? "";
    assert.match(insertColumns, /"id"/);
    for (const field of ["agama", "status_perkawinan", "status_pekerjaan"]) {
        assert.doesNotMatch(insertColumns, new RegExp(`"${field}"`));
        assert.doesNotMatch(registerRoute, new RegExp(`${field}:\\s*payload\\.${field}`));
        assert.doesNotMatch(auth.match(/const WARGA_PROFILE_COLUMNS = "([^"]*)"/)?.[1] ?? "", new RegExp(`(?:^|,)${field}(?:,|$)`));
    }
    assert.match(registerRoute, /cleanupStorage\(supabaseAdmin, uploadedFiles\)/);
    assert.match(registerRoute, /cleanupAuthUser\(createdUserId\)/);
});

test("proses pengajuan mengirim tiga field wajib langsung dari profil warga", () => {
    assert.match(submissionClient, /religion: profileValue\("agama"\),/);
    assert.match(submissionClient, /maritalStatus: profileValue\("status_perkawinan"\),/);
    assert.match(submissionClient, /job: profileValue\("status_pekerjaan"\),/);
    assert.match(submissionClient, /agama: normalizedProfile\.religion/);
    assert.match(submissionClient, /status_perkawinan: normalizedProfile\.maritalStatus/);
    assert.match(submissionClient, /status_pekerjaan: normalizedProfile\.job/);
    assert.match(submissionClient, /\["Status Perkawinan", form\.maritalStatus\]/);
    assert.match(submissionClient, /\["Status Pekerjaan", form\.job\]/);
    assert.match(submissionService, /profileColumns = "id,nik,nama_lengkap,nomor_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,/);
    assert.match(submissionService, /\.from\("warga_profiles"\)[\s\S]*?\.select\(profileColumns\)/);
    assert.match(submissionService, /status_perkawinan: profile\.status_perkawinan/);
    assert.match(submissionService, /status_pekerjaan: profile\.status_pekerjaan/);
    assert.match(submissionService, /additional_data:[\s\S]*?status_pekerjaan: payload\.status_pekerjaan/);
    assert.doesNotMatch(submissionService, /status_perkawinan: payload\.status_perkawinan,\s*status_pekerjaan:/);
    assert.match(wargaSubmissionApi, /jenis_kelamin,status_perkawinan,status_pekerjaan,alamat/);
    for (const source of [submissionClient, submissionService]) {
        assert.doesNotMatch(source, /warga_profiles\.(?:pekerjaan|status_nikah|status_kawin)/);
    }
});

test("submit pengajuan mengikat profil canonical id ke Auth UID, bukan NIK", () => {
    assert.match(submissionClient, /auth\.getSession\(\)/);
    assert.match(submissionClient, /Authorization: `Bearer \$\{accessToken\}`/);
    assert.match(submissionClient, /fetch\("\/api\/surat-online\/pengajuan",\s*\{[\s\S]*?method:\s*"POST"/);
    assert.match(submissionService, /auth\.getSession\(\)/);
    assert.match(submissionService, /authorization: `Bearer \$\{accessToken\}`/);
    assert.match(submissionRoute, /auth\.getUser\(accessToken\)/);
    assert.match(submissionRoute, /createSubmission\(body, authData\.user\.id\)/);
    assert.match(submissionService, /\.eq\("id", authenticatedUserId\)/);
    assert.doesNotMatch(submissionService, /\.eq\("user_id", authenticatedUserId\)/);
    assert.match(submissionService, /profile\.status_verifikasi !== "Terverifikasi"/);
    assert.doesNotMatch(submissionService, /assertWargaAccountVerifiedByNik\(payload\.nik\)/);
});

test("status profil kosong menghentikan pengajuan dengan pesan yang jelas", () => {
    assert.match(submissionService, /status_perkawinan: z\.string\(\)\.min\(1/);
    assert.match(submissionService, /status_pekerjaan: z\.string\(\)\.min\(1/);
    for (const field of ["agama", "status perkawinan", "status pekerjaan"]) assert.match(submissionService, new RegExp(`Data ${field} pada profil warga belum tersedia`));
    assert.doesNotMatch(submissionClient, /Tidak dicantumkan/);
    assert.doesNotMatch(submissionClient, /agama:\s*String\(/);
    for (const source of [wargaProfilePage, auth, register, registerRoute, submissionClient, submissionService]) assert.doesNotMatch(source, /Tidak dicantumkan/);
});

test("Profil Warga menampilkan status canonical sebagai data identitas read-only", () => {
    assert.match(wargaProfilePage, /\["Status Perkawinan", profile\.status_perkawinan \|\| "-"\]/);
    assert.match(wargaProfilePage, /\["Status Pekerjaan", profile\.status_pekerjaan \|\| "-"\]/);
    assert.match(wargaProfilePage, /identityRows\(profile\).*DataBox/);
    assert.doesNotMatch(wargaProfilePage, /\bpekerjaan\b/);
    assert.doesNotMatch(wargaProfilePage, /status_(nikah|kawin)/);
});

test("form pengajuan memisahkan alamat asal profil dan alamat sekarang pengajuan", () => {
    assert.match(submissionClient, /field\.name !== "alamat_asal"/);
    assert.match(submissionClient, /field\.name !== "alamat_sekarang"/);
    assert.match(submissionClient, /\["Alamat", form\.address\]/);
    assert.match(submissionClient, /alamat_sekarang: form\.currentAddress/);
    assert.match(submissionClient, /address: profile\.alamat \|\| ""/);
    assert.match(submissionClient, /Data read-only dari Profil Warga/);
    assert.match(submissionClient, /ReadOnlyInfo key=\{label\} label=\{label\} value=\{value\}/);
    assert.match(submissionClient, /alamat_sekarang: form\.currentAddress/);
    assert.doesNotMatch(submissionClient, /update\("address"/);
    assert.match(submissionService, /alamat: profile\.alamat/);
    assert.match(submissionService, /alamat_sekarang: currentAddress/);
    assert.doesNotMatch(submissionService, /alamat_sekarang: profile\.alamat/);
});

test("keperluan tetap textarea dengan placeholder dinamis tanpa menjadi value", () => {
    assert.match(submissionClient, /function getPurposePlaceholder/);
    assert.match(submissionClient, /includes\("domisili"\).*Untuk persyaratan masuk sekolah/);
    assert.match(submissionClient, /includes\("tidak mampu"\).*pengajuan bantuan pendidikan/);
    assert.match(submissionClient, /includes\("skck"\).*melamar pekerjaan/);
    assert.match(submissionClient, /includes\("usaha"\).*pengajuan KUR di bank/);
    assert.match(submissionClient, /includes\("kelahiran"\).*pembuatan akta kelahiran/);
    assert.match(submissionClient, /includes\("kematian"\).*administrasi kependudukan/);
    assert.match(submissionClient, /value=\{form\.purpose\}[\s\S]*?placeholder=\{getPurposePlaceholder\(selectedServiceName\)\}/);
    assert.match(submissionClient, /update\("serviceId", e\.target\.value\); setSelectedId\(e\.target\.value\)/);
    assert.doesNotMatch(submissionClient, /update\("purpose",\s*getPurposePlaceholder/);
});

test("review pengajuan menampilkan alamat, keperluan, dan status canonical", () => {
    assert.match(submissionClient, /\["Data Pengajuan", `\$\{service\} • \$\{form\.purpose\}/);
    assert.match(submissionClient, /const applicant = `Nama: \$\{form\.name\} • NIK: \$\{form\.nik\} • KK: \$\{form\.kk\}/);
    assert.match(submissionClient, /Status Perkawinan: \$\{form\.maritalStatus\}/);
    assert.match(submissionClient, /Status Pekerjaan: \$\{form\.job\}/);
    assert.match(submissionClient, /<b>Keperluan:<\/b> \{form\.purpose \|\| "-"\}/);
});