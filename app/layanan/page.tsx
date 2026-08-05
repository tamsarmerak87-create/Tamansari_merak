import { FileText, MessageSquareText } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { LayananCatalog } from "@/app/layanan/layanan-catalog";
import { publicRepository } from "@/services/repository";

export default async function LayananPage() {
    const layanan = await publicRepository.getServices();

    return (
        <main className="mesh-bg min-h-screen overflow-hidden">
            <PageHero eyebrow="Layanan warga" title="Semua kanal pelayanan dalam satu portal resmi." description="Pilih layanan administrasi, pengaduan, atau bantuan hukum. Setiap kartu berisi syarat dan tombol pengajuan yang langsung aktif." actions={[{ label: "Buka Surat Online", href: "/surat-online", icon: FileText }, { label: "Kirim Pengaduan", href: "/pengaduan", icon: MessageSquareText }]} />
            <LayananCatalog services={layanan} />
        </main>
    );
}