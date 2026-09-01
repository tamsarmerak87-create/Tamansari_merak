import nextDynamic from "next/dynamic";
import { LayananCatalog } from "@/app/layanan/layanan-catalog";
import { publicRepository } from "@/services/repository";

export const dynamic = "force-dynamic";

const LayananExperience = nextDynamic(() => import("@/app/layanan/layanan-catalog").then((mod) => mod.LayananCatalog), {
    ssr: true,
});

export default async function LayananPage() {
    const layanan = await publicRepository.getServices();

    return (
        <main className="min-h-screen overflow-hidden bg-[#F7F9FC] text-slate-900">
            <LayananExperience services={layanan} />
        </main>
    );
}