import Link from "next/link";
import { BellRing, CalendarDays, MapPin } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { agenda } from "@/constants/site";

export default function AgendaPage() {
    return <main className="mesh-bg min-h-screen overflow-hidden"><PageHero eyebrow="Agenda" title="Jadwal layanan dan kegiatan warga." description="Pantau agenda resmi kelurahan agar tidak melewatkan pelayanan administrasi, konsultasi POSBANKUM, dan kegiatan komunitas." actions={[{ label: "Ingatkan via kontak", href: "/kontak", icon: BellRing }, { label: "Lihat berita", href: "/berita", icon: CalendarDays }]} /><Section className="pt-8" eyebrow="Kalender publik" title="Agenda terdekat"><div className="grid gap-5 lg:grid-cols-2">{agenda.map((item) => <GlassCard key={item.id} className="rounded-[2rem] p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid size-20 place-items-center rounded-[1.5rem] bg-gov-950 text-center text-white"><CalendarDays size={28} /></div><div><p className="text-xs font-black uppercase tracking-[0.22em] text-accent-700">{new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date(item.date))}</p><h2 className="mt-2 font-display text-3xl font-black text-gov-950">{item.title}</h2><p className="mt-2 flex items-center gap-2 font-bold text-slate-650"><MapPin size={17} /> {item.location}</p></div></div><Link href="/kontak" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gov-950 px-5 py-3 text-sm font-black text-white">Konfirmasi agenda <BellRing size={16} /></Link></GlassCard>)}</div></Section></main>;
}