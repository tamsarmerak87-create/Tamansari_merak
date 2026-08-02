import { Camera, MapPin, MessageCircle, Send, TicketCheck } from "lucide-react";
import { InfoCard, PageHero } from "@/components/common/page-shell";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { site } from "@/constants/site";

export default function PengaduanPage() {
    return <main className="mesh-bg min-h-screen overflow-hidden"><PageHero eyebrow="Pengaduan" title="Laporkan masalah lingkungan dan layanan secara tertib." description="Sampaikan identitas, deskripsi laporan, foto, serta lokasi kejadian agar petugas dapat memverifikasi dan menindaklanjuti pengaduan warga." actions={[{ label: "Kirim laporan WhatsApp", href: `${site.wa}?text=Halo%20Kelurahan%20Tamansari,%20saya%20ingin%20mengirim%20pengaduan`, icon: MessageCircle, external: true }, { label: "Kontak resmi", href: "/kontak", icon: Send }]} /><Section className="pt-8" eyebrow="Data laporan" title="Informasi yang mempercepat tindak lanjut"><div className="grid gap-5 md:grid-cols-3"><InfoCard icon={TicketCheck} title="Identitas pelapor">Nama, alamat, dan nomor kontak membantu petugas mengonfirmasi laporan.</InfoCard><InfoCard icon={Camera} title="Bukti visual">Foto kondisi lapangan memperjelas kategori dan prioritas penanganan.</InfoCard><InfoCard icon={MapPin} title="Lokasi kejadian">RT/RW atau titik lokasi memudahkan verifikasi petugas di lapangan.</InfoCard></div><GlassCard className="mt-6 rounded-[2rem] p-6"><p className="font-black text-gov-950">SLA layanan: 3x24 jam untuk verifikasi awal pengaduan aktif.</p></GlassCard></Section></main>;
}