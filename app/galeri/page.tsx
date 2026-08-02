import Image from "next/image";
import Link from "next/link";
import { Camera, Images } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { Section } from "@/components/ui/section";
import { gallery } from "@/constants/site";

export default function GaleriPage() {
    return (
        <main className="mesh-bg min-h-screen overflow-hidden">
            <PageHero
                eyebrow="Galeri"
                title="Dokumentasi kegiatan Kelurahan Tamansari."
                description="Ruang visual untuk melihat dokumentasi pelayanan, kegiatan warga, dan aktivitas resmi kelurahan."
                actions={[
                    { label: "Kirim dokumentasi", href: "/kontak", icon: Camera },
                    { label: "Baca berita", href: "/berita", icon: Images },
                ]}
                image={{ src: "/assets/galeri-1.jpg", alt: "Dokumentasi kegiatan Kelurahan Tamansari" }}
            />
            <Section className="pt-8" eyebrow="Album publik" title="Momen kegiatan warga">
                <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
                    {gallery.map((item, index) => (
                        <figure key={item.id} className="glass group mb-5 break-inside-avoid overflow-hidden rounded-[2rem] shadow-soft transition hover:-translate-y-2 hover:shadow-gold">
                            <div className={index % 3 === 0 ? "relative h-80" : "relative h-64"}>
                                <Image src={item.src} alt={item.title} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" />
                                <div className="absolute inset-0 bg-gradient-to-t from-gov-950/35 via-transparent to-transparent" />
                            </div>
                            <figcaption className="flex items-center justify-between gap-3 p-5">
                                <span className="font-display text-xl font-black text-gov-950">{item.title}</span>
                                <Link href="/kontak" className="rounded-full bg-gov-950 px-4 py-2 text-xs font-black text-white">Info</Link>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </Section>
        </main>
    );
}