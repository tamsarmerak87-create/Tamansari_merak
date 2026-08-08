"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { getMyPengajuanDetail, type WargaPengajuan } from "@/services/warga-pengajuan.service";

const defaultSteps = ["Pengajuan Dikirim", "Staff Pelayanan", "Petugas Lapangan", "Kepala Seksi", "Seklur", "Lurah"];
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"; }

export default function DetailPengajuanPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const router = useRouter();
    const { user, loading } = useWargaAuth();
    const [item, setItem] = useState<WargaPengajuan | null>(null);
    const [fetching, setFetching] = useState(true);
    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user) return; void (async () => { try { setFetching(true); setItem(await getMyPengajuanDetail(id)); } catch (error) { console.error(error); setItem(null); } finally { setFetching(false); } })(); }, [user, id]);
    if (loading || !user || fetching) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat detail pengajuan...</main>;
    if (!item) return <main className="min-h-screen bg-[#F7F9FC] px-5 py-16 sm:px-10 lg:px-20"><section className="mx-auto max-w-2xl rounded-[32px] border border-white bg-white/85 p-8 text-center shadow-soft"><h1 className="text-3xl font-black text-gov-950">Pengajuan tidak ditemukan.</h1><p className="mt-4 leading-7 text-slate-600">Data tidak tersedia atau bukan milik akun warga yang sedang login.</p><Button type="button" className="mt-6" variant="gold" href="/dashboard/pengajuan">Kembali ke Pengajuan</Button></section></main>;
    const tracking = item.tracking_pengajuan ?? [];
    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-16 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-5xl"><div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><FileText className="text-accent-300" /><p className="mt-4 text-accent-200 font-black uppercase tracking-[.2em]">Detail Pengajuan</p><h1 className="mt-3 text-4xl font-black">{item.nomor_pengajuan}</h1><p className="mt-3 text-white/75">{item.layanan?.nama ?? "Nama layanan tidak tersedia"}</p></div><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.85fr]"><section className="rounded-[24px] border border-white bg-white/85 p-6 shadow-soft backdrop-blur"><h2 className="text-2xl font-black text-gov-950">Informasi Pengajuan</h2><div className="mt-5 grid gap-4 text-sm font-bold text-slate-700 sm:grid-cols-2"><p>Nomor: {item.nomor_pengajuan}</p><p>Tanggal: {formatDate(item.created_at)}</p><p>Layanan: {item.layanan?.nama ?? "Nama layanan tidak tersedia"}</p><p>Status: {item.status || "Menunggu Verifikasi"}</p><p className="sm:col-span-2">Keperluan: {item.keperluan || "-"}</p></div><Button type="button" className="mt-6" variant="glass" href={`/surat-online/tracking?nomor=${encodeURIComponent(item.nomor_pengajuan ?? "")}`}>Buka Tracking Publik</Button></section><section className="rounded-[24px] border border-white bg-white/85 p-6 shadow-soft backdrop-blur"><h2 className="text-2xl font-black text-gov-950">Tracking</h2><div className="mt-5 space-y-4">{defaultSteps.map((step, index) => { const data = tracking[index]; const done = Boolean(data); const active = index === tracking.length; return <div key={step} className="flex gap-3"><span className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}`}>{done ? "✓" : active ? "●" : "○"}</span><div><p className="font-black text-gov-950">{data?.status || data?.petugas || step}</p><p className="text-sm font-bold text-slate-600">{data?.keterangan || (active ? "Menunggu proses" : "")}</p>{data?.petugas ? <p className="text-sm font-bold text-slate-500">{data.petugas}</p> : null}{data?.created_at ? <p className="text-xs font-bold text-slate-400">{formatDate(data.created_at)}</p> : null}</div></div>; })}</div></section></div></section></main>;
}