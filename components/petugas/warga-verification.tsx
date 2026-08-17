"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentPetugasPortalUser, type AdminPortalProfile } from "@/services/admin-auth.service";

type Row = Record<string, any>;

const hiddenExtraFields = new Set(["password", "password_hash", "token", "access_token", "refresh_token", "verification_history", "documents", "profile_change_requests", "active_stage", "return_targets", "foto_url"]);
const knownFields = new Set(["nama_lengkap", "nik", "nomor_kk", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "email", "nomor_hp", "nomor_whatsapp", "alamat", "rt", "rw", "kelurahan", "kecamatan", "status_verifikasi", "tahap_verifikasi", "created_at", "handled_by", "handled_by_name"]);

const steps = [
    { label: "Registrasi", role: null, status: "Registrasi" },
    { label: "Staff Pelayanan", role: "staff_pelayanan", status: "Menunggu Staff Pelayanan" },
    { label: "Petugas Lapangan", role: "petugas_lapangan", status: "Menunggu Petugas Lapangan" },
    { label: "Kasi", role: "kepala_seksi", status: "Menunggu Kasi" },
    { label: "Sek Lur", role: "seklur", status: "Menunggu Sek Lur" },
    { label: "Lurah", role: "lurah", status: "Menunggu Lurah" },
    { label: "Terverifikasi", role: null, status: "Terverifikasi" },
];

function getStepIndex(row: Row, history: Row[]) {
    if (row.status_verifikasi === "Terverifikasi") return steps.length - 1;
    if (row.status_verifikasi === "Dikembalikan") return Math.max(1, steps.findIndex((step) => step.role === row.returned_to_role));
    const activeRoleIndex = steps.findIndex((step) => step.role && step.role === row.active_stage?.role);
    if (activeRoleIndex > -1) return activeRoleIndex;
    const statusIndex = steps.findIndex((step) => step.status === row.status_verifikasi || step.label === row.tahap_verifikasi);
    if (statusIndex > -1) return statusIndex;
    const lastHistory = [...history].reverse().find((item) => item.status_sesudah || item.returned_to_role);
    if (lastHistory?.returned_to_role) return Math.max(1, steps.findIndex((step) => step.role === lastHistory.returned_to_role));
    return 1;
}

