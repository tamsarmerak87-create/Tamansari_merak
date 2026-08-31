export type WorkflowRole = "warga" | "petugas_lapangan" | "seklur" | "lurah" | "system";

export type ServiceStatus =
    | "DIAJUKAN"
    | "DIVERIFIKASI"
    | "DIPROSES_SEKLUR"
    | "DIPROSES_LURAH"
    | "PERLU_PERBAIKAN"
    | "DITOLAK"
    | "SELESAI";

export type MasterWorkflowStep = {
    tahap: number;
    kode: string;
    nama: string;
    role: WorkflowRole;
    status: ServiceStatus;
    aksi_berhasil?: string;
    aksi_penolakan?: string;
    deskripsi: string;
};

export type MasterLayanan = {
    urutan: number;
    nama: string;
    deskripsi: string;
    aktif: boolean;
    persyaratan: string[];
    alur: string[];
    dasar_hukum: string;
    output: string;
    kanal: string;
};

export const MASTER_WORKFLOW: readonly MasterWorkflowStep[] = [
    {
        tahap: 1,
        kode: "PENGAJUAN",
        nama: "Pengajuan Warga",
        role: "warga",
        status: "DIAJUKAN",
        aksi_berhasil: "VERIFIKASI",
        deskripsi: "Warga mengisi formulir, melengkapi persyaratan, kemudian mengajukan permohonan.",
    },
    {
        tahap: 2,
        kode: "VERIFIKASI_PETUGAS",
        nama: "Verifikasi Petugas",
        role: "petugas_lapangan",
        status: "DIVERIFIKASI",
        aksi_berhasil: "LANJUT_SEKLUR",
        aksi_penolakan: "PERLU_PERBAIKAN",
        deskripsi: "Petugas memeriksa identitas, kelengkapan dan kesesuaian dokumen.",
    },
    {
        tahap: 3,
        kode: "PEMERIKSAAN_SEKLUR",
        nama: "Pemeriksaan Seklur",
        role: "seklur",
        status: "DIPROSES_SEKLUR",
        aksi_berhasil: "LANJUT_LURAH",
        aksi_penolakan: "PERLU_PERBAIKAN",
        deskripsi: "Seklur memeriksa kelengkapan dan kesesuaian administrasi.",
    },
    {
        tahap: 4,
        kode: "PERSETUJUAN_LURAH",
        nama: "Persetujuan Lurah",
        role: "lurah",
        status: "DIPROSES_LURAH",
        aksi_berhasil: "FINALISASI",
        aksi_penolakan: "PERLU_PERBAIKAN",
        deskripsi: "Lurah melakukan pemeriksaan dan persetujuan akhir.",
    },
    {
        tahap: 5,
        kode: "FINALISASI",
        nama: "Finalisasi & Penerbitan",
        role: "system",
        status: "SELESAI",
        deskripsi: "Sistem mengunci dokumen, menerbitkan PDF, nomor surat dan QR verifikasi.",
    },
] as const;

export const MASTER_STATUS: Readonly<Record<ServiceStatus, string>> = {
    DIAJUKAN: "Diajukan",
    DIVERIFIKASI: "Diverifikasi",
    DIPROSES_SEKLUR: "Diproses Seklur",
    DIPROSES_LURAH: "Diproses Lurah",
    PERLU_PERBAIKAN: "Perlu Perbaikan",
    DITOLAK: "Ditolak",
    SELESAI: "Selesai",
};

export const ALUR_LAYANAN_DEFAULT = [
    "Warga memilih layanan",
    "Warga mengisi formulir",
    "Warga melengkapi persyaratan",
    "Warga mengajukan permohonan",
    "Petugas melakukan verifikasi",
    "Seklur melakukan pemeriksaan",
    "Lurah memberikan persetujuan",
    "Sistem melakukan finalisasi dan menerbitkan surat",
] as const;

const DASAR_HUKUM_DEFAULT = "Dasar hukum mengikuti ketentuan peraturan perundang-undangan yang berlaku.";
const KANAL_DEFAULT = "Kantor Kelurahan Tamansari dan kanal daring aplikasi.";
const PERSYARATAN_AWAL = [
    "Konfigurasi awal: identitas pemohon yang masih berlaku.",
    "Konfigurasi awal: Kartu Keluarga atau dokumen pendukung yang relevan.",
    "Konfigurasi awal: dokumen asli atau salinan yang berkaitan dengan permohonan untuk diverifikasi petugas.",
];

