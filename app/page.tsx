import Image from "next/image";
import { HomeHero } from "@/components/hero/home-hero";
import { ServicesCarousel } from "@/components/services/services-carousel";
import { QuickAccess } from "@/components/quick-access/quick-access";
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
            <QuickAccess />
            <section id="dokumentasi" className="mx-auto max-w-[1440px] px-5 py-[60px] sm:px-10 sm:py-[80px] lg:px-20 lg:py-[120px]">
                <MotionShell>
                    <div className="mx-auto mb-10 max-w-3xl text-center">
                        <Badge><Camera className="h-4 w-4" /> Dokumentasi Kelurahan Tamansari</Badge>
                        <h2 className="mt-5 text-balance text-4xl font-black tracking-tight text-gov-950 sm:text-5xl">Wajah pelayanan dan aktivitas Kelurahan Tamansari.</h2>
                        <p className="mt-4 text-lg leading-8 text-slate-650">Dokumentasi resmi menggunakan foto nyata dari portal untuk memperlihatkan kantor, layanan, dan kegiatan kewilayahan.</p>
                    </div>
                </MotionShell>
                <div className="grid gap-5 lg:grid-cols-3">
                    {documentationPhotos.map((item, index) => (
                        <MotionShell key={item.src} delay={index * 0.08}>
                            <GlassCard className="group h-full overflow-hidden p-2">
                                <div className="relative h-72 overflow-hidden rounded-[1.6rem]">
                                    <Image src={item.src} alt={item.title} fill loading="lazy" sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gov-950/76 via-gov-950/10 to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4 text-white">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent-200">Dokumentasi</p>
                                        <h3 className="mt-2 text-2xl font-black">{item.title}</h3>
                                    </div>
                                </div>
                                <p className="p-4 leading-7 text-slate-650">{item.text}</p>
                            </GlassCard>
                        </MotionShell>
                    ))}
                </div>
            </section>

            <section id="galeri-kegiatan" className="mx-auto max-w-[1440px] px-5 pb-[60px] sm:px-10 sm:pb-[80px] lg:px-20 lg:pb-[120px]">
                <MotionShell>
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-white/72 p-6 shadow-glass ring-1 ring-white/80 backdrop-blur-2xl sm:p-8">
                        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-accent-400/25 blur-3xl" />
                        <div className="relative mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <Badge><Images className="h-4 w-4" /> Galeri Kegiatan</Badge>
                                <h2 className="mt-5 text-3xl font-black text-gov-950 sm:text-5xl">Ruang arsip visual kegiatan warga.</h2>
                            </div>
                            <p className="max-w-xl text-base leading-8 text-slate-650">Galeri kegiatan beranda menampilkan dokumentasi pelayanan, koordinasi, pemberdayaan, dan agenda masyarakat Tamansari.</p>
                        </div>
                        <div className="relative grid auto-rows-[210px] gap-4 md:grid-cols-4">
                            {activityGallery.map((item, index) => (
                                <div key={item.src} className={index === 0 || index === 5 ? "group relative overflow-hidden rounded-[1.8rem] md:col-span-2" : "group relative overflow-hidden rounded-[1.8rem]"}>
                                    <Image src={item.src} alt={item.label} fill loading="lazy" sizes="(min-width: 768px) 25vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gov-950/72 via-transparent to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-sm font-black text-white"><MapPin className="h-4 w-4 text-accent-200" /> {item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </MotionShell>
            </section>
            <section id="chat" className="mx-auto max-w-[1440px] px-5 pb-[80px] sm:px-10 sm:pb-[100px] lg:px-20 lg:pb-[120px]">
                <MotionShell>
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-gov-800 p-8 text-white shadow-glass sm:p-10 lg:p-12">
                        <div className="absolute right-0 top-0 h-72 w-72 translate-x-1/3 -translate-y-1/3 rounded-full bg-accent-400/35 blur-3xl" />
                        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-accent-200 ring-1 ring-white/15"><Star size={16} /> TAMSAR CS</span>
                                <h2 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">Customer service digital untuk menemukan layanan lebih cepat.</h2>
                                <p className="mt-4 max-w-2xl text-lg leading-8 text-white/72">Bantuan informasi layanan, alur pengajuan, dokumen persyaratan, dan kontak cepat Kelurahan Tamansari.</p>
                            </div>
                            <div className="grid size-28 place-items-center rounded-[2rem] bg-accent-400 text-gov-950 shadow-gold"><Headset size={48} /></div>
                        </div>
                    </div>
                </MotionShell>
            </section>
        </main>
    );
}