import type { AgendaItem, GalleryItem, NewsItem, Statistic } from "@/types";

export const site = {
    name: "Kelurahan Tamansari",
    district: "Kecamatan Pulomerak",
    city: "Kota Cilegon",
    phone: "+62 851-3525-9609",
    email: "kelurahan.tamansari@cilegon.go.id",
    address: "Tamansari, Pulomerak, Kota Cilegon, Banten",
    wa: "https://wa.me/6285135259609",
};

export const statistics: Statistic[] = [
    { label: "Jumlah Penduduk", value: 12840 },
    { label: "Kartu Keluarga", value: 3420 },
    { label: "RT", value: 32 },
    { label: "RW", value: 8 },
    { label: "Surat Hari Ini", value: 47 },
    { label: "Pengaduan Aktif", value: 12 },
];


export const news: NewsItem[] = [
    { id: "1", title: "Transformasi Pelayanan Digital Tamansari", category: "Pemerintahan", excerpt: "Kelurahan mempercepat layanan surat, pengaduan, dan POSBANKUM berbasis kanal digital.", date: "2026-08-02", image: "/assets/berita-1.jpg" },
    { id: "2", title: "Kegiatan Kebersihan Lingkungan RW", category: "Lingkungan", excerpt: "Kolaborasi warga memperkuat lingkungan bersih, sehat, dan responsif terhadap aduan.", date: "2026-07-28", image: "/assets/berita-2.jpg" },
    { id: "3", title: "Sosialisasi Bantuan Hukum Warga", category: "POSBANKUM", excerpt: "Warga dapat melakukan booking konsultasi awal melalui kanal layanan resmi.", date: "2026-07-20", image: "/assets/berita-3.jpg" },
];

export const agenda: AgendaItem[] = [
    { id: "a1", title: "Pelayanan Administrasi Keliling", date: "2026-08-06", location: "Balai RW 03", reminder: true },
    { id: "a2", title: "Konsultasi POSBANKUM", date: "2026-08-09", location: "Kantor Kelurahan", reminder: true },
];

export const gallery: GalleryItem[] = [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), title: `Dokumentasi Tamansari ${n}`, type: "photo", src: `/assets/galeri-${n}.jpg` }));
