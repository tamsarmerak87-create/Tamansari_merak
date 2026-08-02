import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { InfoCard, PageHero } from "@/components/common/page-shell";
import { Section } from "@/components/ui/section";
import { site } from "@/constants/site";

export default function KontakPage() {
    return <main className="mesh-bg min-h-screen overflow-hidden"><PageHero eyebrow="Kontak resmi" title="Terhubung langsung dengan Kelurahan Tamansari." description={`${site.address}. Gunakan kanal resmi untuk layanan surat, pengaduan, POSBANKUM, agenda, dan informasi warga.`} actions={[{ label: "Chat WhatsApp", href: site.wa, icon: MessageCircle, external: true }, { label: "Telepon", href: `tel:${site.phone}`, icon: Phone, external: true }, { label: "Email", href: `mailto:${site.email}`, icon: Mail, external: true }]} /><Section className="pt-8" eyebrow="Kanal layanan" title="Kontak yang bisa langsung digunakan"><div className="grid gap-5 md:grid-cols-3"><InfoCard icon={Phone} title="Telepon">{site.phone}</InfoCard><InfoCard icon={Mail} title="Email">{site.email}</InfoCard><InfoCard icon={MapPin} title="Alamat">{site.address}</InfoCard></div></Section></main>;
}