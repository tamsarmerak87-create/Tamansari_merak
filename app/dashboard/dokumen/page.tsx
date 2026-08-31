"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileImage, FileText, FolderOpen, MoreHorizontal, Pencil, RefreshCw, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { BackButton } from "@/components/warga/back-button";
import { accessWargaDokumen, deleteMyDocument, getDocumentManagementPolicy, getMyDocumentsFromPengajuan, getMyPengajuan, renameMyDocument, replaceMyDocument, type DokumenPengajuan } from "@/services/warga-pengajuan.service";

export default function DokumenSayaPage() {
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();
    const [docs, setDocs] = useState<DokumenPengajuan[]>([]);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<Filter>("Semua");
    const [sort, setSort] = useState("terbaru");
    const [notice, setNotice] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user || !profile) { if (!loading) void Promise.resolve().then(() => setFetching(false)); return; } void refresh(); }, [loading, user, profile]);

    async function refresh() {
        if (!profile) return;
        try {
            setFetching(true);
            setError("");
            const items = await getMyPengajuan(profile);
            setDocs(getMyDocumentsFromPengajuan(items));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Data belum dapat dimuat.");
        } finally {
            setFetching(false);
        }
    }

    const grouped = useMemo(() => docs.filter((doc) => filter === "Semua" || documentKind(doc) === filter).sort((a, b) => {
        if (sort === "nama-az") return displayName(a).localeCompare(displayName(b), "id");
        if (sort === "nama-za") return displayName(b).localeCompare(displayName(a), "id");
        const delta = new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        return sort === "terlama" ? -delta : delta;
    }), [docs, filter, sort]);

    if (loading || !user || !profile) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat dokumen...</main>;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-7xl space-y-6"><BackButton /><Hero title="Dokumen Saya" text="Dokumen yang Anda upload saat membuat pengajuan." />{notice ? <div role="status" className="rounded-2xl bg-emerald-50 p-4 font-black text-emerald-800">✓ {notice}</div> : null}<div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">ℹ Halaman ini hanya menampilkan dokumen yang Anda upload sendiri. Dokumen hasil pelayanan dapat dilihat pada menu <b>Berkas Pengajuan</b>.</div><section className="rounded-[28px] bg-white p-5 shadow-soft sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><h2 className="flex items-center gap-2 text-xl font-black text-gov-950"><FolderOpen className="text-accent-500" /> Dokumen Upload Saya · {docs.length} Dokumen</h2><div className="flex flex-wrap items-center gap-2"><select aria-label="Urutkan dokumen" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 font-bold"><option value="terbaru">Terbaru</option><option value="terlama">Terlama</option><option value="nama-az">Nama A-Z</option><option value="nama-za">Nama Z-A</option></select><Button type="button" variant="glass" onClick={() => void refresh()}><RefreshCw size={18} /> Refresh</Button></div></div><div className="mt-5 flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-4 py-2 text-sm font-black ${filter === item ? "bg-gov-900 text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}</div>{fetching ? <State text="Memuat dokumen..." /> : error ? <State text="Dokumen gagal dimuat." retry onRetry={refresh} /> : grouped.length === 0 ? <Empty hasDocs={docs.length > 0} onCreate={() => router.push("/layanan")} /> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{grouped.map((doc) => <DocumentCard key={doc.id ?? `${doc.pengajuan_id}-${doc.url_file}`} doc={doc} verified={profile.status_verifikasi === "Terverifikasi" || profile.status_verifikasi === "Akun Terverifikasi"} onChanged={async (message) => { setNotice(message); await refresh(); }} />)}</div>}</section></section></main>;
}

type Filter = "Semua" | "PDF" | "Gambar" | "Dokumen Lainnya";
const FILTERS: Filter[] = ["Semua", "PDF", "Gambar", "Dokumen Lainnya"];
function extension(doc: DokumenPengajuan) { return (doc.nama_file || doc.url_file || "file").split("?")[0].split(".").pop()?.toLowerCase() || "file"; }
function documentKind(doc: DokumenPengajuan): Filter { const value = extension(doc); return value === "pdf" ? "PDF" : ["jpg", "jpeg", "png", "webp", "gif"].includes(value) ? "Gambar" : "Dokumen Lainnya"; }
function displayName(doc: DokumenPengajuan) { return String(doc.metadata?.display_name || doc.jenis || doc.nama_file?.split(/[\\/]/).pop() || "Dokumen"); }

