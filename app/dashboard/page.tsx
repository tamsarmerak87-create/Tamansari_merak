"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Bell, ChevronDown, ChevronRight, ClipboardList, Clock3, FileCheck2, FileText, FolderOpen, Headphones, Home, LogOut, MapPin, Menu, QrCode, RefreshCw, Search, Settings, ShieldCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { QRCodePelayanan } from "@/components/pengajuan/qr-code-pelayanan";
import { getWargaProfilePhotoUrl, isVerified, logoutWarga, type WargaProfile } from "@/services/warga-auth.service";
import { buildTrackingNotifications, getMyDocumentsFromPengajuan, getMyNotifikasi, getMyPengajuan, markAllNotificationsRead, markNotificationRead, type DokumenPengajuan, type WargaNotification, type WargaPengajuan } from "@/services/warga-pengajuan.service";

const steps = ["Diajukan", "Verifikasi", "Diproses", "Disetujui", "Selesai"];
const menus = [
    ["BERANDA", [["Beranda", Home, "home"]]],
    ["LAYANAN", [["Pengajuan Surat", FileText, "layanan"], ["Status Pengajuan", ClipboardList, "pengajuan"], ["Tracking Dokumen", Search, "tracking"]]],
    ["AKUN SAYA", [["Profil Saya", UserRound, "profile"], ["Dokumen Saya", FolderOpen, "dokumen"], ["Notifikasi", Bell, "notifikasi"], ["Pengaturan", Settings, "pengaturan"], ["Keluar", LogOut, "logout"]]],
] as const;
const quick: ReadonlyArray<readonly [string, string, LucideIcon, string]> = [["Pengajuan Surat", "Pilih layanan surat yang tersedia", FileText, "layanan"], ["Status Pengajuan", "Lihat status pengajuan Anda", RefreshCw, "pengajuan"], ["Tracking Dokumen", "Lacak dokumen secara real-time", MapPin, "tracking"], ["Dokumen Saya", "Lihat dokumen tersimpan", FolderOpen, "dokumen"]];
const waLink = "https://wa.me/6281234567890";

