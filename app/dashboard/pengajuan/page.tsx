"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { getMyPengajuan, type WargaPengajuan } from "@/services/warga-pengajuan.service";

function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-"; }
function latestStage(item: WargaPengajuan) { const latest = item.tracking_pengajuan?.at(-1); return latest?.petugas || latest?.status || latest?.keterangan || "Pengajuan Dikirim"; }

export default function SemuaPengajuanPage() {
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();
    const [items, setItems] = useState<WargaPengajuan[]>([]);
    const [fetching, setFetching] = useState(true);
    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user || !profile) { if (!loading) setFetching(false); return; } void (async () => { try { setFetching(true); setItems(await getMyPengajuan(profile)); } catch (error) { console.error(error); } finally { setFetching(false); } })(); }, [loading, user, profile]);
    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat pengajuan...</main>;
    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-16 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-6xl"><div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><FileText className="text-accent-300" /><p className="mt-4 text-accent-200 font-black uppercase tracking-[.2em]">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">Semua Pengajuan Saya</h1><p className="mt-3 text-white/75">Daftar pengajuan diambil berdasarkan NIK profil warga yang sedang login.</p></div><div className="mt-8 rounded-[24px] border border-white bg-white/85 p-6 shadow-soft backdrop-blur">{fetching ? <p className="font-bold text-slate-500">Memuat pengajuan...</p> : items.length === 0 ? <div className="space-y-4"><p className="font-bold text-slate-500">Belum ada pengajuan.</p><Button type="button" variant="gold" href="/surat-online/ajukan">+ Ajukan Layanan</Button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs font-black uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Nomor Pengajuan</th><th className="py-3 pr-4">Tanggal</th><th className="py-3 pr-4">Layanan</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Tahap</th><th className="py-3 pr-4">Aksi</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-4 pr-4 font-black text-gov-950">{item.nomor_pengajuan}</td><td className="py-4 pr-4 font-bold text-slate-600">{formatDate(item.created_at)}</td><td className="py-4 pr-4 font-bold text-slate-700">{item.layanan?.nama ?? "Nama layanan tidak tersedia"}</td><td className="py-4 pr-4"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-700">{item.status || "Menunggu Verifikasi"}</span></td><td className="py-4 pr-4 font-bold text-slate-600">{latestStage(item)}</td><td className="py-4 pr-4"><Button type="button" variant="glass" href={`/dashboard/pengajuan/${item.id}`}>Lihat Detail</Button></td></tr>)}</tbody></table></div>}</div></section></main>;
}