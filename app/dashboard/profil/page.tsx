"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Edit3, FileUp, Lock, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { getWargaProfileChangeRequests, getWargaProfilePhotoUrl, submitWargaProfileChangeRequest, updateWargaProfile, uploadWargaProfileChangeDocument, uploadWargaProfilePhoto, type WargaProfile, type WargaProfileChangeRequest } from "@/services/warga-auth.service";

const maxPhoto = 5 * 1024 * 1024;
const maxDocument = 1024 * 1024;
const allowedPhoto = ["image/jpeg", "image/png", "image/webp"];
const allowedDocument = ["image/jpeg", "image/png", "application/pdf"];
const changeFields = ["Nama Lengkap", "NIK", "Tempat/Tanggal Lahir", "Jenis Kelamin", "Nomor KK", "Alamat", "RT/RW", "Kelurahan", "Kecamatan", "Kota"];

export default function WargaProfilPage() {
    const router = useRouter();
    const { user, profile, loading, refresh } = useWargaAuth();
    const [telepon, setTelepon] = useState("");
    const [email, setEmail] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [changeOpen, setChangeOpen] = useState(false);
    const [changeField, setChangeField] = useState("");
    const [newValue, setNewValue] = useState("");
    const [reason, setReason] = useState("");
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [changeRequests, setChangeRequests] = useState<WargaProfileChangeRequest[]>([]);
    const [submittingChange, setSubmittingChange] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => {
        setTelepon(profile?.nomor_whatsapp || profile?.nomor_hp || "");
        setEmail(profile?.email || user?.email || "");
    }, [profile, user?.email]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
    useEffect(() => { if (user && profile) void loadChanges(); }, [user, profile?.id]);

    const avatar = useMemo(() => preview || getWargaProfilePhotoUrl(profile?.foto_url), [preview, profile?.foto_url]);
    const currentValue = profile ? getIdentityValue(profile, changeField) : "";

    async function loadChanges() {
        try { setChangeRequests(await getWargaProfileChangeRequests()); } catch (err) { console.error(err); }
    }

    function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setError(""); setMessage(""); setFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (!selected) return;
        if (!allowedPhoto.includes(selected.type)) { setError("Format foto salah. Gunakan JPG, JPEG, PNG, atau WebP."); return; }
        if (selected.size > maxPhoto) { setError("File terlalu besar. Ukuran foto maksimal 5 MB."); return; }
        setFile(selected);
        setPreview(URL.createObjectURL(selected));
    }

    function chooseDocument(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setError(""); setMessage(""); setDocumentFile(null);
        if (!selected) return;
        if (!allowedDocument.includes(selected.type)) { setError("Format dokumen harus JPG, PNG, atau PDF."); return; }
        if (selected.size > maxDocument) { setError("Ukuran dokumen maksimal 1 MB."); return; }
        setDocumentFile(selected);
    }

    async function submitProfile(event: FormEvent) {
        event.preventDefault();
        if (!telepon.trim() || telepon.trim().length < 8) { setError("Nomor WhatsApp / Telepon wajib diisi."); return; }
        if (!email.trim() || !email.includes("@")) { setError("Email wajib diisi dengan format yang benar."); return; }
        try {
            setSaving(true); setError(""); setMessage("");
            let foto_url = profile?.foto_url ?? null;
            if (file) foto_url = (await uploadWargaProfilePhoto(file)).path;
            await updateWargaProfile({ nomor_whatsapp: telepon.trim(), nomor_hp: telepon.trim(), email: email.trim(), foto_url });
            await refresh();
            setFile(null); setEditing(false); setMessage("Profil berhasil diperbarui");
        } catch (err) { setError(getErrorMessage(err, "Profil gagal diperbarui. Silakan coba lagi.")); } finally { setSaving(false); }
    }

    async function submitChange(event: FormEvent) {
        event.preventDefault();
        try {
            setSubmittingChange(true); setError(""); setMessage("");
            const dokumen = documentFile ? await uploadWargaProfileChangeDocument(documentFile) : null;
            await submitWargaProfileChangeRequest({ jenis_perubahan: changeField, data_lama: currentValue, data_baru: newValue, alasan: reason, dokumen_pendukung: dokumen });
            await loadChanges();
            setChangeOpen(false); setChangeField(""); setNewValue(""); setReason(""); setDocumentFile(null);
            setMessage("Pengajuan perubahan data Anda sudah diterima dan sedang diperiksa petugas.");
        } catch (err) { setError(getErrorMessage(err, "Pengajuan perubahan data gagal dikirim.")); } finally { setSubmittingChange(false); }
    }

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat profil...</main>;
    if (!profile) return <State title="Data belum dapat dimuat." onRetry={refresh} />;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-6xl space-y-6"><Hero title="Profil Warga" text="Satu halaman untuk melihat profil, memperbarui kontak, dan mengajukan perubahan data resmi." />{message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}{error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}<div className="grid gap-6 lg:grid-cols-[.82fr_1.18fr]"><aside className="rounded-[28px] border border-white bg-white p-6 text-center shadow-soft"><div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-amber-100 text-amber-600 ring-4 ring-amber-50">{avatar ? <img src={avatar} alt="Foto profil" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <UserRound size={68} />}</div><h2 className="mt-5 text-2xl font-black text-gov-950">{profile.nama_lengkap}</h2><p className="mt-1 text-sm font-bold text-slate-500">NIK: {mask(profile.nik)}</p><p className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">✓ Profil Terverifikasi</p><Button type="button" variant="gold" onClick={() => { setEditing(true); setMessage(""); setError(""); }} className="mt-4 !w-auto px-5 py-2.5 text-sm shadow-sm"><Edit3 size={16} /> Edit Profil</Button><div className="mt-5 grid gap-3 text-left text-sm font-bold"><p className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">Data terkunci: data resmi sudah diverifikasi petugas.</p><p className="rounded-2xl bg-amber-50 p-4 text-amber-800">Data bisa diedit: kontak dan foto dapat diperbarui langsung.</p></div></aside><section className="space-y-6">{editing ? <EditContactForm saving={saving} file={file} telepon={telepon} email={email} onPhoto={choosePhoto} onTelepon={setTelepon} onEmail={setEmail} onSubmit={submitProfile} onCancel={() => { setEditing(false); setError(""); setMessage(""); setFile(null); setTelepon(profile.nomor_whatsapp || profile.nomor_hp || ""); setEmail(profile.email || user.email || ""); if (preview) URL.revokeObjectURL(preview); setPreview(null); }} /> : <ContactData profile={profile} email={profile.email || user.email} />}<IdentityData profile={profile} onChangeClick={() => { setChangeOpen(true); setMessage(""); setError(""); }} />{changeOpen ? <ChangeRequestForm profile={profile} selected={changeField} currentValue={currentValue} newValue={newValue} reason={reason} file={documentFile} submitting={submittingChange} onSelect={(value) => { setChangeField(value); setNewValue(""); }} onNewValue={setNewValue} onReason={setReason} onFile={chooseDocument} onSubmit={submitChange} onCancel={() => { setChangeOpen(false); setChangeField(""); setNewValue(""); setReason(""); setDocumentFile(null); }} /> : null}<ChangeStatusCard requests={changeRequests} onRetry={(request) => { setChangeOpen(true); setChangeField(request.jenis_perubahan); setNewValue(request.data_baru); setReason(request.alasan); }} /></section></div></section></main>;
}