export default function DashboardPage() {
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();
    const [items, setItems] = useState<WargaPengajuan[]>([]);
    const [notes, setNotes] = useState<WargaNotification[]>([]);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");
    const [active, setActive] = useState("home");
    const [sidebar, setSidebar] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [found, setFound] = useState<WargaPengajuan | null>(null);
    const [message, setMessage] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user || !profile) { if (!loading) setFetching(false); return; } void refresh(); }, [loading, user, profile]);

    async function refresh() {
        if (!profile) return;
        try {
            setFetching(true); setError("");
            const rows = await getMyPengajuan(profile);
            setItems(rows);
            setNotes(await getMyNotifikasi(rows).catch(() => buildTrackingNotifications(rows)));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal memuat data dashboard.");
        } finally { setFetching(false); }
    }

    async function go(target: string) {
        if (target === "layanan") return router.push("/layanan");
        if (target === "pengajuan") return router.push("/dashboard/pengajuan");
        if (target === "profile") return router.push("/dashboard/profil");
        if (target === "dokumen") return router.push("/dashboard/dokumen");
        if (target === "notifikasi") return router.push("/dashboard/notifikasi");
        if (target === "pengaturan") return router.push("/dashboard/pengaturan");
        if (target === "logout") { await logoutWarga(); router.push("/login"); return; }
        setActive(target); setSidebar(false);
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function searchTracking() {
        const value = query.trim().toLowerCase();
        if (!value) { setMessage("Masukkan nomor agenda/kode tracking terlebih dahulu."); return; }
        const row = items.find((item) => (item.nomor_pengajuan ?? "").toLowerCase() === value || item.id.toLowerCase() === value) ?? null;
        setFound(row);
        setMessage(row ? "Status berhasil diperbarui dari data pengajuan Anda." : "Nomor agenda tidak ditemukan pada akun ini.");
    }

    const latest = found ?? items[0] ?? null;
    async function openNotification(note: WargaNotification) {
        await markNotificationRead(note.id).catch(() => undefined);
        setNotes((list) => list.map((item) => item.id === note.id ? { ...item, read: true } : item));
        if (note.pengajuan_id) router.push(`/dashboard/pengajuan/${note.pengajuan_id}`);
    }

    const stats = useMemo(() => ({ waiting: count(items, /menunggu|verifikasi|diajukan|pending/i), process: count(items, /proses|diproses/i), done: count(items, /selesai|setuju|disetujui/i) }), [items]);
    const unread = notes.filter((n) => !n.read).length;
    const docs = useMemo(() => getMyDocumentsFromPengajuan(items), [items]);

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10"><Skeleton /></main>;
    if (!profile) return <State title="Data warga belum tersedia" text="Akun sudah login, tetapi profil warga untuk akun ini belum ditemukan di database." />;
    if (!isVerified(profile)) return <State title="Akun Anda belum diverifikasi" text="Petugas Kelurahan Tamansari sedang memverifikasi data NIK, KK, dan profil Anda." />;

    return <main className="min-h-screen bg-[#F7F8F5] text-[#172033]">
        <header className="sticky top-0 z-40 border-b border-[#E8E8E8] bg-white/95 shadow-sm backdrop-blur"><div className="flex h-[72px] items-center justify-between gap-4 px-4 lg:px-8"><div className="flex items-center gap-3"><button aria-label="Buka menu" className="lg:hidden" onClick={() => setSidebar(true)}><Menu /></button><Logo /></div><label className="hidden h-12 max-w-xl flex-1 items-center gap-3 rounded-2xl border border-[#E8E8E8] bg-[#F7F8F5] px-4 lg:flex"><Search className="text-[#F0A000]" /><input className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Cari layanan, pengajuan, tracking..." /></label><div className="flex items-center gap-3"><Notifications open={notifOpen} setOpen={setNotifOpen} notes={notes} count={unread} onOpen={openNotification} onRead={async () => { await markAllNotificationsRead().catch(() => undefined); setNotes((v) => v.map((n) => ({ ...n, read: true }))); }} /><Profile open={profileOpen} setOpen={setProfileOpen} profile={profile} onLogout={() => void go("logout")} /></div></div></header>
        <div className="flex"><Sidebar open={sidebar} setOpen={setSidebar} active={active} onGo={go} /><section className="min-w-0 flex-1 px-4 pb-28 pt-6 lg:px-8"><div className="mx-auto max-w-[1320px] space-y-6"><Welcome profile={profile} stats={stats} /><section id="home"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">Layanan Cepat</h2><a href="/layanan" className="text-sm font-black text-[#15803D]">Lihat Semua <ChevronRight className="inline" size={16} /></a></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{quick.map(([title, desc, Icon, target], i) => <button key={title} onClick={() => void go(target)} className="group flex min-h-32 items-center justify-between rounded-[22px] border border-[#E8E8E8] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#FFC400] hover:shadow-lg"><span className="flex items-center gap-4"><span className={`rounded-2xl p-4 ${i % 2 ? "bg-emerald-50 text-[#16A34A]" : "bg-[#FFF8DB] text-[#F0A000]"}`}><Icon size={32} /></span><span><b>{title}</b><p className="mt-1 text-sm text-slate-500">{desc}</p></span></span><ChevronRight className="rounded-full bg-[#FFE58A] p-1 transition group-hover:translate-x-1" /></button>)}</div></section><div className="grid gap-5 xl:grid-cols-[1fr_.92fr]"><Recent items={items} fetching={fetching} error={error} /><Tracking item={latest} fetching={fetching} error={error} query={query} setQuery={setQuery} search={searchTracking} refresh={() => void refresh()} message={message} /></div>{latest && <section className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="rounded-[24px] border border-[#E8E8E8] bg-[linear-gradient(135deg,#fff,#fff8db_55%,#eff9f2)] p-5 shadow-sm"><p className="font-black">Barcode Pengajuan</p><p className="mt-1 text-sm font-semibold text-slate-500">Tunjukkan kode ini ke petugas saat kedatangan ke Kelurahan.</p><div className="mt-4 rounded-2xl bg-white p-4 font-mono text-xl font-black text-[#172033] shadow-sm">{agenda(latest)}</div></div><QRCodePelayanan nomorPengajuan={agenda(latest)} status={latest.status} tanggal={date(latest.created_at)} layanan={docName(latest)} size={188} /></section>}<Documents docs={docs} fetching={fetching} /><Info /><BottomNav /><FooterDash /></div></section></div>
    </main>;
}

function Logo() { return <div className="flex items-center gap-3"><Image src="/assets/logo-cilegon.png" width={42} height={42} alt="Logo Kelurahan Tamansari" className="rounded-full" /><div><p className="font-extrabold leading-tight">Kelurahan Tamansari</p><p className="text-xs font-medium text-slate-500">Melayani Warga, Membangun Bersama</p></div></div>; }
function Sidebar({ open, setOpen, active, onGo }: { open: boolean; setOpen: (v: boolean) => void; active: string; onGo: (v: string) => void }) { return <><aside className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-[#E8E8E8] bg-white px-4 py-6 transition lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:translate-x-0`}><button aria-label="Tutup menu" className="mb-4 ml-auto block lg:hidden" onClick={() => setOpen(false)}><X /></button>{menus.map(([group, rows]) => <div key={group} className="mb-7"><p className="mb-3 text-xs font-black text-slate-500">{group}</p><div className="space-y-1">{rows.map(([label, Icon, target]) => <button key={label} onClick={() => void onGo(target)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-[#FFC400]/30 ${active === target ? "bg-[#FFF8DB] text-[#172033]" : "text-slate-700 hover:bg-emerald-50"}`}><Icon size={19} className={active === target ? "text-[#F0A000]" : "text-slate-600"} />{label}</button>)}</div></div>)}<div className="mt-auto rounded-3xl bg-[linear-gradient(135deg,#fff8db,#eef8ef)] p-5 text-center shadow-sm"><Headphones className="mx-auto text-[#16A34A]" size={42} /><p className="mt-3 font-black">Butuh Bantuan?</p><p className="mt-2 text-xs leading-5 text-slate-600">Hubungi layanan kami di WhatsApp.</p><a href={waLink} className="mt-4 inline-flex rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-black text-white shadow-sm">Chat WhatsApp</a></div></aside>{open && <button aria-label="Tutup overlay menu" className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />}</>; }
function Welcome({ profile, stats }: { profile: WargaProfile; stats: { waiting: number; process: number; done: number } }) { const summary: Array<[number, string, LucideIcon, string]> = [[stats.waiting, "Menunggu", Clock3, "text-[#F0A000]"], [stats.process, "Diproses", RefreshCw, "text-[#16A34A]"], [stats.done, "Selesai", FileCheck2, "text-[#16A34A]"]]; const photoUrl = getWargaProfilePhotoUrl(profile.foto_url); return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[30px] border border-[#E8E8E8] bg-[linear-gradient(120deg,#FFC400_0%,#fff7d1_48%,#dff4e7_100%)] p-5 shadow-sm"><h1 className="text-2xl font-black">Selamat datang, {profile.nama_lengkap}!</h1><p className="mt-1 font-semibold text-[#172033]">Kecamatan Pulomerak, Kota Cilegon</p><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]"><div className="flex flex-wrap items-center gap-5"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white/70 ring-4 ring-white">{photoUrl ? <Image src={photoUrl} alt={profile.nama_lengkap} width={96} height={96} className="h-full w-full object-cover" unoptimized /> : <UserRound size={46} />}</div><div><div className="flex items-center gap-2"><p className="text-2xl font-black">{profile.nama_lengkap}</p><span className="rounded-full bg-[#16A34A] px-3 py-1 text-xs font-black text-white">Warga</span></div><p className="mt-2 text-sm font-bold">NIK: {mask(profile.nik)}</p><p className="text-sm font-bold">No. WhatsApp: {mask(profile.nomor_whatsapp)}</p><a href="/dashboard/profil" className="mt-4 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-[#172033] shadow-sm">Lihat Profil <ChevronRight size={16} /></a></div></div><div className="rounded-[26px] bg-white/90 p-5 text-[#172033] shadow-sm"><p className="font-black">Ringkasan Pengajuan</p><div className="mt-5 grid gap-3 sm:grid-cols-3 sm:divide-x">{summary.map(([n, label, Icon, color]) => <div key={label} className="px-3"><Icon className={`mb-2 ${color}`} size={32} /><p className="text-4xl font-black">{n}</p><p className="text-sm font-black">{label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{label === "Menunggu" ? "Menunggu verifikasi" : label === "Diproses" ? "Sedang diproses" : "Telah selesai"}</p></div>)}</div></div></div></motion.section>; }
function Tracking({ item, fetching, error, query, setQuery, search, refresh, message }: { item: WargaPengajuan | null; fetching: boolean; error: string; query: string; setQuery: (v: string) => void; search: () => void; refresh: () => void; message: string }) { const step = currentStep(item); return <section id="tracking" className="scroll-mt-24 rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Tracking Terakhir</h2><button onClick={refresh} className="text-sm font-black text-[#15803D]">Lihat Semua <ChevronRight className="inline" size={16} /></button></div><div className="mt-4 flex gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Masukkan nomor agenda/kode tracking" className="min-w-0 flex-1 rounded-xl border border-[#E8E8E8] px-4 py-3 text-sm outline-none focus:border-[#FFC400] focus:ring-4 focus:ring-[#FFC400]/20" /><button onClick={search} className="rounded-xl bg-[#FFC400] px-4 py-3 text-sm font-black text-[#172033]">Cek Tracking</button></div>{message && <p className="mt-2 text-sm text-slate-500">{message}</p>}{fetching ? <Skeleton /> : error ? <p className="mt-4 text-red-600">{error}</p> : <div className="mt-4 rounded-2xl border border-[#E8E8E8] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(item?.status)}`}>{item?.status || "Menunggu Verifikasi"}</span><p className="mt-3 font-black uppercase">{docName(item)}</p><p className="text-sm font-bold text-slate-500">No. Agenda: {agenda(item)}</p></div><a href={item ? `/dashboard/pengajuan/${item.id}` : "/surat-online/tracking"} className="rounded-xl border border-[#16A34A]/30 px-4 py-2 text-sm font-black text-[#15803D]">Lihat Detail <ChevronRight className="inline" size={16} /></a></div><div className="mt-7 grid grid-cols-4 gap-2">{["Pengajuan Diterima", "Verifikasi Petugas", "Surat Diproses", "Surat Selesai"].map((s, i) => <div key={s} className="text-center"><div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${i < step ? "bg-[#16A34A] text-white" : i === step ? "bg-[#FFC400] text-[#172033]" : "bg-slate-200 text-slate-500"}`}>{i < step ? <FileCheck2 /> : i === step ? <UserRound /> : <FileText />}</div><div className={`mt-3 border-t-4 ${i < step ? "border-[#16A34A]" : i === step ? "border-[#FFC400]" : "border-slate-200"}`} /><p className="mt-2 text-xs font-black">{s}</p></div>)}</div></div>}</section>; }
function Recent({ items, fetching, error }: { items: WargaPengajuan[]; fetching: boolean; error: string }) { return <section id="pengajuan" className="scroll-mt-24 rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm"><div className="flex justify-between"><h2 className="text-lg font-black">Pengajuan Terakhir</h2><a href="/dashboard/pengajuan" className="text-sm font-black text-[#15803D]">Lihat Semua <ChevronRight className="inline" size={16} /></a></div>{fetching ? <Skeleton /> : error ? <p className="mt-4 text-red-600">{error}</p> : !items.length ? <Empty text="Belum ada pengajuan. Ajukan surat pertama Anda secara online." /> : <div className="mt-4 space-y-3">{items.slice(0, 3).map((it, i) => <a href={`/dashboard/pengajuan/${it.id}`} key={it.id} className="flex items-center gap-3 rounded-2xl border border-[#E8E8E8] p-3 transition hover:border-[#FFC400] hover:shadow-md"><span className={`rounded-xl p-3 ${i === 1 ? "bg-emerald-50 text-[#16A34A]" : "bg-[#FFF8DB] text-[#F0A000]"}`}><FileText /></span><div className="min-w-0 flex-1"><p className="truncate font-black uppercase">{docName(it)}</p><p className="truncate text-xs font-semibold text-slate-500">No. Agenda: {agenda(it)} • {date(it.created_at)} {time(it.created_at)} WIB</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(it.status)}`}>{it.status || "Menunggu Verifikasi"}</span><Barcode className="hidden text-slate-500 sm:block" /></a>)}</div>}</section>; }
function Documents({ docs, fetching }: { docs: DokumenPengajuan[]; fetching: boolean }) { return <section id="dokumen" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><h2 className="text-lg font-extrabold">Dokumen Saya</h2><a href="/dashboard/pengajuan" className="text-sm font-bold text-[#1557D6]">Lihat Semua</a></div>{fetching ? <Skeleton /> : !docs.length ? <Empty text="Belum ada dokumen selesai yang dapat dibuka." /> : <div className="mt-4 grid gap-3 md:grid-cols-3">{docs.slice(0, 3).map((doc) => <a key={doc.id ?? doc.url_file} href={doc.url_file ?? "#"} target="_blank" rel="noreferrer" className="rounded-xl border p-4 transition hover:-translate-y-1 hover:shadow-md"><FolderOpen className="text-[#E9A400]" /><p className="mt-3 truncate font-bold">{doc.nama_file || doc.jenis || "Dokumen Pengajuan"}</p><p className="mt-1 text-xs text-slate-500">No. Agenda: {doc.nomor_pengajuan || "-"}</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(doc.status)}`}>{doc.status || "Tersedia"}</span></a>)}</div>}</section>; }
function Info() { const cards: Array<[LucideIcon, string, string, string, string]> = [[Clock3, "Jam Pelayanan", "Senin - Jumat\n08.00 - 16.00 WIB", "Lihat Selengkapnya →", "/kontak"], [MapPin, "Lokasi Kantor", "Jl. Raya Anyer KM. 7\nTamansari, Pulomerak\nKota Cilegon", "Lihat di Peta →", "https://maps.google.com/?q=Kelurahan+Tamansari+Pulomerak+Cilegon"], [FileCheck2, "Syarat & Panduan", "Informasi lengkap syarat dan panduan layanan.", "Lihat Panduan →", "/faq"]]; return <section className="grid gap-4 md:grid-cols-3">{cards.map(([Icon, title, desc, link, href]) => <div key={title} className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="text-[#1557D6]" size={34} /><p className="mt-3 font-extrabold">{title}</p><p className="mt-2 whitespace-pre-line text-sm text-slate-600">{desc}</p><a href={href} className="mt-4 inline-flex text-sm font-bold text-[#1557D6]">{link}</a></div>)}</section>; }
function Notifications({
    open,
    setOpen,
    count,
    notes,
    onOpen,
    onRead,
}: {
    open: boolean;
    setOpen: (v: boolean) => void;
    count: number;
    notes: WargaNotification[];
    onOpen: (note: WargaNotification) => void;
    onRead: () => void;
}) {
    return (
        <div className="relative">
            <button onClick={() => setOpen(!open)} className="relative rounded-full p-2 hover:bg-slate-100">
                <Bell />
                <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{count}</span>
            </button>
            {open && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl border bg-white p-3 shadow-xl">
                    <div className="flex justify-between">
                        <b>Notifikasi</b>
                        <button onClick={onRead} className="text-xs font-bold text-[#1557D6]">Tandai dibaca</button>
                    </div>
                    {notes.slice(0, 4).map((n) => (
                        <button key={n.id} onClick={() => onOpen(n)} className={`mt-3 w-full rounded-xl p-3 text-left text-sm ${n.read ? "bg-slate-50" : "bg-blue-50"}`}>
                            <b>{n.title}</b>
                            <br />
                            <span className="text-slate-500">{n.message}</span>
                        </button>
                    ))}
                    {!notes.length && <Empty text="Belum ada notifikasi terbaru." />}
                </div>
            )}
        </div>
    );
}

function Profile({ open, setOpen, profile, onLogout }: { open: boolean; setOpen: (v: boolean) => void; profile: WargaProfile; onLogout: () => void }) {
    const photoUrl = getWargaProfilePhotoUrl(profile.foto_url);
    return (
        <div className="relative">
            <button onClick={() => setOpen(!open)} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-amber-600">
                    {photoUrl ? <Image src={photoUrl} alt={profile.nama_lengkap} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <UserRound />}
                </div>
                <span className="hidden text-left sm:block">
                    <b>{profile.nama_lengkap}</b>
                    <p className="text-xs text-slate-500">Warga</p>
                </span>
                <ChevronDown size={18} />
            </button>
            {open && (
                <div className="absolute right-0 mt-3 w-56 rounded-2xl border bg-white p-2 shadow-xl">
                    <a href="/dashboard/profil" className="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-slate-50">Profil Saya</a>
                    <a href="/dashboard/pengaturan" className="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-slate-50">Pengaturan</a>
                    <button onClick={onLogout} className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50">Keluar</button>
                </div>
            )}
        </div>
    );
}

function BottomNav() {
    const items: Array<[string, string, LucideIcon, boolean]> = [["Beranda", "/dashboard", Home, true], ["Pengajuan", "/layanan", FileText, false], ["Scan Barcode", "/dashboard/tracking/scan", QrCode, false], ["Tracking", "/surat-online/tracking", MapPin, false], ["Akun", "/dashboard/profil", UserRound, false]];
    return <nav className="fixed inset-x-3 bottom-3 z-40 flex h-20 items-center justify-around rounded-[28px] border border-[#E8E8E8] bg-white/95 px-2 shadow-2xl backdrop-blur lg:hidden">{items.map(([label, href, Icon, active], i) => <a key={label} href={href} className={`flex flex-col items-center gap-1 text-[11px] font-black ${active ? "text-[#F0A000]" : "text-slate-600"} ${i === 2 ? "-mt-8" : ""}`}><span className={`${i === 2 ? "flex h-16 w-16 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-xl ring-4 ring-white" : ""}`}><Icon size={i === 2 ? 28 : 22} /></span>{label}</a>)}</nav>;
}

function FooterDash() { return <footer className="flex flex-col gap-4 border-t py-5 text-sm text-slate-500 md:flex-row md:items-center md:justify-between"><Logo /><p>© 2025 Kelurahan Tamansari. All rights reserved.</p><div className="flex gap-6"><a>Kebijakan Privasi</a><a>Syarat & Ketentuan</a></div></footer>; }
function State({ title, text }: { title: string; text: string }) { return <main className="min-h-screen bg-[#F7F9FC] p-10"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto text-[#1557D6]" size={44} /><h1 className="mt-4 text-2xl font-extrabold">{title}</h1><p className="mt-2 text-slate-600">{text}</p></section></main>; }
function Skeleton() { return <div className="mt-4 animate-pulse space-y-3"><div className="h-12 rounded-xl bg-slate-100" /><div className="h-24 rounded-xl bg-slate-100" /></div>; }
function Empty({ text }: { text: string }) { return <div className="mt-4 rounded-xl border border-dashed p-5 text-sm text-slate-500">{text}</div>; }
function count(items: WargaPengajuan[], re: RegExp) { return items.filter((i) => re.test(i.status ?? "")).length; }
function mask(v?: string | null) { const s = v || "-"; return s.length > 8 ? `${s.slice(0, 4)}••••••••${s.slice(-4)}` : s; }
function date(v?: string | null) { return v ? new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"; }
function time(v?: string | null) { return v ? new Date(v).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"; }
function statusClass(status?: string | null) { const s = (status || "").toLowerCase(); if (s.includes("selesai") || s.includes("setuju")) return "bg-emerald-100 text-emerald-700"; if (s.includes("proses")) return "bg-emerald-50 text-emerald-700"; return "bg-[#FFF8DB] text-[#B7791F]"; }
function currentStep(item?: WargaPengajuan | null) { const s = (item?.status || "").toLowerCase(); if (s.includes("selesai")) return 4; if (s.includes("setuju")) return 3; if (s.includes("proses")) return 2; if (s.includes("verifikasi")) return 1; return 0; }
function docName(item?: WargaPengajuan | null) { return item?.layanan?.nama || item?.keperluan || "Jenis layanan tidak tersedia"; }
function agenda(item?: WargaPengajuan | null) { return item?.nomor_pengajuan || item?.id || "-"; }