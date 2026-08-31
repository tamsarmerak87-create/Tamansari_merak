export const MARRIAGE_SERVICE_ID = "76d94250-77ba-4dca-8d98-032f0bc8bf8e";
export const MARRIAGE_SERVICE_NAME = "PENERBITAN SURAT PENGANTAR NIKAH, TALAK, CERAI, RUJUK";
export const MARRIAGE_TEMPLATE_ID = "TAMSAR_PENGANTAR_NIKAH_V1";

export const MARRIAGE_STEPS = [
    "Data Pemohon", "Data Pernikahan", "Data Pasangan", "Data Orang Tua / Wali",
    "Dokumen Pendukung", "Pernyataan & Tanda Tangan", "Review", "Ajukan",
] as const;

export const PARTY_SIGNATURE_STATUS = ["BELUM DITANDATANGANI", "MENUNGGU TANDA TANGAN", "SELESAI"] as const;
export type PartySignatureStatus = typeof PARTY_SIGNATURE_STATUS[number];

export type MarriagePerson = {
    nama_lengkap: string; nik: string; nomor_kk: string; jenis_kelamin: string;
    tempat_lahir: string; tanggal_lahir: string; kewarganegaraan: string; agama: string;
    pekerjaan: string; alamat: string; rt: string; rw: string; kelurahan: string;
    kecamatan: string; status_perkawinan: string;
};
export type ParentData = Omit<MarriagePerson, "nomor_kk" | "rt" | "rw" | "kelurahan" | "kecamatan" | "status_perkawinan"> & {
    status: "Masih hidup" | "Meninggal dunia" | "Tidak diketahui";
};
export type MarriageAdditionalData = {
    nikah: { jenis_permohonan: "NIKAH" | "TALAK" | "CERAI" | "RUJUK"; hari_akad: string; tanggal_akad: string; jam_akad: string; tempat_akad: string; kua_tujuan: string; mas_kawin: string; cara_pembayaran_mas_kawin: string; membutuhkan_isbat: boolean };
    pasangan: MarriagePerson & { sumber: "ISI_DATA_PASANGAN" };
    orang_tua: { ayah: ParentData; ibu: ParentData };
    wali: { nama_lengkap: string; nik: string; hubungan: string; alamat: string; nomor_hp: string };
    dokumen: Array<{ jenis: string; wajib: boolean; status: "TERSEDIA" | "BELUM TERSEDIA"; nama_file?: string; path?: string }>;
    paket_dokumen: { n1: true; n2: true; n3: boolean; n4: true; n5: true; surat_pernyataan: true };
    pernyataan: { teks: string; disetujui: boolean };
    tanda_tangan: Record<"calon_istri" | "calon_suami" | "ayah" | "ibu" | "wali", { status: PartySignatureStatus; provider_evidence: null }>;
    meterai: { status: "BELUM DIGUNAKAN"; provider_evidence: null };
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const required = (value: unknown, label: string) => { const result = text(value); if (!result) throw new Error(`${label} wajib diisi.`); return result; };
const optionalNik = (value: unknown, label: string) => { const result = text(value); if (result && !/^\d{16}$/.test(result)) throw new Error(`${label} harus 16 angka.`); return result; };

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
export function getMarriageDayName(dateValue: unknown): string {
    const date = text(dateValue);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return "";
    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return "";
    return DAY_NAMES[parsed.getDay()];
}

function validatePerson(value: unknown): MarriagePerson {
    const row = object(value);
    return {
        nama_lengkap: required(row.nama_lengkap, "Nama lengkap pasangan"), nik: optionalNik(required(row.nik, "NIK pasangan"), "NIK pasangan"),
        nomor_kk: optionalNik(required(row.nomor_kk, "Nomor KK pasangan"), "Nomor KK pasangan"), jenis_kelamin: required(row.jenis_kelamin, "Jenis kelamin pasangan"),
        tempat_lahir: required(row.tempat_lahir, "Tempat lahir pasangan"), tanggal_lahir: required(row.tanggal_lahir, "Tanggal lahir pasangan"),
        kewarganegaraan: required(row.kewarganegaraan, "Kewarganegaraan pasangan"), agama: required(row.agama, "Agama pasangan"),
        pekerjaan: required(row.pekerjaan, "Pekerjaan pasangan"), alamat: required(row.alamat, "Alamat pasangan"), rt: required(row.rt, "RT pasangan"),
        rw: required(row.rw, "RW pasangan"), kelurahan: required(row.kelurahan, "Kelurahan pasangan"), kecamatan: required(row.kecamatan, "Kecamatan pasangan"),
        status_perkawinan: required(row.status_perkawinan, "Status perkawinan pasangan"),
    };
}

function validateParent(value: unknown, label: string): ParentData {
    const row = object(value);
    const status = required(row.status, `Status ${label}`) as ParentData["status"];
    if (!["Masih hidup", "Meninggal dunia", "Tidak diketahui"].includes(status)) throw new Error(`Status ${label} tidak valid.`);
    const unavailable = status === "Tidak diketahui";
    return {
        status, nama_lengkap: unavailable ? text(row.nama_lengkap) : required(row.nama_lengkap, `Nama ${label}`), nik: optionalNik(row.nik, `NIK ${label}`),
        jenis_kelamin: text(row.jenis_kelamin) || (label === "ayah" ? "Laki-laki" : "Perempuan"), tempat_lahir: unavailable ? text(row.tempat_lahir) : required(row.tempat_lahir, `Tempat lahir ${label}`),
        tanggal_lahir: text(row.tanggal_lahir), kewarganegaraan: unavailable ? text(row.kewarganegaraan) : required(row.kewarganegaraan, `Kewarganegaraan ${label}`),
        agama: unavailable ? text(row.agama) : required(row.agama, `Agama ${label}`), pekerjaan: unavailable ? text(row.pekerjaan) : required(row.pekerjaan, `Pekerjaan ${label}`),
        alamat: unavailable ? text(row.alamat) : required(row.alamat, `Alamat ${label}`),
    };
}

export function validateMarriageStep(value: unknown, step: number): void {
    const root = object(value);
    if (step === 2) {
        const nikah = object(root.nikah);
        const jenis = required(nikah.jenis_permohonan, "Jenis permohonan");
        if (jenis !== "NIKAH") throw new Error("Pengembangan form khusus saat ini tersedia untuk permohonan NIKAH.");
        required(getMarriageDayName(nikah.tanggal_akad), "Hari akad");
        required(nikah.tanggal_akad, "Tanggal akad"); required(nikah.jam_akad, "Jam akad");
        required(nikah.tempat_akad, "Tempat akad"); required(nikah.kua_tujuan, "KUA tujuan");
        required(nikah.mas_kawin, "Mas kawin"); required(nikah.cara_pembayaran_mas_kawin, "Cara pembayaran mas kawin");
        return;
    }
    if (step === 3) { validatePerson(root.pasangan); return; }
    if (step === 4) {
        const parents = object(root.orang_tua); const wali = object(root.wali);
        validateParent(parents.ayah, "ayah"); validateParent(parents.ibu, "ibu");
        required(wali.nama_lengkap, "Nama wali"); required(wali.hubungan, "Hubungan wali"); required(wali.alamat, "Alamat wali");
    }
}

export function validateMarriageAdditionalData(value: unknown): MarriageAdditionalData {
    const root = object(value); const nikah = object(root.nikah); const parents = object(root.orang_tua); const wali = object(root.wali); const pernyataan = object(root.pernyataan);
    const jenis = required(nikah.jenis_permohonan, "Jenis permohonan") as MarriageAdditionalData["nikah"]["jenis_permohonan"];
    if (!["NIKAH", "TALAK", "CERAI", "RUJUK"].includes(jenis)) throw new Error("Jenis permohonan tidak valid.");
    if (jenis !== "NIKAH") throw new Error("Pengembangan form khusus saat ini tersedia untuk permohonan NIKAH.");
    const signatures = Object.fromEntries(["calon_istri", "calon_suami", "ayah", "ibu", "wali"].map((party) => [party, { status: "BELUM DITANDATANGANI", provider_evidence: null }])) as MarriageAdditionalData["tanda_tangan"];
    return {
        nikah: { jenis_permohonan: jenis, hari_akad: required(getMarriageDayName(nikah.tanggal_akad), "Hari akad"), tanggal_akad: required(nikah.tanggal_akad, "Tanggal akad"), jam_akad: required(nikah.jam_akad, "Jam akad"), tempat_akad: required(nikah.tempat_akad, "Tempat akad"), kua_tujuan: required(nikah.kua_tujuan, "KUA tujuan"), mas_kawin: required(nikah.mas_kawin, "Mas kawin"), cara_pembayaran_mas_kawin: required(nikah.cara_pembayaran_mas_kawin, "Cara pembayaran mas kawin"), membutuhkan_isbat: nikah.membutuhkan_isbat === true },
        pasangan: { ...validatePerson(root.pasangan), sumber: "ISI_DATA_PASANGAN" },
        orang_tua: { ayah: validateParent(parents.ayah, "ayah"), ibu: validateParent(parents.ibu, "ibu") },
        wali: { nama_lengkap: required(wali.nama_lengkap, "Nama wali"), nik: optionalNik(wali.nik, "NIK wali"), hubungan: required(wali.hubungan, "Hubungan wali"), alamat: required(wali.alamat, "Alamat wali"), nomor_hp: text(wali.nomor_hp) },
        dokumen: Array.isArray(root.dokumen) ? root.dokumen.map((item) => { const row = object(item); return { jenis: required(row.jenis, "Jenis dokumen"), wajib: row.wajib === true, status: row.status === "TERSEDIA" ? "TERSEDIA" : "BELUM TERSEDIA", nama_file: text(row.nama_file) || undefined, path: text(row.path) || undefined }; }) : [],
        paket_dokumen: { n1: true, n2: true, n3: nikah.membutuhkan_isbat === true, n4: true, n5: true, surat_pernyataan: true },
        pernyataan: { teks: required(pernyataan.teks, "Pernyataan"), disetujui: pernyataan.disetujui === true },
        tanda_tangan: signatures, meterai: { status: "BELUM DIGUNAKAN", provider_evidence: null },
    };
}