function Hero({ title, text }: { title: string; text: string }) { return <div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><ShieldCheck className="text-accent-300" /><p className="mt-4 font-black uppercase tracking-[.2em] text-accent-200">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">{title}</h1><p className="mt-3 text-white/75">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-black text-gov-950">{label}</span>{children}</label>; }
function EditContactForm(props: { saving: boolean; file: File | null; telepon: string; email: string; onPhoto: (e: ChangeEvent<HTMLInputElement>) => void; onTelepon: (v: string) => void; onEmail: (v: string) => void; onSubmit: (e: FormEvent) => void; onCancel: () => void }) { return <form onSubmit={props.onSubmit} className="space-y-5 rounded-[28px] border border-white bg-white p-6 shadow-soft"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-600">Data yang bisa diedit</p><h2 className="mt-2 text-2xl font-black text-gov-950">Edit Profil</h2></div><Field label="Foto Profil"><label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm font-black text-amber-700"><Camera size={18} /> {props.file ? `File dimuat: ${props.file.name}` : "Ubah Foto"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={props.onPhoto} className="hidden" disabled={props.saving} /></label></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Nomor WhatsApp / Telepon"><input value={props.telepon} onChange={(e) => props.onTelepon(e.target.value)} className="input" /></Field><Field label="Email"><input type="email" value={props.email} onChange={(e) => props.onEmail(e.target.value)} className="input" /></Field></div><div className="flex flex-wrap gap-3"><Button type="submit" variant="gold" disabled={props.saving}>{props.saving ? "Menyimpan perubahan..." : <><Save size={18} /> Simpan Perubahan</>}</Button><Button type="button" variant="glass" onClick={props.onCancel}><X size={18} /> Batal</Button></div></form>; }
function ContactData({ profile, email }: { profile: WargaProfile; email?: string | null }) { return <section className="rounded-[28px] border border-white bg-white p-6 shadow-soft"><h2 className="text-2xl font-black text-gov-950">Data Kontak</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><DataBox label="Nomor WhatsApp / Telepon" value={profile.nomor_whatsapp || profile.nomor_hp || "-"} /><DataBox label="Email" value={email || "-"} /></div></section>; }
function IdentityData({ profile, onChangeClick }: { profile: WargaProfile; onChangeClick: () => void }) { const rows = identityRows(profile); return <section className="rounded-[28px] border border-emerald-100 bg-emerald-50/60 p-6 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black text-gov-950">Data Identitas</h2><p className="mt-2 text-sm font-bold text-emerald-800">Data identitas telah diverifikasi petugas.</p></div><Button type="button" variant="glass" onClick={onChangeClick} className="!w-auto border-emerald-200 px-4 py-2 text-emerald-800">Ajukan Perubahan Data</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <DataBox key={label} label={<>{label} <Lock size={13} /></>} value={value} />)}</div></section>; }
function ChangeRequestForm(props: { profile: WargaProfile; selected: string; currentValue: string; newValue: string; reason: string; file: File | null; submitting: boolean; onSelect: (v: string) => void; onNewValue: (v: string) => void; onReason: (v: string) => void; onFile: (e: ChangeEvent<HTMLInputElement>) => void; onSubmit: (e: FormEvent) => void; onCancel: () => void }) { return <form onSubmit={props.onSubmit} className="space-y-4 rounded-[28px] border border-amber-200 bg-white p-6 shadow-soft"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-600">Ajukan Perubahan Data</p><p className="mt-2 text-sm font-bold text-slate-600">Gunakan fitur ini jika ada data identitas yang tidak sesuai. Perubahan akan diperiksa dan diverifikasi oleh petugas.</p></div><Field label="Data yang ingin diubah"><select value={props.selected} onChange={(e) => props.onSelect(e.target.value)} className="input"><option value="">Pilih data</option>{changeFields.map((field) => <option key={field} value={field}>{field}</option>)}</select></Field>{props.selected ? <><DataBox label="Data Saat Ini" value={props.currentValue || "-"} /><Field label="Data yang Benar"><input value={props.newValue} onChange={(e) => props.onNewValue(e.target.value)} className="input" /></Field><Field label="Alasan Perubahan"><textarea value={props.reason} onChange={(e) => props.onReason(e.target.value)} className="input min-h-28" /></Field><Field label="Dokumen Pendukung"><label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm font-black text-amber-700"><FileUp size={18} /> {props.file ? props.file.name : "Upload Dokumen"}<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={props.onFile} className="hidden" /></label><span className="mt-2 block text-xs font-bold text-slate-500">Format JPG / PNG / PDF, maksimal 1 MB per file.</span></Field><div className="flex flex-wrap gap-3"><Button type="submit" variant="gold" disabled={props.submitting}>{props.submitting ? "Mengajukan..." : "Ajukan Perubahan"}</Button><Button type="button" variant="glass" onClick={props.onCancel}>Batal</Button></div></> : null}</form>; }
function ChangeStatusCard({ requests, onRetry }: { requests: WargaProfileChangeRequest[]; onRetry: (request: WargaProfileChangeRequest) => void }) { if (requests.length === 0) return null; return <section className="rounded-[28px] border border-white bg-white p-6 shadow-soft"><h2 className="text-2xl font-black text-gov-950">Perubahan Data</h2><div className="mt-4 space-y-3">{requests.map((request) => <article key={request.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-black text-gov-950">Perubahan {request.jenis_perubahan}</p><p className="mt-1 text-sm font-bold text-slate-500">Diajukan {formatDate(request.created_at)}</p><p className={`mt-2 text-sm font-black ${statusClass(request.status)}`}>Status: {statusText(request.status)}</p>{request.status === "pending" ? <p className="mt-2 text-sm font-bold text-amber-700">Pengajuan perubahan data Anda sudah diterima dan sedang diperiksa petugas.</p> : null}{request.status === "rejected" ? <><p className="mt-2 text-sm font-bold text-red-700">Perubahan data belum disetujui.</p><p className="text-sm font-bold text-slate-600">Alasan petugas: {request.alasan_petugas || "Belum ada alasan."}</p><Button type="button" variant="glass" onClick={() => onRetry(request)} className="mt-3 !w-auto px-4 py-2">Ajukan Kembali</Button></> : null}</article>)}</div></section>; }
function DataBox({ label, value }: { label: React.ReactNode; value: React.ReactNode }) { return <div className="rounded-2xl bg-white/90 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold text-gov-950">{value}</p></div>; }
function identityRows(profile: WargaProfile) { return [["Nama Lengkap", profile.nama_lengkap || "-"], ["NIK", mask(profile.nik)], ["Tempat/Tanggal Lahir", `${profile.tempat_lahir || "-"}${profile.tanggal_lahir ? `, ${profile.tanggal_lahir}` : ""}`], ["Jenis Kelamin", profile.jenis_kelamin || "-"], ["Nomor KK", mask(profile.nomor_kk)], ["Alamat", profile.alamat || "-"], ["RT/RW", `${profile.rt || "-"}/${profile.rw || "-"}`], ["Kelurahan", profile.kelurahan || "Tamansari"], ["Kecamatan", profile.kecamatan || "Pulomerak"], ["Kota", "Cilegon"]]; }
function getIdentityValue(profile: WargaProfile, field: string) { return Object.fromEntries(identityRows(profile))[field] ?? ""; }
function statusText(status: string) { if (status === "approved") return "Disetujui"; if (status === "rejected") return "Ditolak"; return "Menunggu Verifikasi"; }
function statusClass(status: string) { if (status === "approved") return "text-emerald-700"; if (status === "rejected") return "text-red-700"; return "text-amber-700"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function State({ title, onRetry }: { title: string; onRetry: () => Promise<void> }) { return <main className="min-h-screen bg-[#F7F9FC] p-10"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black">{title}</h1><button onClick={() => void onRetry()} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black">Coba Lagi</button></section></main>; }
function mask(v?: string | null) { const s = v || "-"; return s.length > 8 ? `${s.slice(0, 4)}********${s.slice(-4)}` : s; }
function getErrorMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }