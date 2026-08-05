import { publicRepository } from "@/services/repository";

export default async function TestPage() {
    const layanan = await publicRepository.getServices();

    return (
        <div style={{ padding: 20 }}>
            <h1>Total Layanan: {layanan.length}</h1>

            <pre>{JSON.stringify(layanan, null, 2)}</pre>
        </div>
    );
}