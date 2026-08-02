import { Bell, FileCheck2, FileText, Headset, SearchCheck } from "lucide-react";
import { MotionShell } from "@/components/common/motion-shell";

const items = [
    { title: "Pengajuan Online", desc: "Ajukan permohonan surat secara online", icon: FileCheck2, href: "/surat-online" },
    { title: "Lacak Status", desc: "Pantau status permohonan secara real-time", icon: SearchCheck, href: "/surat-online" },
    { title: "Notifikasi", desc: "Dapatkan notifikasi setiap perkembangan", icon: Bell, href: "/pengaduan" },
    { title: "Dokumen Digital", desc: "Unduh dokumen resmi kapan saja", icon: FileText, href: "/layanan" },
    { title: "TAMSAR CS", desc: "Customer Service 24/7 untuk kebutuhan Anda", icon: Headset, href: "#chat" },
];

export function QuickAccess() {
    return (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
            <MotionShell>
                <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-accent-700">Akses Cepat</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-gov-950 sm:text-4xl">Mulai layanan tanpa menunggu.</h2>
                    </div>
                </div>
                <div className="grid gap-4 rounded-[2rem] border border-border-soft bg-white/68 p-4 shadow-soft backdrop-blur-2xl sm:grid-cols-2 lg:grid-cols-5">
                    {items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <a key={item.title} href={item.href} className="group rounded-3xl p-4 transition hover:-translate-y-1 hover:scale-[1.01] hover:bg-white hover:shadow-gold">
                                <div className="grid size-12 place-items-center rounded-2xl bg-accent-100 text-gov-800 ring-1 ring-accent-200 transition group-hover:scale-110 group-hover:bg-accent-400"><Icon size={22} /></div>
                                <h3 className="mt-4 text-base font-black text-gov-950">{item.title}</h3>
                                <p className="mt-2 text-sm font-medium leading-6 text-slate-650">{item.desc}</p>
                            </a>
                        );
                    })}
                </div>
            </MotionShell>
        </section>
    );
}