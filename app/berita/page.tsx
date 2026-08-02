import Link from "next/link";
import { ArrowRight, CalendarDays, Newspaper } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { news } from "@/constants/site";

export default function BeritaPage() {
    return <main className="mesh-bg min-h-screen overflow-hidden"><PageHero eyebrow="Berita" title="Kabar terbaru pelayanan dan kegiatan Tamansari." description="Ikuti informasi resmi seputar transformasi pelayanan digital, lingkungan, dan POSBANKUM Kelurahan Tamansari." actions={[{ label: "Lihat agenda", href: "/agenda", icon: CalendarDays }, { label: "Hubungi redaksi", href: "/kontak", icon: Newspaper }]} /><Section className="pt-8" eyebrow="Rilis resmi" title="Berita pilihan kelurahan"><div className="grid gap-5 md:grid-cols-3">{news.map((item) => <GlassCard key={item.id} className="overflow-hidden rounded-[2rem] p-0"><div className="h-56 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.28)),url(${item.image})` }} /><div className="p-6"><p className="text-xs font-black uppercase tracking-[0.22em] text-accent-700">{item.category} - {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(item.date))}</p><h2 className="mt-3 font-display text-2xl font-black text-gov-950">{item.title}</h2><p className="mt-3 leading-7 text-slate-650">{item.excerpt}</p><Link href="/kontak" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-gov-900">Minta informasi <ArrowRight size={16} /></Link></div></GlassCard>)}</div></Section></main>;
}