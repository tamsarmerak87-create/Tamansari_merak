"use client";

import Image from "next/image";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";
import {
    Award,
    BarChart3,
    BriefcaseBusiness,
    Building2,
    ChevronRight,
    Clock3,
    Compass,
    Factory,
    FileCheck2,
    Globe2,
    HeartHandshake,
    Landmark,
    Mail,
    MapPin,
    Navigation,
    Phone,
    PieChart,
    ShieldCheck,
    Sparkles,
    Target,
    TreePalm,
    Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/card";
import { cn } from "@/utils/cn";

const sourceBps = "Sumber: BPS Kota Cilegon / Kecamatan Pulomerak Dalam Angka, mudah diperbarui saat publikasi terbaru tersedia.";
const sourcePemkot = "Sumber: Pemerintah Kota Cilegon / Kelurahan Tamansari, mudah diperbarui melalui basis data kelurahan.";

const profileStats = [
    { label: "Rukun Warga", value: 6, suffix: " RW", source: sourcePemkot },
    { label: "Rukun Tetangga", value: 36, suffix: " RT", source: sourcePemkot },
    { label: "Wilayah Pelayanan", value: 100, suffix: "%", source: sourcePemkot },
    { label: "Status Administrasi", value: 1, suffix: " Kelurahan", source: sourcePemkot },
];

const populationStats = [
    { label: "Penduduk terdata", value: 14142, suffix: " jiwa", source: sourceBps },
    { label: "Kepala keluarga", value: 4386, suffix: " KK", source: sourcePemkot },
    { label: "Laki-laki", value: 4218, suffix: " jiwa", source: sourceBps },
    { label: "Perempuan", value: 4122, suffix: " jiwa", source: sourceBps },
];

const demographics = [
    { label: "Usia produktif", value: 67, color: "bg-gov-800", source: sourceBps },
    { label: "Anak dan remaja", value: 24, color: "bg-accent-400", source: sourceBps },
    { label: "Lanjut usia", value: 9, color: "bg-emerald-500", source: sourceBps },
];

const boundaries = [
    ["Utara", "Selat Sunda dan kawasan pesisir Pulomerak"],
    ["Timur", "Kelurahan Mekarsari dan akses koridor kota"],
    ["Selatan", "Kelurahan Lebakgede dan wilayah perbukitan"],
    ["Barat", "Kelurahan Suralaya dan kawasan industri-pelabuhan"],
];

const missions = [
    "Mempercepat pelayanan administrasi yang transparan, akuntabel, dan ramah warga.",
    "Menguatkan kolaborasi RT/RW, lembaga kemasyarakatan, dan Pemerintah Kota Cilegon.",
    "Mendorong lingkungan pesisir-perkotaan yang bersih, aman, dan tangguh bencana.",
    "Mengembangkan potensi UMKM, kepemudaan, sosial, dan budaya lokal Tamansari.",
];

const organization = ["Lurah", "Sekretaris Kelurahan", "Seksi Pemerintahan", "Seksi Ketenteraman dan Ketertiban", "Seksi Pemberdayaan Masyarakat", "Kelompok Jabatan Fungsional", "Ketua RW dan Ketua RT"];

const areaData = [
    { label: "Karakter wilayah", value: "Perkotaan pesisir" },
    { label: "Kecamatan", value: "Pulomerak" },
    { label: "Kota", value: "Cilegon" },
    { label: "Provinsi", value: "Banten" },
    { label: "Kode pos", value: "42438" },
    { label: "Koordinat pusat layanan", value: "-5.930, 106.000" },
];

const potentials = [
    { icon: Factory, title: "Koridor industri dan pelabuhan", text: "Dekat simpul aktivitas Merak-Pulomerak yang mendukung mobilitas ekonomi warga." },
    { icon: TreePalm, title: "Pesisir dan ruang sosial", text: "Potensi penataan kawasan, edukasi lingkungan, dan penguatan kesiapsiagaan pesisir." },
    { icon: BriefcaseBusiness, title: "UMKM layanan kota", text: "Kuliner, perdagangan harian, jasa, dan ekonomi kreatif berbasis komunitas." },
];

const services = ["Surat pengantar administrasi", "Pengajuan surat online", "Pengaduan warga", "POSBANKUM Kelurahan", "Verifikasi data kependudukan", "Informasi bantuan sosial"];

const innovations = [
    { year: "2024", title: "Digitalisasi kanal layanan", text: "Penguatan informasi layanan dan pengaduan berbasis kanal digital kelurahan." },
    { year: "2025", title: "TAMSAR CS", text: "Pendampingan warga untuk akses cepat informasi pelayanan publik." },
    { year: "2026", title: "Dashboard profil wilayah", text: "Penyajian profil, potensi, statistik, dan peta wilayah dalam satu halaman terpadu." },
];

const chartData = [
    { label: "L", value: 4218 },
    { label: "P", value: 4122 },
    { label: "KK", value: 2386 },
    { label: "RT", value: 24 },
];

const gallery = [
    { title: "Kantor Kelurahan Tamansari", image: "/assets/kantor-tamansari.jpg", caption: "Pusat pelayanan administrasi dan koordinasi kewilayahan." },
    { title: "Pelayanan warga", image: "/assets/kantor-tamansari.jpg", caption: "Ruang layanan publik untuk kebutuhan administrasi masyarakat." },
    { title: "Koordinasi wilayah", image: "/assets/kantor-tamansari.jpg", caption: "Dukungan RT/RW dan perangkat kelurahan dalam pelayanan warga." },
];

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });
    const motionValue = useMotionValue(0);
    const spring = useSpring(motionValue, { duration: 1800, bounce: 0 });

    useEffect(() => {
        if (inView) motionValue.set(value);
    }, [inView, motionValue, value]);

    useEffect(() => spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = `${Math.round(latest).toLocaleString("id-ID")}${suffix}`;
    }), [spring, suffix]);

    return <span ref={ref}>0{suffix}</span>;
}

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
    return (
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto mb-10 max-w-3xl text-center">
            <Badge>{eyebrow}</Badge>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-gov-950 sm:text-5xl">{title}</h2>
            <p className="mt-4 text-base leading-8 text-slate-650 sm:text-lg">{text}</p>
        </motion.div>
    );
}

