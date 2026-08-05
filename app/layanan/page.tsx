import { ArrowRight, FileText, MessageSquareText, Scale, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/common/page-shell";
import { MotionShell } from "@/components/common/motion-shell";
import { GlassCard } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { publicRepository } from "@/services/repository";
import type { ServiceCategory } from "@/types";

const categoryMeta = {
    administrasi: { icon: FileText, label: "Administrasi", href: "/surat-online" },
    pengaduan: { icon: MessageSquareText, label: "Pengaduan", href: "/pengaduan" },
    posbankum: { icon: Scale, label: "POSBANKUM", href: "/posbankum" },
};

const fallbackCategory: ServiceCategory = "administrasi";

export default async function LayananPage() {
    const layanan = await publicRepository.getServices();

    return (
        <main className="mesh-bg min-h-screen overflow-hidden">
            <PageHero eyebrow="Layanan warga" title="Semua kanal pelayanan dalam satu portal resmi." description="Pilih layanan administrasi, pengaduan, atau bantuan hukum. Setiap kartu berisi syarat dan tombol pengajuan yang langsung aktif." actions={[{ label: "Buka Surat Online", href: "/surat-online", icon: FileText }, { label: "Kirim Pengaduan", href: "/pengaduan", icon: MessageSquareText }]} />
            <Section className="pt-8" eyebrow="Katalog layanan" title="Kartu layanan digital yang siap dipakai warga">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {layanan.map((service, index) => {
                        const meta = categoryMeta[service.category] ?? categoryMeta[fallbackCategory];
                        const Icon = meta.icon;
                        const requirements = service.requirements.length > 0 ? service.requirements : ["Tidak ada persyaratan."];
                        const flow = service.flow && service.flow.length > 0 ? service.flow : ["Belum tersedia."];
                        const legalBasis = service.legalBasis?.trim() || "Belum tersedia.";
                        const output = service.output?.trim() || "Belum tersedia.";
                        const estimation = service.estimation?.trim() || "Belum tersedia.";
                        const channel = service.channel?.trim();

                        return (
                            <MotionShell key={service.id} delay={index * 0.025}>
                                <GlassCard className="group flex h-full flex-col rounded-[2rem] p-6 transition hover:-translate-y-2 hover:bg-white/85">
                                    <div className="flex items-start justify-between gap-4"><div className="grid size-12 place-items-center rounded-2xl bg-gov-950 text-white shadow-soft"><Icon size={22} /></div><span className="rounded-full border border-white/80 bg-white/65 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-accent-700">{meta.label}</span></div>
                                    <h2 className="mt-6 font-display text-2xl font-black tracking-tight text-gov-950">{service.title}</h2>
                                    <p className="mt-3 leading-7 text-slate-650">{service.description}</p>
                                    <div className="mt-5 space-y-4">
                                        <div className="rounded-3xl border border-white/70 bg-white/55 p-4"><p className="flex items-center gap-2 text-sm font-black text-gov-900"><span aria-hidden="true">📋</span> Persyaratan</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-semibold leading-6 text-slate-650">{requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
                                        <div className="rounded-3xl border border-white/70 bg-white/55 p-4"><p className="flex items-center gap-2 text-sm font-black text-gov-900"><span aria-hidden="true">🔄</span> Alur Pelayanan</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm font-semibold leading-6 text-slate-650">{flow.map((item) => <li key={item}>{item}</li>)}</ol></div>
                                        <div className="grid gap-3 text-sm font-semibold text-slate-650 sm:grid-cols-2"><div className="rounded-3xl border border-white/70 bg-white/55 p-4"><p className="font-black text-gov-900"><span aria-hidden="true">⏱️</span> Estimasi Waktu</p><p className="mt-2 leading-6">{estimation}</p></div><div className="rounded-3xl border border-white/70 bg-white/55 p-4"><p className="font-black text-gov-900"><span aria-hidden="true">📄</span> Output Layanan</p><p className="mt-2 leading-6">{output}</p></div></div>
                                        <div className="rounded-3xl border border-amber-200 bg-amber-50/90 p-4"><p className="flex items-center gap-2 text-sm font-black text-amber-900"><span aria-hidden="true">⚖️</span> Dasar Hukum</p><div className="mt-3 max-h-44 overflow-y-auto whitespace-pre-line pr-2 text-sm font-semibold leading-7 text-amber-950">{legalBasis}</div></div>
                                        {channel ? <div className="rounded-3xl border border-white/70 bg-white/55 p-4"><p className="font-black text-gov-900"><span aria-hidden="true">🌐</span> Kanal Pelayanan</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-650">{channel}</p></div> : null}
                                    </div>
                                    <a href={meta.href} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gov-950 px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-1">Ajukan Layanan <ArrowRight size={17} /></a>
                                </GlassCard>
                            </MotionShell>
                        );
                    })}
                </div>
            </Section>
            <Section className="pb-24 pt-0"><GlassCard className="grid gap-6 rounded-[2.5rem] p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.28em] text-accent-700">Standar pelayanan</p><h2 className="mt-3 font-display text-4xl font-black text-gov-950">Transparan dari syarat sampai detail layanan.</h2><p className="mt-3 leading-8 text-slate-650">Portal menampilkan informasi resmi dan mengarahkan warga ke kanal pengajuan sesuai jenis layanan.</p></div><div className="grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-gov-950 to-accent-600 text-white shadow-glass"><ShieldCheck size={42} /></div></GlassCard></Section>
        </main>
    );
}