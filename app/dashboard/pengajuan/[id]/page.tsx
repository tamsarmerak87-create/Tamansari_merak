"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { QRCodePelayanan } from "@/components/pengajuan/qr-code-pelayanan";
import { BackButton } from "@/components/warga/back-button";
import { deleteMyPengajuan, getDokumenUrl, getMyPengajuanDetail, resubmitMyPengajuan, type WargaPengajuan } from "@/services/warga-pengajuan.service";
import { removeSubmissionAttachments, uploadSubmissionAttachment } from "@/services/surat-online.service";

const journeySteps = ["Pengajuan Dikirim", "Petugas Pelayanan", "Petugas Lapangan", "Kepala Seksi", "Seklur", "Lurah", "Selesai"];
const MAX_REVISION_FILE_SIZE = 1024 * 1024;
const ALLOWED_REVISION_TYPES = ["application/pdf", "image/jpeg", "image/png"];

type TrackingStage = {
    nama_tahap: string;
    status: string;
    catatan: string | null;
    acted_at: string | null;
    approved_at: string | null;
    updated_at: string | null;
    tahap: number;
};

type StepState = "done" | "active" | "returned" | "rejected" | "waiting";

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(" pukul ", ", ") : "-";
}

function formatStepDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return `${date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} - ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}

function docUrl(url?: string | null) { return getDokumenUrl(url) || ""; }

function docLabel(jenis?: string | null, namaFile?: string | null) {
    const value = jenis || namaFile || "Dokumen";
    if (value.toLowerCase().includes("pendukung")) return "Dokumen Pendukung";
    return value.toUpperCase();
}

function serviceName(item: WargaPengajuan) {
    return item.layanan?.nama || item.keperluan || "Layanan Pengajuan";
}

function normalizeStage(stage: NonNullable<WargaPengajuan["verifikasi_pengajuan"]>[number]): TrackingStage {
    const rawName = (stage.nama_tahap ?? "Tahap Verifikasi").replace(/^Verifikasi\s+|^Persetujuan\s+/, "");
    const name = ["Staff Pelayanan", "Petugas Pelayanan"].includes(rawName) ? "Petugas Pelayanan" : rawName;
    return { nama_tahap: name, status: stage.status ?? "Menunggu", catatan: stage.catatan ?? null, acted_at: stage.acted_at ?? null, approved_at: stage.approved_at ?? null, updated_at: stage.updated_at ?? null, tahap: stage.tahap ?? 0 };
}

function isDoneStatus(status?: string | null) {
    return ["disetujui", "selesai", "approved", "processed", "done"].includes((status ?? "").toLowerCase());
}

function isActiveStatus(status?: string | null) {
    return ["diproses", "proses", "pending", "in_progress"].includes((status ?? "").toLowerCase());
}

function submissionStatus(item: WargaPengajuan) {
    return String(item.status ?? item.workflow_status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function isRevision(item: WargaPengajuan) {
    const statuses = [item.status, item.workflow_status].map((value) => String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_"));
    return statuses.some((status) => status === "REVISI" || status === "PERLU_REVISI" || status.includes("DIKEMBALIKAN")) || Boolean(item.returned_to_role && !item.active_stage);
}

function isRejected(item: WargaPengajuan) {
    return submissionStatus(item) === "DITOLAK";
}

function timelineFrom(item: WargaPengajuan): TrackingStage[] {
    const stages = [...(item.verifikasi_pengajuan ?? [])].sort((a, b) => (a.tahap ?? 0) - (b.tahap ?? 0)).map(normalizeStage);
    const byName = new Map(stages.map((stage) => [stage.nama_tahap.toLowerCase(), stage]));
    const complete = ["selesai", "disetujui", "approved", "completed"].includes((item.status ?? "").toLowerCase()) || Boolean(item.selesai_at);
    const lastDone = stages.reduce((max, stage) => isDoneStatus(stage.status) ? Math.max(max, journeySteps.findIndex((step) => step.toLowerCase() === stage.nama_tahap.toLowerCase())) : max, 0);
    const returned = isRevision(item);
    const rejected = isRejected(item);
    const activeStageName = item.active_stage ? normalizeStage(item.active_stage).nama_tahap : null;
    const activeIndex = complete ? journeySteps.length - 1 : activeStageName
        ? journeySteps.findIndex((step) => step.toLowerCase() === activeStageName.toLowerCase())
        : stages.findIndex((stage) => isActiveStatus(stage.status)) + 1;

    return journeySteps.map((step, index) => {
        const existing = byName.get(step.toLowerCase());
        if (existing) return existing;
        const status = complete || index === 0 || index <= lastDone ? "Disetujui" : !returned && !rejected && index === activeIndex ? "Diproses" : "Menunggu";
        return { nama_tahap: step, status, catatan: null, acted_at: index === 0 ? item.created_at ?? null : index === journeySteps.length - 1 ? item.selesai_at ?? null : null, approved_at: null, updated_at: null, tahap: index };
    });
}

function stepState(stage: TrackingStage, item: WargaPengajuan, itemComplete: boolean): StepState {
    if (itemComplete || isDoneStatus(stage.status)) return "done";
    if ((stage.status ?? "").toLowerCase() === "ditolak") return isRevision(item) ? "returned" : "rejected";
    if (isActiveStatus(stage.status)) return "active";
    return "waiting";
}

function statusSummary(item: WargaPengajuan, timeline: TrackingStage[]) {
    const complete = ["selesai", "disetujui", "approved", "completed"].includes((item.status ?? "").toLowerCase()) || Boolean(item.selesai_at);
    if (complete) return { label: "Pengajuan Selesai", icon: "✓", className: "bg-emerald-100 text-emerald-800 ring-emerald-200", message: "Dokumen Anda telah selesai diproses." };
    const returnedStage = timeline.find((stage) => (stage.status ?? "").toLowerCase() === "ditolak");
    const revisionNote = item.revision_note ?? returnedStage?.catatan ?? item.alasan_penolakan ?? null;
    if (isRevision(item)) return { label: "Perlu Revisi", icon: "!", className: "bg-amber-100 text-amber-900 ring-amber-300", message: `Pengajuan dikembalikan untuk revisi${returnedStage ? ` oleh ${returnedStage.nama_tahap}` : ""}.`, note: revisionNote };
    if (isRejected(item)) return { label: "Pengajuan Ditolak", icon: "×", className: "bg-red-100 text-red-800 ring-red-200", message: "Pengajuan Anda ditolak dan tidak dapat dilanjutkan.", note: revisionNote };
    const active = timeline.find((stage) => isActiveStatus(stage.status));
    return { label: active ? "Sedang Diproses" : "Menunggu Proses", icon: active ? "●" : "○", className: "bg-[#FFF3B0] text-[#8A5A00] ring-[#FFC400]", message: active ? `Pengajuan Anda sedang diproses oleh ${active.nama_tahap}.` : "Pengajuan menunggu tahap proses berikutnya." };
}

export default function DetailPengajuanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const toast = useToast();
    const { user, profile, loading } = useWargaAuth();
    const [item, setItem] = useState<WargaPengajuan | null>(null);
    const [fetching, setFetching] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [revisionFiles, setRevisionFiles] = useState<File[]>([]);
    const [deletedDocumentIds, setDeletedDocumentIds] = useState<string[]>([]);
    const [revisionForm, setRevisionForm] = useState({ keperluan: "", catatan: "", alamat: "", rt: "", rw: "", kelurahan: "", kecamatan: "", no_hp: "", email: "" });
    const notifiedStatus = useRef<string | null>(null);

    function goBack() {
        if (window.history.length > 1 && document.referrer.includes(window.location.origin)) router.back();
        else router.push("/dashboard");
    }

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { if (!user || !profile) { if (!loading) setFetching(false); return; } void (async () => { try { setFetching(true); setItem(await getMyPengajuanDetail(id, profile)); } catch (error) { console.error(error); setItem(null); } finally { setFetching(false); } })(); }, [loading, user, profile, id]);

    const timeline = useMemo(() => item ? timelineFrom(item) : [], [item]);
    const summary = useMemo(() => item ? statusSummary(item, timeline) : null, [item, timeline]);

    function openRevision() {
        if (!item) return;
        setRevisionForm({ keperluan: item.keperluan ?? "", catatan: item.catatan ?? "", alamat: item.alamat ?? "", rt: item.rt ?? "", rw: item.rw ?? "", kelurahan: item.kelurahan ?? "", kecamatan: item.kecamatan ?? "", no_hp: item.no_hp ?? "", email: item.email ?? "" });
        setRevisionFiles([]);
        setDeletedDocumentIds([]);
        setEditing(true);
    }

    function addRevisionFiles(files: File[]) {
        for (const file of files) {
            if (!ALLOWED_REVISION_TYPES.includes(file.type)) return toast.error("Format file hanya PDF, JPG, JPEG, atau PNG.");
            if (file.size > MAX_REVISION_FILE_SIZE) return toast.error("Ukuran file maksimal 1 MB.");
        }
        setRevisionFiles((current) => [...current, ...files]);
    }

    async function submitRevision() {
        if (!item || !user || !revisionForm.keperluan.trim()) return toast.error("Keperluan wajib diisi");
        const invalidFile = revisionFiles.find((file) => !ALLOWED_REVISION_TYPES.includes(file.type) || file.size > MAX_REVISION_FILE_SIZE);
        if (invalidFile) return toast.error(invalidFile.size > MAX_REVISION_FILE_SIZE ? "Ukuran file maksimal 1 MB." : "Format file hanya PDF, JPG, JPEG, atau PNG.");
        const uploadedPaths: string[] = [];
        try {
            setSaving(true);
            // Unggah berurutan agar setiap path yang berhasil selalu tercatat dan dapat dibersihkan bila upload/API berikutnya gagal.
            const uploads = [];
            const revisionBatch = `revisi-${item.id}-${Date.now()}`;
            for (const [index, file] of revisionFiles.entries()) {
                const upload = await uploadSubmissionAttachment(`pendukung-${index + 1}` as "pendukung", file, user.id, revisionBatch);
                uploads.push(upload);
                uploadedPaths.push(upload.path);
            }
            await resubmitMyPengajuan(item.id, { ...revisionForm, documents: uploads.map((upload) => ({ nama_file: upload.name, url_file: upload.path, type: upload.type, size: upload.size })), deleted_document_ids: deletedDocumentIds });
            toast.success("Perbaikan berhasil dikirim ulang");
            setEditing(false);
            setRevisionFiles([]);
            setDeletedDocumentIds([]);
            setItem(await getMyPengajuanDetail(item.id, profile));
        } catch (error) {
            if (uploadedPaths.length) await removeSubmissionAttachments(uploadedPaths).catch(() => undefined);
            toast.error(error instanceof Error ? error.message : "Gagal mengirim ulang pengajuan");
        } finally {
            setSaving(false);
        }
    }

    async function removePengajuan() {
        if (!item || !window.confirm(`Hapus pengajuan ${item.nomor_pengajuan}?\n\nTindakan ini tidak dapat dibatalkan.`)) return;
        try {
            setDeleting(true);
            await deleteMyPengajuan(item.id);
            toast.success("Pengajuan berhasil dihapus");
            router.push("/dashboard/pengajuan");
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal menghapus pengajuan");
            setDeleting(false);
        }
    }

    useEffect(() => {
        if (!item || !summary) return;
        const active = timeline.find((stage) => isActiveStatus(stage.status));
        const key = `${item.id}-${item.status}-${active?.nama_tahap}`;
        if (notifiedStatus.current === key) return;
        notifiedStatus.current = key;
        if (summary.label === "Pengajuan Selesai") toast.success("Pengajuan telah selesai");
        else if (active) toast.info(`Pengajuan diteruskan ke ${active.nama_tahap}`);
    }, [item, summary, timeline, toast]);

    if (loading || !user || fetching) return <main className="min-h-screen bg-[#F7F8F5] p-10 font-black text-[#172033]">Memuat status pengajuan...</main>;
    if (!item) return <main className="min-h-screen bg-[#F7F8F5] px-5 py-16 sm:px-10 lg:px-20"><section className="mx-auto max-w-2xl rounded-[28px] border border-[#E8E8E8] bg-white p-8 text-center shadow-sm"><h1 className="text-3xl font-black text-[#172033]">Pengajuan tidak ditemukan.</h1><p className="mt-4 leading-7 text-slate-600">Data tidak tersedia atau bukan milik akun warga yang sedang login.</p><Button type="button" className="mt-6" variant="gold" onClick={goBack}>Kembali ke Dashboard</Button></section></main>;

    const documents = (item.dokumen_pengajuan ?? []).filter((doc) => Boolean(doc.url_file));
    const name = serviceName(item);
    const complete = summary?.label === "Pengajuan Selesai";
    return <main className="min-h-screen bg-[#F7F8F5] px-4 py-6 text-[#172033] sm:px-8 lg:px-16"><section className="mx-auto max-w-6xl"><BackButton onClick={() => router.push("/dashboard")} className="mb-4" />
        <header className="rounded-[30px] border border-[#E8E8E8] bg-[linear-gradient(135deg,#FFF3B0,#FFFFFF_50%,#EAF8EF)] p-6 shadow-sm sm:p-8"><p className="text-sm font-black uppercase tracking-[.18em] text-[#15803D]">Status Pengajuan</p><h1 className="mt-3 break-words text-3xl font-black sm:text-5xl">{item.nomor_pengajuan}</h1><p className="mt-3 text-lg font-black uppercase text-slate-700">{name}</p><div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ring-1 ${summary?.className}`}><span>{summary?.icon}</span>{summary?.label}</div><p className="mt-3 max-w-2xl font-semibold text-slate-600">{summary?.message}</p>{summary?.note ? <div className="mt-4 max-w-2xl rounded-2xl border border-amber-200 bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-amber-800">Catatan Revisi</p><p className="mt-1 whitespace-pre-wrap font-semibold text-slate-700">{summary.note}</p></div> : null}{isRevision(item) ? <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button type="button" variant="gold" onClick={openRevision}><Pencil size={17} />Lengkapi / Perbaiki Pengajuan</Button><Button type="button" variant="glass" className="border-red-300 text-red-700 hover:bg-red-50" disabled={deleting} onClick={removePengajuan}><Trash2 size={17} />{deleting ? "Menghapus..." : "Hapus Pengajuan"}</Button></div> : null}{complete ? <p className="mt-2 font-black text-emerald-700">Silakan lihat atau download dokumen Anda.</p> : null}</header>
        {editing ? <section className="mt-6 rounded-[26px] border-2 border-amber-300 bg-amber-50/70 p-5 shadow-sm sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-amber-800">Kirim Ulang Revisi</p><h2 className="mt-1 text-2xl font-black">Perbaiki data dan dokumen</h2><p className="mt-2 font-semibold text-slate-600">Pengajuan tetap menggunakan nomor dan tahap workflow yang sama.</p></div><button type="button" className="font-black text-slate-500" onClick={() => setEditing(false)}>Tutup</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{Object.entries(revisionForm).map(([key, value]) => <label key={key} className={key === "keperluan" || key === "catatan" || key === "alamat" ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-black capitalize">{key.replace("no_hp", "Nomor HP").replace("_", " ")}{key === "keperluan" ? " *" : ""}</span>{key === "keperluan" || key === "catatan" || key === "alamat" ? <textarea className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none focus:ring-4 focus:ring-amber-200" value={value} onChange={(event) => setRevisionForm((current) => ({ ...current, [key]: event.target.value }))} /> : <input type={key === "email" ? "email" : "text"} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-semibold outline-none focus:ring-4 focus:ring-amber-200" value={value} onChange={(event) => setRevisionForm((current) => ({ ...current, [key]: event.target.value }))} />}</label>)}</div><div className="mt-5 rounded-2xl border border-dashed border-amber-400 bg-white p-4"><p className="font-black">Dokumen Perbaikan</p><div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-slate-600"><p className="font-black text-amber-900">Keterangan</p><p>Pastikan dokumen jelas dan mudah dibaca.</p><p>PDF/JPG/PNG, maksimal 1 MB.</p><p>Dokumen yang tidak sesuai dapat dihapus dan diganti sebelum dikirim ulang.</p></div><label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#172033] px-4 text-sm font-black text-white"><Upload size={16} />Pilih Dokumen<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => { addRevisionFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></label><div className="mt-4 grid gap-3 sm:grid-cols-2">{documents.filter((doc) => doc.id && !deletedDocumentIds.includes(doc.id)).map((doc) => <DocumentCard key={doc.id} name={doc.nama_file || "Dokumen lama"} url={docUrl(doc.url_file)} onRemove={() => setDeletedDocumentIds((current) => [...current, doc.id!])} />)}{revisionFiles.map((file, index) => <DocumentCard key={`${file.name}-${file.lastModified}-${index}`} name={file.name} file={file} onRemove={() => setRevisionFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button type="button" variant="gold" disabled={saving} onClick={submitRevision}>{saving ? "Mengirim ulang..." : "Kirim Ulang Perbaikan"}</Button><Button type="button" variant="glass" disabled={saving} onClick={() => setEditing(false)}>Batal</Button></div></section> : null}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]"><div className="space-y-6"><section className="rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Informasi Pengajuan</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Nomor Pengajuan" value={item.nomor_pengajuan || "-"} /><Info label="Layanan" value={name} /><Info label="Keperluan" value={item.keperluan || "-"} /><Info label="Tanggal Pengajuan" value={formatDate(item.created_at)} /><Info label="Status" value={`${summary?.icon ?? "○"} ${summary?.label ?? "Menunggu proses"}`} /></div></section>
            <section className="rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Perjalanan Dokumen</h2><div className="mt-6">{timeline.map((stage, index) => <JourneyItem key={`${stage.nama_tahap}-${index}`} stage={stage} index={index} state={stepState(stage, item, complete)} isLast={index === timeline.length - 1} />)}</div></section>
            <section className="rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Dokumen Pengajuan</h2>{documents.length ? <div className="mt-4 divide-y divide-slate-100">{documents.map((doc) => { const label = docLabel(doc.jenis, doc.nama_file); const url = docUrl(doc.url_file); return <div key={doc.id ?? `${item.id}-${doc.url_file}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100"><FileText size={18} /></span><div><p className="font-black">{label}</p><p className="text-xs font-bold text-slate-500">{formatDate(doc.created_at ?? item.created_at)}</p></div></div>{url ? <div className="flex gap-2"><a className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#DADDE3] bg-white px-4 text-sm font-black hover:bg-slate-50" href={url} target="_blank" rel="noreferrer">Lihat</a><a className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#FFC400] px-4 text-sm font-black hover:bg-[#FFD84D]" href={url} download>Download</a></div> : null}</div>; })}</div> : <p className="mt-4 font-bold text-slate-500">Belum ada dokumen untuk pengajuan ini.</p>}</section></div>
            <aside className="lg:sticky lg:top-6 lg:h-fit"><QRCodePelayanan nomorPengajuan={item.nomor_pengajuan} status={summary?.label} tanggal={formatDate(item.created_at)} layanan={name} size={170} /></aside></div>
        <button type="button" onClick={goBack} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#172033] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#2A3448]"><ArrowLeft size={18} />Kembali ke Dashboard</button></section></main>;
}

function Info({ label, value }: { label: string; value: string }) {
    return <div className="rounded-2xl bg-[#F7F8F5] p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-1 break-words font-black text-[#172033]">{value}</p></div>;
}

function DocumentCard({ name, file, url, onRemove }: { name: string; file?: File; url?: string; onRemove: () => void }) {
    const inferredName = useMemo(() => {
        if (name && name !== "Dokumen lama") return name;
        const rawPath = url?.split("?")[0].split("/").pop();
        return rawPath ? decodeURIComponent(rawPath) : name;
    }, [name, url]);
    const extension = inferredName.split(".").pop()?.toLowerCase();
    const type = file?.type || (extension === "pdf" ? "application/pdf" : ["jpg", "jpeg", "png"].includes(extension ?? "") ? `image/${extension === "jpg" ? "jpeg" : extension}` : "Dokumen tersimpan");
    const preview = useMemo(() => file && file.type.startsWith("image/") ? URL.createObjectURL(file) : url, [file, url]);
    useEffect(() => () => { if (file && preview) URL.revokeObjectURL(preview); }, [file, preview]);
    return <div className="rounded-2xl border border-slate-200 p-3"><div className="grid h-28 place-items-center overflow-hidden rounded-xl bg-slate-100">{preview && type.startsWith("image/") ? <img src={preview} alt={`Preview ${inferredName}`} className="h-full w-full object-cover" /> : type === "application/pdf" && preview ? <iframe src={`${preview}#toolbar=0&navpanes=0`} title={`Preview ${inferredName}`} className="h-full w-full border-0" /> : <div className="text-center text-red-700"><FileText className="mx-auto" /><span className="text-xs font-black">{type === "application/pdf" ? "PDF" : "FILE"}</span></div>}</div><p className="mt-2 break-all text-sm font-black">{inferredName}</p><p className="text-xs font-semibold text-slate-500">{type}{file ? ` - ${(file.size / 1024).toFixed(1)} KB` : " - ukuran tersimpan"}</p><button type="button" className="mt-3 inline-flex items-center gap-2 text-sm font-black text-red-700" onClick={onRemove}><Trash2 size={15} />Hapus Dokumen</button></div>;
}

function JourneyItem({ stage, index, state, isLast }: { stage: TrackingStage; index: number; state: StepState; isLast: boolean }) {
    const timestamp = stage.acted_at || stage.approved_at || stage.updated_at;
    const tone = state === "done" ? { icon: "✓", badge: "bg-[#16A34A] text-white", text: "Sudah diproses", card: "bg-emerald-50/70 border-emerald-100" } : state === "active" ? { icon: "●", badge: "bg-[#FFC400] text-[#172033]", text: "Sedang diproses", card: "bg-[#FFF8DB] border-[#FFC400]" } : state === "returned" ? { icon: "!", badge: "bg-amber-500 text-white", text: "Dikembalikan untuk revisi", card: "bg-amber-50 border-amber-300" } : state === "rejected" ? { icon: "×", badge: "bg-red-600 text-white", text: "Ditolak", card: "bg-red-50 border-red-200" } : { icon: "○", badge: "bg-slate-100 text-slate-500", text: "Menunggu proses", card: "bg-white border-slate-100" };
    return <div className="grid grid-cols-[44px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-black ${tone.badge}`}>{tone.icon}</span>{!isLast ? <span className="my-2 h-full min-h-8 w-0.5 bg-slate-200" /> : null}</div><div className={`mb-3 rounded-2xl border p-4 ${tone.card}`}><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Tahap {index + 1}</p><h3 className="mt-1 text-lg font-black">{stage.nama_tahap}</h3><p className="mt-1 font-black text-slate-700">{tone.text}</p>{state === "active" ? <p className="mt-1 text-sm font-semibold text-slate-600">Pengajuan Anda sedang diproses oleh {stage.nama_tahap}.</p> : null}{stage.catatan ? <p className="mt-2 text-sm font-semibold text-slate-500">{stage.catatan}</p> : null}{timestamp ? <p className="mt-2 text-sm font-black text-slate-500">{formatStepDate(timestamp)}</p> : null}</div></div>;
}