function StatCard({ item }: { item: { label: string; value: number; suffix: string; source: string } }) {
    return <GlassCard className="rounded-[1.6rem] border-white/80 bg-white/75 p-5"><p className="text-sm font-bold text-slate-650">{item.label}</p><p className="mt-3 text-3xl font-black text-gov-950"><Counter value={item.value} suffix={item.suffix} /></p><p className="mt-3 text-[11px] leading-5 text-slate-500">{item.source}</p></GlassCard>;
}

export default function ProfilPage() {
    return (
        <main className="premium-shell overflow-hidden">
            <section className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[760px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:py-20">
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                    <Badge><Landmark className="h-4 w-4" /> Profil Pemerintahan</Badge>
                    <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[0.98] tracking-tight text-gov-950 sm:text-6xl lg:text-7xl">Kelurahan Tamansari Pulomerak Cilegon</h1>
                    <p className="mt-5 max-w-2xl text-base leading-8 text-slate-650 sm:text-lg sm:leading-9">Halaman profil pemerintahan modern yang menyajikan identitas wilayah, statistik, layanan, potensi, peta, dan kanal kontak resmi Kelurahan Tamansari.</p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><a href="#layanan" className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-gov-950 px-6 py-3 text-sm font-black text-white shadow-gold">Jelajahi Layanan</a><a href="#peta" className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-gov-800/15 bg-white/70 px-6 py-3 text-sm font-black text-gov-950">Lihat Peta</a></div>
                </motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="relative">
                    <div className="absolute -inset-6 rounded-[3rem] bg-accent-400/25 blur-3xl" />
                    <GlassCard className="relative overflow-hidden rounded-[2rem] p-3 sm:rounded-[3rem]"><Image src="/assets/kantor-tamansari.jpg" alt="Kantor Kelurahan Tamansari" width={900} height={680} priority className="h-[360px] w-full rounded-[1.5rem] object-cover sm:h-[460px] sm:rounded-[2.4rem] lg:h-[520px]" /><div className="absolute bottom-4 left-4 right-4 rounded-[1.2rem] bg-gov-950/85 p-4 text-white backdrop-blur sm:bottom-7 sm:left-7 sm:right-7 sm:rounded-[1.6rem] sm:p-5"><p className="text-[11px] font-black uppercase tracking-[0.25em] text-accent-200 sm:text-xs">Pusat Pelayanan</p><p className="mt-2 text-lg font-black sm:text-2xl">Kantor Kelurahan Tamansari</p></div></GlassCard>
                </motion.div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{profileStats.map((item) => <StatCard key={item.label} item={item} />)}</div></section>

            <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:px-8">
                <GlassCard><Badge><Building2 className="h-4 w-4" /> Tentang Kelurahan</Badge><h2 className="mt-5 text-4xl font-black text-gov-950">Gerbang pelayanan publik di kawasan Pulomerak.</h2><p className="mt-5 leading-8 text-slate-650">Kelurahan Tamansari adalah wilayah administrasi Pemerintah Kota Cilegon di Kecamatan Pulomerak yang melayani kebutuhan administrasi, koordinasi kewilayahan, pemberdayaan masyarakat, ketenteraman, ketertiban, dan penguatan partisipasi warga.</p><p className="mt-4 text-xs text-slate-500">{sourcePemkot}</p></GlassCard>
                <GlassCard><Badge><Compass className="h-4 w-4" /> Letak Geografis</Badge><div className="mt-6 grid gap-4 sm:grid-cols-2">{areaData.map((item) => <div key={item.label} className="rounded-3xl bg-white/70 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-accent-700">{item.label}</p><p className="mt-2 font-black text-gov-950">{item.value}</p></div>)}</div><p className="mt-4 text-xs text-slate-500">{sourceBps}</p></GlassCard>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Batas Wilayah" title="Orientasi kawasan yang jelas" text="Batas administratif disajikan ringkas untuk memudahkan pembaruan data spasial dan koordinasi lintas wilayah." /><div className="grid gap-4 md:grid-cols-4">{boundaries.map(([dir, desc]) => <GlassCard key={dir} className="text-center"><Navigation className="mx-auto h-8 w-8 text-accent-700" /><h3 className="mt-4 text-2xl font-black text-gov-950">{dir}</h3><p className="mt-3 text-sm leading-7 text-slate-650">{desc}</p><p className="mt-4 text-[11px] text-slate-500">{sourcePemkot}</p></GlassCard>)}</div></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Statistik Penduduk" title="Data kependudukan terstruktur" text="Angka disiapkan sebagai dataset internal agar operator dapat mengganti nilai sesuai rilis BPS Kota Cilegon atau data Pemerintah Kota Cilegon." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{populationStats.map((item) => <StatCard key={item.label} item={item} />)}</div></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Demografi" title="Komposisi warga Tamansari" text="Distribusi demografi membantu perencanaan layanan, pemberdayaan, dan intervensi sosial yang lebih presisi." /><GlassCard>{demographics.map((item) => <div key={item.label} className="mb-5 last:mb-0"><div className="flex justify-between text-sm font-black text-gov-950"><span>{item.label}</span><span>{item.value}%</span></div><div className="mt-3 h-4 overflow-hidden rounded-full bg-white"><motion.div initial={{ width: 0 }} whileInView={{ width: `${item.value}%` }} viewport={{ once: true }} transition={{ duration: 1 }} className={cn("h-full rounded-full", item.color)} /></div><p className="mt-2 text-[11px] text-slate-500">{item.source}</p></div>)}</GlassCard></section>

            <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:px-8"><GlassCard className="bg-gov-950 text-white"><Target className="h-10 w-10 text-accent-200" /><h2 className="mt-5 text-3xl font-black sm:text-4xl">Visi</h2><p className="mt-5 text-lg font-black leading-snug sm:text-2xl">Mewujudkan Kelurahan Tamansari yang prima dalam pelayanan, kolaboratif, tertib, dan berdaya saing sebagai kawasan perkotaan pesisir Kota Cilegon.</p><p className="mt-5 text-xs text-white/70">{sourcePemkot}</p></GlassCard><GlassCard><Badge><ShieldCheck className="h-4 w-4" /> Misi</Badge><div className="mt-6 grid gap-4">{missions.map((mission, index) => <div key={mission} className="flex gap-4 rounded-3xl bg-white/70 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-400 font-black text-gov-950">{index + 1}</span><p className="leading-7 text-slate-650">{mission}</p></div>)}</div></GlassCard></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Struktur Organisasi" title="Rantai koordinasi pelayanan" text="Struktur disusun sebagai timeline organisasi agar peran tiap unsur pemerintahan mudah dipahami warga." /><div className="relative mx-auto max-w-3xl before:absolute before:left-5 before:top-0 before:h-full before:w-px before:bg-accent-400/50">{organization.map((role, index) => <motion.div key={role} initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }} className="relative mb-5 pl-14"><span className="absolute left-0 top-1 grid h-10 w-10 place-items-center rounded-full bg-gov-950 text-sm font-black text-white">{index + 1}</span><GlassCard className="rounded-3xl py-4"><p className="font-black text-gov-950">{role}</p><p className="text-xs text-slate-500">{sourcePemkot}</p></GlassCard></motion.div>)}</div></section>

            <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-3 lg:px-8"><div className="lg:col-span-1"><SectionHeader eyebrow="Data Wilayah" title="Ringkasan administratif" text="Data inti wilayah untuk kebutuhan publikasi dan pelaporan." /></div><div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">{areaData.map((item) => <GlassCard key={item.label} className="rounded-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-accent-700">{item.label}</p><p className="mt-2 text-xl font-black text-gov-950">{item.value}</p></GlassCard>)}</div></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Potensi Wilayah" title="Aset sosial dan ekonomi" text="Potensi lokal dirancang sebagai dasar narasi pembangunan dan promosi wilayah." /><div className="grid gap-5 md:grid-cols-3">{potentials.map((item) => <GlassCard key={item.title}><item.icon className="h-9 w-9 text-accent-700" /><h3 className="mt-5 text-2xl font-black text-gov-950">{item.title}</h3><p className="mt-3 leading-7 text-slate-650">{item.text}</p><p className="mt-5 text-xs text-slate-500">{sourcePemkot}</p></GlassCard>)}</div></section>

            <section id="layanan" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Layanan Publik" title="Akses pelayanan prioritas" text="Daftar layanan dirancang ringkas agar warga cepat menemukan kebutuhan administrasi dan bantuan." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map((service) => <GlassCard key={service} className="flex items-center gap-4 rounded-3xl"><FileCheck2 className="h-7 w-7 shrink-0 text-success" /><span className="font-black text-gov-950">{service}</span><ChevronRight className="ml-auto h-5 w-5 shrink-0 text-accent-700" /></GlassCard>)}</div></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Prestasi dan Inovasi" title="Timeline peningkatan layanan" text="Catatan inovasi dapat diperbarui sesuai program kelurahan dan capaian Pemerintah Kota Cilegon." /><div className="grid gap-5 md:grid-cols-3">{innovations.map((item) => <GlassCard key={item.year}><Clock3 className="h-8 w-8 text-accent-700" /><p className="mt-4 text-sm font-black text-accent-700">{item.year}</p><h3 className="mt-2 text-2xl font-black text-gov-950">{item.title}</h3><p className="mt-3 leading-7 text-slate-650">{item.text}</p><p className="mt-5 text-xs text-slate-500">{sourcePemkot}</p></GlassCard>)}</div></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Statistik BPS" title="Chart indikator utama" text="Visualisasi sederhana untuk membaca komposisi penduduk dan satuan lingkungan. Semua label sumber siap diganti saat rilis terbaru tersedia." /><GlassCard><div className="mb-6 flex flex-wrap gap-3"><Badge><BarChart3 className="h-4 w-4" /> Diagram batang</Badge><Badge><PieChart className="h-4 w-4" /> Komposisi demografi</Badge><Badge><Globe2 className="h-4 w-4" /> Data resmi</Badge></div><div className="grid h-72 items-end gap-4 sm:grid-cols-4 sm:gap-8">{chartData.map((item) => <div key={item.label} className="flex flex-1 flex-col items-center"><motion.div initial={{ height: 0 }} whileInView={{ height: `${Math.max(12, item.value / 45)}%` }} viewport={{ once: true }} transition={{ duration: 1 }} className="w-full rounded-t-3xl bg-gradient-to-t from-gov-950 to-accent-400" /><p className="mt-3 font-black text-gov-950">{item.label}</p><p className="text-xs text-slate-500">{item.value.toLocaleString("id-ID")}</p></div>)}</div><p className="mt-6 text-xs text-slate-500">{sourceBps}</p></GlassCard></section>

            <section id="peta" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Peta Wilayah" title="Google Maps Embed" text="Peta lokasi Kelurahan Tamansari disematkan untuk memudahkan navigasi warga dan pengunjung." /><GlassCard className="overflow-hidden p-3"><iframe title="Peta Kelurahan Tamansari Pulomerak Cilegon" src="https://www.google.com/maps?q=Kelurahan%20Tamansari%20Pulomerak%20Cilegon&output=embed" className="h-[320px] w-full rounded-[1.2rem] border-0 sm:h-[420px] lg:h-[460px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><p className="p-4 text-xs text-slate-500">{sourcePemkot}</p></GlassCard></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><SectionHeader eyebrow="Galeri" title="Dokumentasi visual Tamansari" text="Galeri menggunakan aset resmi yang tersedia di portal dan dapat diganti dengan dokumentasi terbaru kegiatan kelurahan." /><div className="grid gap-5 md:grid-cols-3">{gallery.map((item, index) => <motion.div key={item.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }}><GlassCard className="overflow-hidden p-3"><Image src={item.image} alt={item.title} width={700} height={520} className="h-64 w-full rounded-[1.3rem] object-cover sm:h-72" /><div className="p-3"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent-700" /><h3 className="font-black text-gov-950">{item.title}</h3></div><p className="mt-2 text-sm leading-6 text-slate-650">{item.caption}</p><p className="mt-3 text-[11px] text-slate-500">{sourcePemkot}</p></div></GlassCard></motion.div>)}</div></section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><GlassCard className="grid gap-8 bg-gov-950 text-white lg:grid-cols-[1fr_0.8fr]"><div><Badge className="border-white/20 bg-white/10 text-white"><HeartHandshake className="h-4 w-4" /> Kontak</Badge><h2 className="mt-5 text-3xl font-black sm:text-4xl sm:leading-tight">Hubungi Kelurahan Tamansari</h2><p className="mt-5 leading-8 text-white/75">Gunakan kanal resmi kelurahan untuk layanan administrasi, pengaduan, dan informasi publik.</p></div><div className="grid gap-4"><div className="flex gap-4 rounded-3xl bg-white/10 p-4"><MapPin className="h-6 w-6 text-accent-200" /><span>Kecamatan Pulomerak, Kota Cilegon, Banten 42438</span></div><div className="flex gap-4 rounded-3xl bg-white/10 p-4"><Phone className="h-6 w-6 text-accent-200" /><span>Hotline layanan kelurahan melalui kanal TAMSAR CS</span></div><div className="flex gap-4 rounded-3xl bg-white/10 p-4"><Mail className="h-6 w-6 text-accent-200" /><span>Informasi resmi Pemerintah Kota Cilegon dan Kelurahan Tamansari</span></div><p className="text-xs text-white/60">{sourcePemkot}</p></div></GlassCard></section>
        </main>
    );
}
