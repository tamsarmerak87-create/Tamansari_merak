import { Clock3, FileText, ShieldCheck, Wifi } from "lucide-react";
import { MotionShell } from "@/components/common/motion-shell";

const stats = [
    { label: "33 Layanan", desc: "Administrasi resmi", icon: FileText },
    { label: "Cepat", desc: "Alur lebih ringkas", icon: Clock3 },
    { label: "Aman", desc: "Data terlindungi", icon: ShieldCheck },
    { label: "Online 24 Jam", desc: "Akses kapan saja", icon: Wifi },
];

export function HeroStats() {
    return (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item, index) => {
                const Icon = item.icon;
                return (
                    <MotionShell key={item.label} delay={index * 0.04}>
                        <div className="group flex min-h-24 items-center gap-4 rounded-[1.7rem] border border-white/85 bg-white/82 p-4 shadow-soft backdrop-blur-xl transition hover:-translate-y-1 hover:scale-[1.01] hover:bg-white hover:shadow-gold">
                            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-100 text-gov-800 ring-1 ring-accent-200 transition group-hover:bg-accent-400 group-hover:text-gov-950">
                                <Icon size={21} />
                            </div>
                            <div>
                                <b className="block text-base font-black leading-tight text-gov-950">{item.label}</b>
                                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-650">{item.desc}</span>
                            </div>
                        </div>
                    </MotionShell>
                );
            })}
        </div>
    );
}