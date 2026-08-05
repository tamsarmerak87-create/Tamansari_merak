import { publicRepository } from "@/services/repository";
import SuratOnlineClient from "./surat-online-client";

export default async function SuratOnlinePage() {
    const services = await publicRepository.getServices();

    return <SuratOnlineClient services={services} />;
}
