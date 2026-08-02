import Link from "next/link";
import { Camera, Images } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { Section } from "@/components/ui/section";
import { gallery } from "@/constants/site";

export default function GaleriPage() {
    return <main className="mesh-bg min-h-screen overflow-hidden"><PageHero eyebrow="Galeri" title="Dokumentasi kegiatan Kelurahan Tamansari." description="Ruang visual untuk melihat dokumentasi pelayanan, kegiatan warga, dan aktivitas resmi kelurahan." actions={[{ label: "Kirim dokumentasi", href: "/kontak", icon: Camera }, { label: "Baca berita", href: "/berita", icon: Images }]} /><Section className="pt-8" eyebrow="Album publik" title="Momen kegiatan warga"><div className="columns-1 gap-5 md:columns-2 xl:columns-3">{gallery.map((item, index) => <figure key={item.id} className="glass mb-5 break-inside-avoid overflow-hidden rounded-[2rem] shadow-soft"><div className={index % 3 === 0 ? "h-80 bg-cover bg-center" : "h-64 bg-cover bg-center"} style={{ backgroundImage: `url(${item.src})` }} /><figcaption className="flex items-center justify-between gap-3 p-5"><span className="font-display text-xl font-black text-gov-950">{item.title}</span><Link href="/kontak" className="rounded-full bg-gov-950 px-4 py-2 text-xs font-black text-white">Info</Link></figcaption></figure>)}</div></Section></main>;
}