function formatDate(value?: string | null) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(date); }
function formatBytes(value?: number | string | null) { const n = Number(value); if (!n) return "-"; if (n < 1024) return `${n} B`; if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`; return `${(n / 1024 / 1024).toFixed(1)} MB`; }
function showValue(value: any) { if (value === null || value === undefined || value === "") return "-"; if (typeof value === "boolean") return value ? "Ya" : "Tidak"; if (typeof value === "object") return JSON.stringify(value); return String(value); }
function pretty(key: string) { return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function isImage(doc: Row) { return /gambar|image|jpg|jpeg|png|webp/i.test(`${doc.tipe_file} ${doc.nama_file} ${doc.file_path ?? ""}`); }
function isPdf(doc: Row) { return /pdf/i.test(`${doc.tipe_file} ${doc.nama_file}`); }
function InfoCard({ label, value }: { label: string; value: any }) { return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="break-words font-black text-gov-950">{showValue(value)}</p></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black uppercase text-gov-950">{title}</h2><div className="mt-4">{children}</div></section>; }
function DocumentPreview({ doc }: { doc: Row }) {
    if (!doc.file_url) return <div className="grid h-40 place-items-center p-4 text-center font-bold text-slate-500">File tidak dapat dibuatkan tautan aman.</div>;
    if (isImage(doc)) return <img src={doc.file_url} alt={doc.nama_dokumen} className="max-h-80 w-full object-contain" />;
    if (isPdf(doc)) return <iframe src={doc.file_url} title={doc.nama_dokumen} className="h-80 w-full" />;
    return <div className="grid h-40 place-items-center p-4 text-center font-bold text-slate-500">Preview tidak tersedia untuk tipe file ini.</div>;
}

export function PetugasWargaVerification({ id }: { id: string }) {
    const router = useRouter();
    const [profile, setProfile] = useState<AdminPortalProfile | null>(null);
    const [row, setRow] = useState<Row | null>(null);
    const [reason, setReason] = useState("");
    const [returnToRole, setReturnToRole] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            const me = await getCurrentPetugasPortalUser();
            if (!me.profile) return router.replace("/petugas/login");
            setProfile(me.profile);
            const res = await fetch(`/api/petugas/verifikasi-warga?id=${id}`, { credentials: "include", cache: "no-store" });
            const json = await res.json();
            setRow(json.data ?? null);
            setReturnToRole(json.data?.return_targets?.[0]?.role ?? json.return_targets?.[0]?.role ?? "");
        })();
    }, [id, router]);

    async function act(action: string) {
        if (["kembalikan", "tolak"].includes(action) && !reason.trim()) return alert("Alasan wajib diisi.");
        if (action === "kembalikan" && returnTargets.length && !returnToRole) return alert("Pilih tujuan pengembalian.");
        if (action === "setujui") { const message = row?.active_stage?.role === "lurah" ? "Verifikasi akun warga ini?" : `Teruskan akun ini ke ${nextStage?.label ?? "tahap berikutnya"}?`; if (!confirm(message)) return; }
        setBusy(true);
        const res = await fetch("/api/petugas/verifikasi-warga", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action, alasan: reason, returned_to_role: returnToRole }) });
        setBusy(false);
        if (res.ok) router.push("/petugas/dashboard");
        else alert((await res.json()).error ?? "Gagal memproses.");
    }

    const history = useMemo(() => Array.isArray(row?.verification_history) ? row.verification_history : [], [row]);
    const documents = useMemo(() => Array.isArray(row?.documents) ? row.documents : [], [row]);
    const profilePhoto = useMemo(() => documents.find((doc: Row) => doc.id === "foto-profil"), [documents]);
    const returnTargets = Array.isArray(row?.return_targets) ? row.return_targets : [];
    if (!profile || !row) return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-center font-bold">Memuat verifikasi warga...</main>;
    const current = row.active_stage?.label ?? row.tahap_verifikasi ?? row.status_verifikasi;
    const currentStep = getStepIndex(row, history);
    const extraFields = Object.entries(row).filter(([key, value]) => !hiddenExtraFields.has(key) && !knownFields.has(key) && value !== null && value !== undefined && value !== "");
    const nextStage = steps[steps.findIndex((s) => s.role === row.active_stage?.role) + 1];

    return <main className="min-h-screen overflow-x-hidden bg-slate-50 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-6xl space-y-5">
            <Link href="/petugas/dashboard" className="inline-flex rounded-2xl bg-white px-4 py-3 font-black shadow-sm">Kembali</Link>
            <header className="rounded-[2rem] bg-gov-950 p-5 text-white md:p-6">
                <p className="text-xs font-black tracking-[0.3em] text-accent-300">VERIFIKASI AKUN WARGA</p>
                <h1 className="mt-2 break-words text-3xl font-black md:text-4xl">{row.nama_lengkap}</h1>
                <div className="mt-4 grid gap-3 md:grid-cols-4">{[["Status", row.status_verifikasi], ["Tahap", current], ["Petugas menangani", row.handled_by_name ?? row.handled_by ?? "Belum ditugaskan"], ["Role/tahap petugas", row.active_stage?.label ?? profile.role]].map(([a, b]) => <div key={String(a)} className="rounded-2xl bg-white/10 p-3"><p className="text-xs font-black uppercase opacity-80">{a}</p><p className="break-words font-black">{showValue(b)}</p></div>)}</div>
            </header>
            <Section title="Profil Warga"><div className="grid gap-4 md:grid-cols-2"><InfoCard label="Nama lengkap" value={row.nama_lengkap} /><InfoCard label="NIK" value={row.nik} /><InfoCard label="Nomor KK" value={row.nomor_kk} /><InfoCard label="Tempat lahir" value={row.tempat_lahir} /><InfoCard label="Tanggal lahir" value={row.tanggal_lahir} /><InfoCard label="Jenis kelamin" value={row.jenis_kelamin} /></div><div className="mt-4 grid gap-4 md:grid-cols-3"><InfoCard label="Email" value={row.email} /><InfoCard label="Nomor HP" value={row.nomor_hp} /><InfoCard label="Nomor WhatsApp" value={row.nomor_whatsapp} /></div><div className="mt-4 grid gap-4 md:grid-cols-5"><div className="md:col-span-2"><InfoCard label="Alamat lengkap" value={row.alamat} /></div><InfoCard label="RT" value={row.rt} /><InfoCard label="RW" value={row.rw} /><InfoCard label="Kelurahan" value={row.kelurahan} /><InfoCard label="Kecamatan" value={row.kecamatan} /></div><div className="mt-4 grid gap-4 md:grid-cols-4"><InfoCard label="Status verifikasi" value={row.status_verifikasi} /><InfoCard label="Tahap verifikasi saat ini" value={current} /><InfoCard label="Tanggal pendaftaran" value={formatDate(row.created_at)} /><InfoCard label="Petugas yang menangani" value={row.handled_by_name ?? row.handled_by} /></div>{extraFields.length > 0 && <div className="mt-4 grid gap-4 md:grid-cols-3">{extraFields.map(([key, value]) => <InfoCard key={key} label={pretty(key)} value={value} />)}</div>}</Section>
            <Section title="Dokumen Yang Diupload">{profilePhoto?.file_url ? <div className="mb-4 rounded-3xl border bg-slate-50 p-4"><p className="text-xl font-black text-gov-950">Foto wajah</p><p className="text-sm font-bold text-slate-600">Selfie / foto profil warga</p><div className="mt-4 overflow-hidden rounded-2xl border bg-white"><img src={profilePhoto.file_url} alt="Foto wajah warga" className="max-h-80 w-full object-contain" /></div></div> : null}{documents.length ? <div className="grid gap-4 lg:grid-cols-2">{documents.map((doc: Row) => <article key={doc.id} className="rounded-3xl border bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xl font-black text-gov-950">{doc.nama_dokumen}</p><p className="text-sm font-bold text-slate-600">{doc.jenis_dokumen} - {doc.nama_file}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{doc.status ?? "Dokumen tersedia"}</span></div>{isImage(doc) && doc.file_url ? <div className="mt-4 grid gap-3 sm:grid-cols-[9rem_1fr]"><div className="overflow-hidden rounded-2xl border bg-white"><img src={doc.file_url} alt={`Thumbnail ${doc.nama_dokumen}`} className="h-32 w-full object-cover" /></div><div className="overflow-hidden rounded-2xl border bg-white"><DocumentPreview doc={doc} /></div></div> : <div className="mt-4 overflow-hidden rounded-2xl border bg-white"><DocumentPreview doc={doc} /></div>}<div className="mt-4 grid gap-2 text-sm font-bold text-slate-600 sm:grid-cols-3"><p>Jenis: {doc.tipe_file ?? "-"}</p><p>Ukuran: {formatBytes(doc.ukuran_file)}</p><p>Upload: {formatDate(doc.uploaded_at)}</p></div><p className="mt-2 text-xs font-bold text-slate-500">Tautan dokumen dibuat sebagai URL aman, bukan path storage mentah.</p>{doc.file_url ? <a href={doc.file_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full justify-center rounded-2xl bg-gov-950 px-4 py-3 font-black text-white sm:w-auto">Lihat Dokumen</a> : <p className="mt-4 rounded-2xl bg-red-50 p-3 font-bold text-red-700">File tidak dapat dibuatkan tautan aman.</p>}</article>)}</div> : !profilePhoto?.file_url ? <p className="rounded-2xl bg-slate-100 p-4 font-bold text-slate-600">Belum ada dokumen yang diupload warga.</p> : null}</Section>
            <section className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{steps.map((step, index) => {
                    const done = index < currentStep || row.status_verifikasi === "Terverifikasi";
                    const active = index === currentStep && row.status_verifikasi !== "Terverifikasi";
                    const returned = row.status_verifikasi === "Dikembalikan" && active;
                    return <div key={step.label} className={`min-w-0 rounded-2xl px-3 py-3 text-center text-sm font-black ${returned ? "bg-amber-100 text-amber-900" : done ? "bg-emerald-100 text-emerald-800" : active ? "bg-accent-300 text-gov-950" : "bg-slate-100 text-slate-500"}`}>{done ? "Selesai" : returned ? "Dikembalikan" : active ? "Aktif" : "Menunggu"}<br />{step.label}</div>;
                })}</div>
            </section>
            <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black text-gov-950">Riwayat Verifikasi</h2>{history.length ? history.map((h: Row, i: number) => <div key={i} className="mt-3 rounded-2xl border p-3"><p className="font-black text-gov-950">{formatDate(h.created_at)}</p><b>{h.nama_petugas ?? h.role} - {h.role ?? "-"}</b><p className="break-words">{h.action}: {h.status_sebelum} -&gt; {h.status_sesudah}</p><p className="text-sm text-slate-500">{h.catatan ? `Alasan/Catatan: ${h.catatan}` : "Tidak ada catatan"}</p></div>) : <p className="mt-3 font-bold text-slate-500">Belum ada riwayat.</p>}</section>
            <section className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="font-black text-gov-950">Aksi</h2>
                {returnTargets.length > 0 && <label className="mt-3 block text-sm font-black text-slate-600">Tujuan pengembalian<select value={returnToRole} onChange={(e) => setReturnToRole(e.target.value)} className="mt-2 w-full rounded-2xl border p-3 font-bold"><option value="">Pilih tujuan</option>{returnTargets.map((target: Row) => <option key={target.role} value={target.role}>Kembalikan ke {target.label}</option>)}</select></label>}
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 min-h-28 w-full rounded-2xl border p-4" placeholder="Alasan wajib untuk kembalikan/tolak" />
                <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => act("periksa")} className="rounded-xl bg-slate-100 px-4 py-3 font-black">Periksa</button><button disabled={busy} onClick={() => act("setujui")} className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white">Setujui / Teruskan</button><button disabled={busy || !returnTargets.length} onClick={() => act("kembalikan")} className="rounded-xl bg-amber-100 px-4 py-3 font-black text-amber-900 disabled:opacity-50">Kembalikan</button><button disabled={busy} onClick={() => act("tolak")} className="rounded-xl bg-red-600 px-4 py-3 font-black text-white">Tolak</button></div>
            </section>
        </div>
    </main>;
}