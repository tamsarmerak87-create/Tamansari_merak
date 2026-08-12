"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Lock, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { logoutWarga } from "@/services/warga-auth.service";

export default function PengaturanPage() {
    const router = useRouter();
    const { user, loading, profile } = useWargaAuth();

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);

    async function signOut() {
        await logoutWarga();
        router.push("/login");
    }

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat pengaturan...</main>;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-5xl space-y-6"><Hero title="Pengaturan" text="Menu pengaturan ini mengikuti fitur backend yang sudah tersedia di portal warga." /><div className="grid gap-4 lg:grid-cols-2"><Card icon={UserRound} title="Akun" items={["Profil Saya", profile?.nama_lengkap || "Data profil aktif", "Ubah data profil melalui menu Profil Saya"]} action={<Button type="button" variant="gold" href="/dashboard/profil">Buka Profil Saya</Button>} /><Card icon={Lock} title="Keamanan" items={["Status login", user.email || "Login aktif", "Keluar dari session jika diperlukan"]} action={<Button type="button" variant="glass" onClick={() => void signOut()}><LogOut size={18} /> Keluar</Button>} /><Card icon={Bell} title="Notifikasi" items={["Preferensi notifikasi", "Mengikuti notifikasi sistem pengajuan", "Notifikasi dibaca lewat menu Notifikasi"]} /><Card icon={ShieldCheck} title="Privasi" items={["Data digunakan untuk layanan warga", "Profil dan pengajuan hanya untuk akun login", "RLS melindungi data warga lain"]} /></div></section></main>;
}

function Hero({ title, text }: { title: string; text: string }) { return <div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><p className="font-black uppercase tracking-[.2em] text-accent-200">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">{title}</h1><p className="mt-3 text-white/75">{text}</p></div>; }
function Card({ icon: Icon, title, items, action }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; items: string[]; action?: React.ReactNode }) { return <article className="rounded-[26px] border border-white bg-white p-6 shadow-soft"><Icon className="text-accent-400" size={28} /><h2 className="mt-3 text-xl font-black text-gov-950">{title}</h2><ul className="mt-4 space-y-2 text-sm text-slate-600">{items.map((item) => <li key={item}>• {item}</li>)}</ul>{action ? <div className="mt-5">{action}</div> : null}</article>; }