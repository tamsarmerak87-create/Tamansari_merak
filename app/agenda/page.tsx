import Image from "next/image";
import Link from "next/link";
import { BellRing, CalendarDays, MapPin } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { agenda } from "@/constants/site";

const agendaImages = ["/assets/posbankum-2.jpg", "/assets/posbankum-3.jpg"];

export default function AgendaPage() {
    return (
        <main className="mesh-bg min-h-screen overflow-hidden">
            <PageHero
                eyebrow="Agenda"
                title="Jadwal layanan dan kegiatan warga."
                description="Pantau agenda resmi kelurahan agar tidak melewatkan pelayanan administrasi, konsultasi POSBANKUM, dan kegiatan komunitas."
                actions={[
                    { label: "Ingatkan via kontak", href: "/kontak", icon: BellRing },
                    { label: "Lihat berita", href: "/berita", icon: CalendarDays },
                ]}
                image={{ src: "/assets/posbankum-1.jpg", alt: "Dokumentasi agenda pelayanan Kelurahan Tamansari" }}
            />
            <Section className="pt-8" eyebrow="Kalender publik" title="Agenda terdekat">
                <div className="grid gap-5 lg:grid-cols-2">
                    {agenda.map((item, index) => (
                        <GlassCard key={item.id} className="group overflow-hidden rounded-[2rem] p-6 transition hover:-translate-y-2 hover:shadow-gold">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                                <div className="grid size-20 place-items-center rounded-[1.5rem] bg-gov-950 text-center text-white"><CalendarDays size={28} /></div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.22em] text-accent-700">{new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date(item.date))}</p>
                                    <h2 className="mt-2 font-display text-3xl font-black text-gov-950">{item.title}</h2>
                                    <p className="mt-2 flex items-center gap-2 font-bold text-slate-650"><MapPin size={17} /> {item.location}</p>
                                </div>
                            </div>
                            <div className="relative mt-6 h-48 overflow-hidden rounded-[1.5rem]">
                                <Image src={agendaImages[index % agendaImages.length]} alt={item.title} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 50vw, 100vw" />
                            </div>
                            <Link href="/kontak" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gov-950 px-5 py-3 text-sm font-black text-white">Konfirmasi agenda <BellRing size={16} /></Link>
                        </GlassCard>
                    ))}
                </div>
            </Section>
        </main>
    );
}