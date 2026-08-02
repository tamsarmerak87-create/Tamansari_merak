import { HelpCircle, Mail, MessageCircle } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { site } from "@/constants/site";

const faqs = [
    ["Bagaimana mengajukan surat online?", "Buka halaman Surat Online, pilih jenis surat, siapkan KTP/KK, formulir, dan dokumen pendukung, lalu kirim melalui kanal resmi."],
    ["Berapa lama proses administrasi?", "Informasi layanan tersedia pada katalog resmi setelah berkas dinyatakan lengkap oleh petugas."],
    ["Bagaimana mengirim pengaduan?", "Gunakan halaman Pengaduan untuk melihat kanal laporan resmi, lalu kirim identitas, deskripsi masalah, dan foto atau lokasi jika tersedia."],
    ["Apa itu POSBANKUM?", "POSBANKUM adalah kanal konsultasi dan bantuan hukum warga melalui booking topik konsultasi serta tindak lanjut resmi."],
    ["Apakah semua tombol aktif?", "Ya. Tombol mengarah ke route internal, WhatsApp, telepon, atau email resmi Kelurahan Tamansari."],
];

export default function FaqPage() {
    return <main className="mesh-bg min-h-screen overflow-hidden"><PageHero eyebrow="FAQ" title="Jawaban cepat untuk layanan warga." description="Pertanyaan yang paling sering ditanyakan warga tentang surat, pengaduan, POSBANKUM, dan kontak resmi kelurahan." actions={[{ label: "Chat WhatsApp", href: site.wa, icon: MessageCircle, external: true }, { label: "Email kelurahan", href: `mailto:${site.email}`, icon: Mail, external: true }]} /><Section className="pt-8" eyebrow="Pusat bantuan" title="Informasi ringkas dan resmi"><div className="grid gap-5 lg:grid-cols-2">{faqs.map(([q, a]) => <GlassCard key={q} className="rounded-[2rem] p-6"><HelpCircle className="text-accent-700" /><h2 className="mt-4 font-display text-2xl font-black text-gov-950">{q}</h2><p className="mt-3 leading-7 text-slate-650">{a}</p></GlassCard>)}</div></Section></main>;
}