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
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((item, index) => {
                const Icon = item.icon;
                return (
                    <MotionShell key={item.label} delay={index * 0.04}>
                        <div className="group flex h-full min-h-[128px] flex-col justify-between rounded-[1.4rem] border border-white/85 bg-white/84 p-4 shadow-soft backdrop-blur-xl transition duration-300 ease-out hover:scale-[1.03] hover:bg-white hover:shadow-gold sm:min-h-[136px] sm:rounded-[1.7rem]">
                            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-100 text-gov-800 ring-1 ring-accent-200 transition group-hover:bg-accent-400 group-hover:text-gov-950 sm:size-12">
                                <Icon size={21} aria-hidden="true" />
                            </div>
                            <div className="pt-4">
                                <b className="block text-sm font-black leading-tight text-gov-950 sm:text-base">{item.label}</b>
                                <span className="mt-1 block text-xs font-semibold leading-[1.5] text-slate-650 sm:text-sm">{item.desc}</span>
                            </div>
                        </div>
                    </MotionShell>
                );
            })}
        </div>
    );
}