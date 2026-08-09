import { PetugasPortal } from "@/components/petugas/petugas-portal";
export default function Page({ params }: { params: { id: string } }) { return <PetugasPortal view="detail" id={params.id} />; }