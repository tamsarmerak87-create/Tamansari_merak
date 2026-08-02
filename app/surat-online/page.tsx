import Link from "next/link";
import { ArrowRight, FileCheck2, FileText, Send } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { services } from "@/constants/site";

const letters = services.filter((item) => item.category === "administrasi");

export default function SuratOnlinePage() {
    return <main className="mesh-bg min-h-screen overflow-hidden"><PageHero eyebrow="Surat online" title="Ajukan surat administrasi tanpa antre panjang." description="Pilih jenis surat, siapkan KTP/KK, formulir, dan dokumen pendukung. Kanal ini mengarahkan warga ke kontak resmi kelurahan untuk proses pengajuan." actions={[{ label: "Pilih jenis surat", href: "#jenis", icon: FileText }, { label: "Hubungi petugas", href: "/kontak", icon: Send }]} /><Section id="jenis" className="pt-8" eyebrow="Jenis surat" title="Dokumen administrasi yang tersedia"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{letters.map((item) => <GlassCard key={item.id} className="rounded-[2rem] p-6"><div className="grid size-12 place-items-center rounded-2xl bg-gov-950 text-white"><FileCheck2 size={22} /></div><h2 className="mt-5 font-display text-2xl font-black text-gov-950">{item.title}</h2><p className="mt-3 leading-7 text-slate-650">{item.description}</p><ul className="mt-4 space-y-1 text-sm font-bold text-slate-650">{item.requirements.map((req) => <li key={req}>- {req}</li>)}</ul><Link href="/kontak" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gov-950 px-5 py-3 text-sm font-black text-white">Ajukan via petugas <ArrowRight size={16} /></Link></GlassCard>)}</div></Section></main>;
}