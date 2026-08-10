import Image from "next/image";
import { HomeHero } from "@/components/hero/home-hero";
import { ServicesCarousel } from "@/components/services/services-carousel";
import { publicRepository } from "@/services/repository";
import { MotionShell } from "@/components/common/motion-shell";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/card";
import { Camera, Headset, Images, MapPin, Star } from "lucide-react";

const documentationPhotos = [
    { src: "/assets/kantor-tamansari.jpg", title: "Kantor Kelurahan Tamansari", text: "Pusat pelayanan administrasi dan koordinasi kewilayahan Kelurahan Tamansari." },
    { src: "/assets/whatsapp image 2026-07-07 at 15.07.16.jpeg", title: "Dokumentasi Pelayanan Warga", text: "Aktivitas pelayanan dan pendampingan informasi untuk masyarakat Tamansari." },
    { src: "/assets/whatsapp image 2026-07-07 at 15.08.57.jpeg", title: "Kegiatan Kelurahan", text: "Dokumentasi kegiatan pemerintahan dan kemasyarakatan di wilayah Tamansari." },
];

const activityGallery = [
    { src: "/assets/galeri-1.jpg", label: "Pelayanan administrasi" },
    { src: "/assets/galeri-2.jpg", label: "Koordinasi kewilayahan" },
    { src: "/assets/galeri-3.jpg", label: "Kegiatan masyarakat" },
    { src: "/assets/galeri-4.jpg", label: "Pemberdayaan warga" },
    { src: "/assets/galeri-5.jpg", label: "Agenda kelurahan" },
    { src: "/assets/galeri-6.jpg", label: "Dokumentasi lapangan" },
];

export default async function HomePage() {
    const services = await publicRepository.getServices();

    return (
        <main id="top" className="premium-shell min-h-screen overflow-hidden">
            <HomeHero />
            <ServicesCarousel services={services} />

            {/* Dokumentasi */}
            <section id="dokumentasi" className="mx-auto max-w-[1320px] px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
                <MotionShell>
                    <div className="mx-auto mb-10 max-w-3xl text-center">
                        <Badge><Camera className="h-4 w-4" /> Dokumentasi Kelurahan Tamansari</Badge>
                        <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-gov-900 sm:text-4xl lg:text-5xl">Wajah pelayanan dan aktivitas Kelurahan Tamansari.</h2>
                        <p className="mt-4 text-base leading-7 text-slate-650 sm:text-lg sm:leading-8">Dokumentasi resmi menggunakan foto nyata dari portal untuk memperlihatkan kantor, layanan, dan kegiatan kewilayahan.</p>
                    </div>
                </MotionShell>
                <div className="grid gap-5 lg:grid-cols-3">
                    {documentationPhotos.map((item, index) => (
                        <MotionShell key={item.src} delay={index * 0.08}>
                            <GlassCard className="group h-full overflow-hidden border border-white bg-white/90 p-2">
                                <div className="relative h-64 overflow-hidden rounded-[20px] sm:h-72">
                                    <Image src={item.src} alt={item.title} fill loading="lazy" sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gov-950/55 via-gov-950/8 to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4 text-white">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-200">Dokumentasi</p>
                                        <h3 className="mt-1.5 text-xl font-extrabold sm:text-2xl">{item.title}</h3>
                                    </div>
                                </div>
                                <p className="p-4 text-sm leading-7 text-slate-650">{item.text}</p>
                            </GlassCard>
                        </MotionShell>
                    ))}
                </div>
            </section>

            {/* Galeri Kegiatan */}
            <section id="galeri-kegiatan" className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
                <MotionShell>
                    <div className="relative overflow-hidden rounded-[28px] border border-accent-200/50 bg-white/80 p-5 shadow-soft backdrop-blur-xl sm:rounded-[32px] sm:p-7">
                        <div className="absolute -right-14 -top-14 h-56 w-56 rounded-full bg-gov-100/25 blur-3xl" />
                        <div className="relative mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <Badge><Images className="h-4 w-4" /> Galeri Kegiatan</Badge>
                                <h2 className="mt-5 text-2xl font-extrabold text-gov-900 sm:text-4xl lg:text-5xl">Ruang arsip visual kegiatan warga.</h2>
                            </div>
                            <p className="max-w-xl text-sm leading-7 text-slate-650 sm:text-base sm:leading-8">Galeri kegiatan beranda menampilkan dokumentasi pelayanan, koordinasi, pemberdayaan, dan agenda masyarakat Tamansari.</p>
                        </div>
                        <div className="relative grid auto-rows-[200px] gap-3 md:grid-cols-4">
                            {activityGallery.map((item, index) => (
                                <div key={item.src} className={index === 0 || index === 5 ? "group relative overflow-hidden rounded-[20px] md:col-span-2" : "group relative overflow-hidden rounded-[20px]"}>
                                    <Image src={item.src} alt={item.label} fill loading="lazy" sizes="(min-width: 768px) 25vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gov-950/50 via-transparent to-transparent" />
                                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-sm font-bold text-white"><MapPin className="h-4 w-4 text-green-200" /> {item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </MotionShell>
            </section>

            {/* TAMSAR CS */}
            <section id="chat" className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
                <MotionShell>
                    <div className="relative overflow-hidden rounded-[28px] bg-gov-900 p-7 text-white shadow-glass sm:rounded-[32px] sm:p-10 lg:p-12">
                        <div className="absolute right-0 top-0 h-72 w-72 translate-x-1/3 -translate-y-1/3 rounded-full bg-accent-400/20 blur-3xl" />
                        <div className="absolute bottom-0 left-0 h-60 w-60 -translate-x-1/4 translate-y-1/4 rounded-full bg-gov-500/15 blur-3xl" />
                        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-bold text-accent-200 ring-1 ring-white/15"><Star size={16} /> TAMSAR CS</span>
                                <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">Customer service digital untuk menemukan layanan lebih cepat.</h2>
                                <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">Bantuan informasi layanan, alur pengajuan, dokumen persyaratan, dan kontak cepat Kelurahan Tamansari.</p>
                            </div>
                            <div className="grid size-24 place-items-center rounded-[24px] bg-accent-400 text-gov-900 shadow-gold sm:size-28 sm:rounded-[28px]"><Headset size={44} /></div>
                        </div>
                    </div>
                </MotionShell>
            </section>
        </main>
    );
}