function DocumentCard({ doc, verified, onChanged }: { doc: DokumenPengajuan; verified: boolean; onChanged: (message: string) => Promise<void> }) {
    const href = Boolean(doc.id);
    const isImage = documentKind(doc) === "Gambar";
    const manageable = getDocumentManagementPolicy(doc) === "MANAGEABLE" && Boolean(doc.id);
    const [menu, setMenu] = useState(false); const [editing, setEditing] = useState(false); const [name, setName] = useState(displayName(doc)); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState("");
    async function run(action: () => Promise<{ message?: string }>) { try { setBusy(true); setActionError(""); const result = await action(); setMenu(false); setEditing(false); await onChanged(result.message || "Dokumen berhasil diperbarui."); } catch (e) { setActionError(e instanceof Error ? e.message : "Dokumen gagal diperbarui."); } finally { setBusy(false); } }
    async function access(download = false) { try { setActionError(""); await accessWargaDokumen(doc.id!, download, "supporting"); } catch (e) { setActionError(e instanceof Error ? e.message : "Dokumen gagal dimuat."); } }
    return <article className="relative rounded-[26px] border border-slate-100 bg-white p-5 shadow-soft"><div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gov-50 text-gov-900">{isImage ? <FileImage /> : <FileText />}</div><span className="rounded-full bg-gov-50 px-3 py-1 text-xs font-black text-gov-900 ring-1 ring-slate-200">{extension(doc).toUpperCase()}</span></div><p className="mt-4 truncate text-lg font-black text-gov-950" title={displayName(doc)}>{displayName(doc)}</p>{!manageable && verified ? <p className="mt-1 text-sm font-black text-emerald-700">✓ Terverifikasi di Akun</p> : null}<p className="mt-2 text-sm font-bold text-slate-500">Diupload: {doc.created_at ? new Date(doc.created_at).toLocaleString("id-ID") : "-"}</p><p className="mt-1 text-sm font-bold text-slate-500">Ukuran: {typeof doc.metadata?.size === "number" ? `${(doc.metadata.size / 1048576).toLocaleString("id-ID", { maximumFractionDigits: 2 })} MB` : "-"}</p>{actionError ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{actionError}</p> : null}{href ? <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void access(false)} className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-border-soft bg-white px-4 py-3 text-sm font-black text-gov-900 shadow-soft"><Eye size={16} /> Lihat</button><button type="button" onClick={() => void access(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-accent-400 px-4 py-3 text-sm font-black text-gov-950 shadow-soft"><Download size={16} /> Download</button>{manageable ? <button type="button" aria-label={`Kelola ${displayName(doc)}`} onClick={() => setMenu(!menu)} className="min-h-[44px] rounded-2xl border px-3"><MoreHorizontal /></button> : null}</div> : <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">Dokumen tidak tersedia.</p>}{menu ? <div className="absolute bottom-16 right-5 z-10 w-52 rounded-2xl border bg-white p-2 shadow-xl"><button onClick={() => { setEditing(true); setMenu(false); }} className="flex w-full gap-2 rounded-xl p-3 font-bold hover:bg-slate-50"><Pencil size={17} /> Edit Nama</button><label className="flex cursor-pointer gap-2 rounded-xl p-3 font-bold hover:bg-slate-50"><RotateCw size={17} /> Upload Ulang<input disabled={busy} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file && doc.id) void run(() => replaceMyDocument(doc.id!, file)); e.target.value = ""; }} /></label><button disabled={busy} onClick={() => { if (doc.id && window.confirm(`Hapus ${displayName(doc)}? Tindakan ini tidak dapat dibatalkan.`)) void run(() => deleteMyDocument(doc.id!)); }} className="flex w-full gap-2 rounded-xl p-3 font-bold text-red-700 hover:bg-red-50"><Trash2 size={17} /> Hapus</button></div> : null}{editing ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-2xl font-black text-gov-950">Edit Nama Dokumen</h2><label className="mt-5 block font-bold">Nama:<input autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-2xl border p-3" /></label>{actionError ? <p className="mt-3 text-sm font-bold text-red-700">{actionError}</p> : null}<div className="mt-5 flex justify-end gap-2"><button disabled={busy} onClick={() => setEditing(false)} className="rounded-xl bg-slate-100 px-4 py-3 font-black">Batal</button><button disabled={busy || !name.trim()} onClick={() => doc.id && void run(() => renameMyDocument(doc.id!, name))} className="rounded-xl bg-gov-950 px-4 py-3 font-black text-white">Simpan</button></div></section></div> : null}</article>;
}

function Hero({ title, text }: { title: string; text: string }) { return <div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><p className="font-black uppercase tracking-[.2em] text-accent-200">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">{title}</h1><p className="mt-3 text-white/75">{text}</p></div>; }
function State({ text, retry, onRetry }: { text: string; retry?: boolean; onRetry?: () => Promise<void> }) { return <section className="rounded-[24px] border border-white bg-white/85 p-8 text-center shadow-soft"><p className="font-bold text-slate-600">{text}</p>{retry && onRetry ? <button onClick={() => void onRetry()} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black">Coba Lagi</button> : null}</section>; }
function Empty({ hasDocs, onCreate }: { hasDocs: boolean; onCreate: () => void }) { return <section className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-10 text-center"><h3 className="text-2xl font-black text-gov-950">{hasDocs ? "Tidak ada dokumen" : "Belum Ada Dokumen"}</h3><p className="mt-2 font-bold text-slate-500">{hasDocs ? "Coba pilih kategori dokumen lain." : "Dokumen yang Anda upload saat membuat pengajuan akan muncul di sini."}</p>{!hasDocs ? <button type="button" onClick={onCreate} className="mt-5 rounded-xl bg-accent-400 px-5 py-3 font-black text-gov-950">+ Buat Pengajuan Sekarang</button> : null}</section>; }