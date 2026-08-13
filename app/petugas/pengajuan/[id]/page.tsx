import { PetugasPortal } from "@/components/petugas/petugas-portal";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <PetugasPortal view="detail" id={id} />;
}