const NAMA_LAYANAN = [
    "PERMOHONAN LEGALISASI DOKUMEN",
    "PENANDATANGAN SURAT KUASA KHUSUS UNTUK PEMBAYARAN PENSIUN",
    "PENANDATANGAN SURAT KUASA PENUNJUKAN PELIMPAHAN NOMOR PORSI JEMAAH HAJI MENINGGAL DUNIA",
    "PENANDATANGAN SURAT PERSETUJUAN ORANG TUA/WALI DAN DAFTAR RIWAYAT HIDUP PENDAFTARAN ANGGOTA TNI",
    "PENGESAHAN SURAT PERNYATAAN TIDAK KEBERATAN DALAM PENERBITAN PERSETUJUAN BANGUNAN GEDUNG/IZIN GANGGUAN",
    "PENERBITAN SURAT KETERANGAN BELUM MEMILIKI RUMAH",
    "PENERBITAN SURAT KETERANGAN BELUM MEMPUNYAI PEKERJAAN",
    "PENERBITAN SURAT KETERANGAN BELUM PERNAH MENIKAH",
    "PENERBITAN SURAT KETERANGAN BORO KERJA",
    "PENERBITAN SURAT KETERANGAN DOMISILI",
    "PENERBITAN SURAT KETERANGAN USAHA",
    "PENERBITAN SURAT KETERANGAN GHAIB",
    "PENERBITAN SURAT KETERANGAN JANDA/DUDA",
    "PENERBITAN SURAT KETERANGAN KEBAKARAN",
    "PENERBITAN SURAT KETERANGAN KEHILANGAN",
    "PENERBITAN SURAT KETERANGAN KELAHIRAN",
    "PENERBITAN SURAT PENGANTAR BERKELAKUAN BAIK",
    "PENERBITAN SURAT KETERANGAN KEMATIAN",
    "PENERBITAN SURAT KETERANGAN LETAK OBJEK TANAH",
    "PENERBITAN SURAT KETERANGAN PINDAH DATANG",
    "PENERBITAN SURAT KETERANGAN PINDAH KELUAR",
    "PENERBITAN SURAT KETERANGAN TIDAK MAMPU",
    "PENERBITAN SURAT KETERANGAN WALI NIKAH",
    "PENERBITAN SURAT PENGANTAR CALON PEKERJA MIGRAN INDONESIA",
    "PENERBITAN SURAT PENGANTAR NIKAH, TALAK, CERAI, RUJUK",
    "PENERBITAN SURAT PENGANTAR PEMBUATAN DISPENSASI NIKAH",
    "PENERBITAN SURAT PENGANTAR PEMBUATAN KONVERSI TANAH",
    "PENERBITAN SURAT PENGANTAR PEMBUATAN PERNYATAAN AHLI WARIS",
    "PENERBITAN SURAT PENGANTAR PEMBUATAN SURAT KETERANGAN CATATAN KEPOLISIAN",
    "PENERBITAN SURAT PENGANTAR PENERBITAN DUPLIKAT SURAT NIKAH",
    "PENERBITAN SURAT PENGANTAR PENERBITAN KARTU KELUARGA",
    "PENERBITAN SURAT PENGANTAR PENERBITAN KARTU TANDA PENDUDUK",
    "PENERBITAN SURAT REKOMENDASI IJIN KEGIATAN / KERAMAIAN",
] as const;

export const MASTER_LAYANAN: readonly MasterLayanan[] = NAMA_LAYANAN.map((nama, index) => ({
    urutan: index + 1,
    nama,
    deskripsi: `Layanan administrasi Kelurahan Tamansari untuk ${nama.toLocaleLowerCase("id-ID")}.`,
    aktif: true,
    persyaratan: [...PERSYARATAN_AWAL],
    alur: [...ALUR_LAYANAN_DEFAULT],
    dasar_hukum: DASAR_HUKUM_DEFAULT,
    output: nama,
    kanal: KANAL_DEFAULT,
}));

export const TOTAL_LAYANAN = MASTER_LAYANAN.length;

if (TOTAL_LAYANAN !== 33) {
    throw new Error(`Master layanan harus berjumlah 33, ditemukan ${TOTAL_LAYANAN}.`);
}

export function getMasterLayananByUrutan(urutan: number) {
    return MASTER_LAYANAN.find((layanan) => layanan.urutan === urutan);
}

export function getMasterLayananByNama(nama: string) {
    const normalized = nama.trim().toLocaleUpperCase("id-ID");
    return MASTER_LAYANAN.find((layanan) => layanan.nama.toLocaleUpperCase("id-ID") === normalized);
}

export function getWorkflowStep(tahap: number) {
    return MASTER_WORKFLOW.find((step) => step.tahap === tahap);
}