"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Barcode, Bell, ChevronDown, ChevronRight, ClipboardList, Clock3, FileCheck2, FileText, FolderOpen, Headphones, HelpCircle, Home, LogOut, MapPin, Menu, QrCode, RefreshCw, Search, ShieldCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { QRCodePelayanan } from "@/components/pengajuan/qr-code-pelayanan";
import { getWargaProfilePhotoUrl, isVerified, logoutWarga, type WargaProfile } from "@/services/warga-auth.service";
import { buildTrackingNotifications, getMyDocumentsFromPengajuan, getMyNotifikasi, getMyPengajuan, markAllNotificationsRead, markNotificationRead, type DokumenPengajuan, type WargaNotification, type WargaPengajuan } from "@/services/warga-pengajuan.service";
import { site } from "@/constants/site";

const menus = [
    ["BERANDA", [["Beranda", Home, "home"]]],
    ["LAYANAN", [["Pengajuan Surat", FileText, "layanan"], ["Berkas Pengajuan", ClipboardList, "pengajuan"], ["Tracking Dokumen", Search, "tracking"]]],
    ["INFORMASI", [["Dokumen Saya", FolderOpen, "dokumen"], ["Profil Saya", UserRound, "profile"], ["Bantuan", HelpCircle, "/faq"]]],
] as const;
const quick: ReadonlyArray<readonly [string, string, LucideIcon, string]> = [["Buat Pengajuan", "Ajukan surat baru", FileText, "layanan"], ["Cek Status", "Lihat proses pengajuan", RefreshCw, "pengajuan"], ["Tracking Dokumen", "Lacak nomor pengajuan", MapPin, "tracking"], ["Dokumen Saya", "Buka dokumen tersimpan", FolderOpen, "dokumen"]];
const waLink = site.wa;

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
    const [headerQuery, setHeaderQuery] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!loading && user && profile?.status_verifikasi === "Ditolak") router.replace("/verification-rejected"); }, [loading, profile, router, user]);
    useEffect(() => { if (!user || !profile) { if (!loading) void Promise.resolve().then(() => setFetching(false)); return; } void refresh(); }, [loading, user, profile]);

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
        if (target.startsWith("/")) return router.push(target);
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

    function searchHeader() {
        const value = headerQuery.trim();
        if (!value) return;
        const matched = items.find((item) => `${item.nomor_pengajuan ?? ""} ${docName(item)}`.toLowerCase().includes(value.toLowerCase()));
        router.push(matched ? `/dashboard/pengajuan/${matched.id}` : "/layanan");
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

    const stats = useMemo(() => ({ total: items.length, waiting: count(items, /menunggu|verifikasi|diajukan|pending/i), process: count(items, /proses|diproses/i), done: count(items, /selesai|setuju|disetujui/i), rejected: count(items, /tolak|ditolak|kembali|dikembalikan|revisi/i) }), [items]);
    const unread = notes.filter((n) => !n.read).length;
    const docs = useMemo(() => getMyDocumentsFromPengajuan(items), [items]);

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10"><Skeleton /></main>;
    if (!profile) return <State title="Data warga belum tersedia" text="Akun sudah login, tetapi profil warga untuk akun ini belum ditemukan di database." />;
    if (!isVerified(profile)) return <PendingVerification />;

    return <main className="min-h-screen bg-[#F8FAF7] text-[#172033]">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl"><div className="mx-auto max-w-[1680px] px-4 lg:px-6 xl:px-8"><div className="flex h-[72px] items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button aria-label="Buka menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 lg:hidden" onClick={() => setSidebar(true)}><Menu size={21} /></button><Logo /></div><form onSubmit={(event) => { event.preventDefault(); searchHeader(); }} className="hidden h-11 max-w-xl flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 lg:flex"><Search className="text-[#15803D]" size={19} /><input value={headerQuery} onChange={(event) => setHeaderQuery(event.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Cari layanan atau nomor pengajuan..." /></form><div className="flex items-center gap-1 sm:gap-2"><Notifications open={notifOpen} setOpen={setNotifOpen} notes={notes} count={unread} onOpen={openNotification} onRead={async () => { await markAllNotificationsRead().catch(() => undefined); setNotes((v) => v.map((n) => ({ ...n, read: true }))); }} /><Profile open={profileOpen} setOpen={setProfileOpen} profile={profile} onLogout={() => void go("logout")} /></div></div><form onSubmit={(event) => { event.preventDefault(); searchHeader(); }} className="mb-3 flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 lg:hidden"><Search className="shrink-0 text-[#15803D]" size={18} /><input value={headerQuery} onChange={(event) => setHeaderQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" placeholder="Cari layanan atau nomor pengajuan..." /><button type="submit" className="min-h-9 shrink-0 rounded-lg bg-[#FFC400] px-3 text-xs font-black">Cari</button></form></div></header>
        <div className="flex"><Sidebar open={sidebar} setOpen={setSidebar} active={active} onGo={go} /><section className="min-w-0 flex-1 px-4 pb-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom)+20px)] pt-5 sm:px-6 lg:px-10 lg:pb-8"><div className="mx-auto max-w-[1280px] space-y-7"><Welcome profile={profile} stats={stats} /><section id="home"><SectionTitle title="Akses Cepat" description="Layanan yang paling sering digunakan" href="/layanan" /><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{quick.map(([title, desc, Icon, target], i) => <button key={title} onClick={() => void go(target)} className="group flex min-h-[104px] flex-col items-start justify-center rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_3px_16px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:border-[#FBCB45] hover:shadow-md sm:flex-row sm:items-center sm:gap-3"><span className={`mb-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:mb-0 ${i % 2 ? "bg-[#E8F5E9] text-[#0F766E]" : "bg-[#FFF8DB] text-[#D89000]"}`}><Icon size={21} /></span><span className="min-w-0"><b className="text-xs sm:text-sm">{title}</b><p className="mt-1 text-[11px] leading-4 text-slate-500">{desc}</p></span></button>)}</div></section><div className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]"><Recent items={items} fetching={fetching} error={error} /><Tracking item={latest} fetching={fetching} error={error} query={query} setQuery={setQuery} search={searchTracking} refresh={() => void refresh()} message={message} /></div>{latest && <section className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="rounded-2xl border border-slate-200 bg-[#FFFDF7] p-5 shadow-sm"><p className="font-black">Barcode Pengajuan</p><p className="mt-1 text-sm font-semibold text-slate-500">Tunjukkan kode ini kepada petugas saat datang ke Kelurahan.</p><div className="mt-4 overflow-hidden text-ellipsis rounded-xl bg-white p-4 font-mono text-lg font-black shadow-sm">{agenda(latest)}</div></div><QRCodePelayanan nomorPengajuan={agenda(latest)} status={latest.status} tanggal={date(latest.created_at)} layanan={docName(latest)} size={188} /></section>}<Documents docs={docs} fetching={fetching} /><Info /><FooterDash /></div></section></div><BottomNav />
    </main>;
}

function Logo() { return <div className="flex min-w-0 items-center gap-3"><Image src="/assets/logo-cilegon.png" width={42} height={42} alt="Logo Kelurahan Tamansari" className="h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0"><p className="truncate text-sm font-extrabold leading-tight sm:text-base">Kelurahan Tamansari</p><p className="hidden text-xs font-medium text-slate-500 sm:block">Kecamatan Pulomerak, Kota Cilegon</p></div></div>; }
function Sidebar({ open, setOpen, active, onGo }: { open: boolean; setOpen: (v: boolean) => void; active: string; onGo: (v: string) => void }) { return <><aside className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-[#E8E8E8] bg-white px-3 py-6 transition lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:translate-x-0`}><button aria-label="Tutup menu" className="mb-4 ml-auto block lg:hidden" onClick={() => setOpen(false)}><X /></button>{menus.map(([group, rows]) => <div key={group} className="mb-7"><p className="mb-3 text-xs font-black text-slate-500">{group}</p><div className="space-y-1">{rows.map(([label, Icon, target]) => <button key={label} onClick={() => void onGo(target)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-[#FFC400]/30 ${active === target ? "bg-[#FFF8DB] text-[#172033]" : "text-slate-700 hover:bg-emerald-50"}`}><Icon size={19} className={active === target ? "text-[#F0A000]" : "text-slate-600"} />{label}</button>)}</div></div>)}<div className="mt-auto rounded-3xl bg-[linear-gradient(135deg,#fff8db,#eef8ef)] p-5 text-center shadow-sm"><Headphones className="mx-auto text-[#16A34A]" size={42} /><p className="mt-3 font-black">Butuh Bantuan?</p><p className="mt-2 text-xs leading-5 text-slate-600">Hubungi layanan kami di WhatsApp.</p><a href={waLink} className="mt-4 inline-flex rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-black text-white shadow-sm">Chat WhatsApp</a></div></aside>{open && <button aria-label="Tutup overlay menu" className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />}</>; }
function Welcome({ profile, stats }: { profile: WargaProfile; stats: { total: number; waiting: number; process: number; done: number; rejected: number } }) { const summary: Array<[number, string, LucideIcon, string, string]> = [[stats.total, "Total", ClipboardList, "text-blue-600", "Semua pengajuan"], [stats.waiting, "Menunggu", Clock3, "text-amber-600", "Menunggu petugas"], [stats.process, "Diproses", RefreshCw, "text-blue-600", "Sedang dikerjakan"], [stats.done, "Selesai", FileCheck2, "text-emerald-600", "Sudah selesai"], [stats.rejected, "Perlu Diperbaiki", AlertCircle, "text-red-600", "Ditolak/dikembalikan"]]; const photoUrl = getWargaProfilePhotoUrl(profile.foto_url); return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-amber-200/70 bg-[radial-gradient(circle_at_90%_10%,rgba(255,255,255,.9),transparent_28%),linear-gradient(120deg,#fff3b8_0%,#fffdf5_48%,#e7f6eb_100%)] p-5 shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-7"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-[#15803D]">Portal Pelayanan Warga</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Selamat datang, {profile.nama_lengkap}!</h1><p className="mt-1 text-sm font-semibold text-slate-600">Kecamatan Pulomerak, Kota Cilegon</p></div><span className="w-fit rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">Akun Terverifikasi</span></div><div className="mt-6 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><div className="flex items-center gap-4 rounded-2xl bg-white/75 p-4 ring-1 ring-white sm:gap-5"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-4 ring-white sm:h-24 sm:w-24">{photoUrl ? <Image src={photoUrl} alt={profile.nama_lengkap} width={96} height={96} className="h-full w-full object-cover" unoptimized /> : <UserRound size={42} />}</div><div className="min-w-0"><p className="truncate text-lg font-black sm:text-xl">{profile.nama_lengkap}</p><p className="mt-1 text-sm font-bold text-slate-600">NIK: {mask(profile.nik)}</p><a href="/dashboard/profil" className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#172033] px-4 py-2.5 text-sm font-black text-white">Lihat Profil <ChevronRight size={15} /></a></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{summary.map(([n, label, Icon, color, caption]) => <div key={label} className="rounded-2xl bg-white/90 p-3 shadow-sm last:col-span-2 sm:last:col-span-1"><Icon className={color} size={22} /><p className="mt-3 text-2xl font-black">{n}</p><p className="text-xs font-black sm:text-sm">{label}</p><p className="mt-1 text-[11px] text-slate-500">{caption}</p></div>)}</div></div></motion.section>; }
function Tracking({ item, fetching, error, query, setQuery, search, refresh, message }: { item: WargaPengajuan | null; fetching: boolean; error: string; query: string; setQuery: (v: string) => void; search: () => void; refresh: () => void; message: string }) { const step = currentStep(item); return <section id="tracking" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Tracking Terakhir</h2><button onClick={refresh} aria-label="Perbarui tracking" className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-[#15803D]"><RefreshCw size={17} /></button></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Nomor agenda/kode tracking" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#FFC400] focus:ring-4 focus:ring-[#FFC400]/20" /><button onClick={search} className="rounded-xl bg-[#FFC400] px-4 py-3 text-sm font-black">Cek Tracking</button></div>{message && <p className="mt-2 text-sm text-slate-500">{message}</p>}{fetching ? <Skeleton /> : error ? <p className="mt-4 text-red-600">{error}</p> : !item ? <Empty text="Belum ada pengajuan yang dapat dilacak." /> : <div className="mt-4 rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status || "Status belum tersedia"}</span><p className="mt-3 font-black uppercase">{docName(item)}</p><p className="text-sm font-bold text-slate-500">No. Agenda: {agenda(item)}</p></div><a href={`/dashboard/pengajuan/${item.id}`} className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-black text-[#15803D]">Lihat Detail <ChevronRight className="inline" size={16} /></a></div><div className="mt-7 grid grid-cols-4 gap-1 sm:gap-2">{["Diterima", "Verifikasi", "Diproses", "Selesai"].map((s, i) => <div key={s} className="text-center"><div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 ${i < step ? "bg-[#16A34A] text-white" : i === step ? "bg-[#FFC400]" : "bg-slate-200 text-slate-500"}`}>{i < step ? <FileCheck2 size={19} /> : i === step ? <UserRound size={19} /> : <FileText size={19} />}</div><div className={`mt-3 border-t-4 ${i < step ? "border-[#16A34A]" : i === step ? "border-[#FFC400]" : "border-slate-200"}`} /><p className="mt-2 text-[10px] font-black sm:text-xs">{s}</p></div>)}</div></div>}</section>; }
function Recent({ items, fetching, error }: { items: WargaPengajuan[]; fetching: boolean; error: string }) { return <section id="pengajuan" className="scroll-mt-24 rounded-[24px] border border-[#E8E8E8] bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-black">Pengajuan Terakhir</h2><a href="/dashboard/pengajuan" className="shrink-0 text-sm font-black text-[#15803D]">Lihat Semua <ChevronRight className="inline" size={16} /></a></div>{fetching ? <Skeleton /> : error ? <p className="mt-4 text-red-600">{error}</p> : !items.length ? <Empty text="Belum ada pengajuan. Ajukan surat pertama Anda secara online." /> : <div className="mt-4 space-y-3">{items.slice(0, 5).map((it, i) => <a href={`/dashboard/pengajuan/${it.id}`} key={it.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[#E8E8E8] p-3 transition hover:border-[#FFC400] hover:shadow-md sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"><span className={`rounded-xl p-3 ${i === 1 ? "bg-emerald-50 text-[#16A34A]" : "bg-[#FFF8DB] text-[#F0A000]"}`}><FileText /></span><div className="min-w-0"><p className="truncate font-black uppercase">{docName(it)}</p><p className="truncate text-xs font-semibold text-slate-500">No. Agenda: {agenda(it)} • {date(it.created_at)} {time(it.created_at)} WIB</p></div><span className={`col-start-2 w-fit rounded-full px-3 py-1 text-xs font-black sm:col-start-auto ${statusClass(it.status)}`}>{it.status || "Menunggu Verifikasi"}</span><Barcode className="hidden text-slate-500 sm:block" /></a>)}</div>}</section>; }
function Documents({ docs, fetching }: { docs: DokumenPengajuan[]; fetching: boolean }) { return <section id="dokumen" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Dokumen Saya" description="Dokumen selesai yang tersedia" href="/dashboard/dokumen" />{fetching ? <Skeleton /> : !docs.length ? <Empty text="Belum ada dokumen selesai yang dapat dibuka." /> : <div className="grid gap-3 md:grid-cols-3">{docs.slice(0, 3).map((doc) => doc.url_file ? <a key={doc.id ?? doc.url_file} href={doc.url_file} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-4 transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-md"><FolderOpen className="text-[#D89000]" /><p className="mt-3 truncate font-bold">{doc.nama_file || doc.jenis || "Dokumen Pengajuan"}</p><p className="mt-1 text-xs text-slate-500">No. Agenda: {doc.nomor_pengajuan || "-"}</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(doc.status)}`}>{doc.status || "Tersedia"}</span></a> : null)}</div>}</section>; }
function Info() { const cards: Array<[LucideIcon, string, string, string, string]> = [[Clock3, "Jam Pelayanan", "Senin - Jumat\n08.00 - 16.00 WIB", "Lihat Selengkapnya", "/kontak"], [MapPin, "Lokasi Kantor", site.address, "Lihat di Peta", `https://maps.google.com/?q=${encodeURIComponent(site.address)}`], [FileCheck2, "Syarat & Panduan", "Informasi syarat dan panduan layanan warga.", "Lihat Panduan", "/faq"]]; return <section><SectionTitle title="Informasi Pelayanan" description="Informasi penting sebelum datang atau mengajukan layanan" /><div className="grid gap-4 md:grid-cols-3">{cards.map(([Icon, title, desc, link, href]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-[#15803D]"><Icon size={24} /></span><p className="mt-4 font-extrabold">{title}</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{desc}</p><a href={href} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#15803D]">{link} <ChevronRight size={15} /></a></div>)}</div></section>; }
function SectionTitle({ title, description, href }: { title: string; description?: string; href?: string }) { return <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-black sm:text-xl">{title}</h2>{description && <p className="mt-1 text-xs text-slate-500 sm:text-sm">{description}</p>}</div>{href && <a href={href} className="shrink-0 text-sm font-black text-[#15803D]">Lihat Semua <ChevronRight className="inline" size={16} /></a>}</div>; }
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
            <button aria-label="Buka notifikasi" onClick={() => setOpen(!open)} className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100">
                <Bell />
                <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{count}</span>
            </button>
            {open && (
                <div className="absolute right-0 z-50 mt-3 w-[calc(100vw-2rem)] max-w-80 rounded-2xl border bg-white p-3 shadow-xl">
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
    return <nav aria-label="Navigasi dashboard warga" className="fixed inset-x-0 bottom-0 z-[9999] flex w-full min-h-[var(--mobile-bottom-nav-height)] items-center justify-around rounded-t-[22px] border-t border-[#E8E8E8] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,.12)] backdrop-blur-xl transition-all duration-200 ease-out lg:hidden">{items.map(([label, href, Icon, active], i) => { const isScan = i === 2; return <a key={label} href={href} aria-current={active ? "page" : undefined} className={`group flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-[10px] font-black leading-tight transition duration-200 active:scale-95 sm:text-[11px] ${active ? "text-[#F0A000]" : "text-slate-600 hover:text-[#15803D]"} ${isScan ? "-mt-3" : "hover:bg-emerald-50/80"}`}><span className={`grid place-items-center transition duration-200 ${isScan ? "h-[52px] w-[52px] rounded-full bg-[#16A34A] text-white shadow-[0_8px_20px_rgba(22,163,74,.28)] ring-4 ring-white group-hover:bg-[#15803D] sm:h-14 sm:w-14" : active ? "h-7 w-7 rounded-xl bg-[#FFF8DB]" : "h-7 w-7"}`}><Icon size={isScan ? 25 : 21} /></span><span className="max-w-full truncate">{label}</span></a>; })}</nav>;
}

function FooterDash() { return <footer className="flex flex-col gap-4 border-t py-5 text-sm text-slate-500 md:flex-row md:items-center md:justify-between"><Logo /><p>© 2025 Kelurahan Tamansari. All rights reserved.</p><div className="flex gap-6"><a>Kebijakan Privasi</a><a>Syarat & Ketentuan</a></div></footer>; }
function State({ title, text }: { title: string; text: string }) { return <main className="min-h-screen bg-[#F7F9FC] p-10"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto text-[#1557D6]" size={44} /><h1 className="mt-4 text-2xl font-extrabold">{title}</h1><p className="mt-2 text-slate-600">{text}</p></section></main>; }
function PendingVerification() { return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(255,196,0,.2),transparent_30%),linear-gradient(180deg,#f8fafc,#eef7f0)] px-5 py-10 text-[#172033]"><section className="w-full max-w-xl rounded-3xl border border-amber-200/80 bg-white/95 p-7 text-center shadow-[0_20px_60px_rgba(15,23,42,.1)] sm:p-10"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Clock3 size={34} aria-hidden="true" /></div><h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Akun Menunggu Verifikasi</h1><p className="mt-4 text-base font-bold text-slate-700">Akun Anda sedang menunggu verifikasi petugas.</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Petugas Kelurahan Tamansari sedang memverifikasi data NIK, KK, dan profil Anda.</p><span className="mt-6 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-800"><Clock3 className="mr-2 size-4" aria-hidden="true" />Menunggu Verifikasi</span><p className="mt-5 text-xs font-semibold leading-5 text-slate-500">Anda akan dapat menggunakan seluruh layanan setelah akun diverifikasi.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200">Kembali ke Halaman Utama</Link></section></main>; }
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