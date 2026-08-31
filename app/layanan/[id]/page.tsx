import { notFound } from "next/navigation";
import { publicRepository } from "@/services/repository";
import SuratOnlineClient from "@/components/pengajuan/surat-online-client";

export const dynamic = "force-dynamic";

export default async function LayananPengajuanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const services = await publicRepository.getServices();
    const selected = services.find((item) => item.id === id && item.online);
    if (!selected) notFound();
    return <SuratOnlineClient services={services} initialServiceId={selected.id} formOnly />;
}