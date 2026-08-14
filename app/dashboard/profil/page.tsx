"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, Save, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { getWargaProfileChangeRequests, getWargaProfilePhotoUrl, submitWargaProfileChangeRequest, updateWargaProfile, uploadWargaProfileChangeDocument, uploadWargaProfilePhoto, type WargaProfile, type WargaProfileChangeRequest } from "@/services/warga-auth.service";

const maxPhoto = 5 * 1024 * 1024;
const maxDocument = 1024 * 1024;
const allowedPhoto = ["image/jpeg", "image/png", "image/webp"];
const allowedDocument = ["image/jpeg", "image/png", "application/pdf"];
const changeFields = ["Nama Lengkap", "NIK", "Tempat/Tanggal Lahir", "Jenis Kelamin", "Nomor KK", "Kelurahan", "Kecamatan", "Kota"];

export default function WargaProfilPage() {
    const router = useRouter();
    const { user, profile, loading, refresh } = useWargaAuth();
    const [telepon, setTelepon] = useState("");
    const [email, setEmail] = useState("");
    const [alamat, setAlamat] = useState("");
    const [rt, setRt] = useState("");
    const [rw, setRw] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [changeOpen, setChangeOpen] = useState(false);
    const [changeField, setChangeField] = useState("");
    const [newValue, setNewValue] = useState("");
    const [reason, setReason] = useState("");
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [requests, setRequests] = useState<WargaProfileChangeRequest[]>([]);
    const [submittingChange, setSubmittingChange] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => {
        queueMicrotask(() => {
            setTelepon(profile?.nomor_whatsapp || profile?.nomor_hp || "");
            setEmail(profile?.email || user?.email || "");
            setAlamat(profile?.alamat || "");
            setRt(profile?.rt || "");
            setRw(profile?.rw || "");
        });
    }, [profile, user]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
    useEffect(() => { if (user && profile) void loadRequests(); }, [user, profile]);

    const avatar = useMemo(() => preview || getWargaProfilePhotoUrl(profile?.foto_url), [preview, profile?.foto_url]);
    const currentValue = profile ? getIdentityValue(profile, changeField) : "";

    async function loadRequests() {
        try { setRequests(await getWargaProfileChangeRequests()); } catch (err) { console.error(err); }
    }

    function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setError(""); setMessage(""); setFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (!selected) return;
        if (!allowedPhoto.includes(selected.type)) return setError("Format foto salah. Gunakan JPG, PNG, atau WebP.");
        if (selected.size > maxPhoto) return setError("File terlalu besar. Ukuran foto maksimal 5 MB.");
        setFile(selected);
        setPreview(URL.createObjectURL(selected));
    }

    function chooseDocument(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setError(""); setMessage(""); setDocumentFile(null);
        if (!selected) return;
        if (!allowedDocument.includes(selected.type)) return setError("Format dokumen harus JPG, PNG, atau PDF.");
        if (selected.size > maxDocument) return setError("Ukuran dokumen maksimal 1 MB.");
        setDocumentFile(selected);
    }

    async function submitProfile(event: FormEvent) {
        event.preventDefault();
        if (!telepon.trim() || telepon.trim().length < 8) return setError("Nomor WhatsApp / Telepon wajib diisi.");
        if (!email.trim() || !email.includes("@")) return setError("Email wajib diisi dengan format yang benar.");
        try {
            setSaving(true); setError(""); setMessage("");
            let foto_url = profile?.foto_url ?? null;
            if (file) foto_url = (await uploadWargaProfilePhoto(file)).path;
            await updateWargaProfile({ nomor_whatsapp: telepon.trim(), nomor_hp: telepon.trim(), email: email.trim(), alamat: alamat.trim(), rt: rt.trim(), rw: rw.trim(), foto_url });
            await refresh();
            setFile(null); setMessage("✓ Profil berhasil diperbarui.");
        } catch (err) { setError(getErrorMessage(err, "Profil gagal diperbarui. Silakan coba lagi.")); } finally { setSaving(false); }
    }

    async function submitChange(event: FormEvent) {
        event.preventDefault();
        try {
            setSubmittingChange(true); setError(""); setMessage("");
            const dokumen = documentFile ? await uploadWargaProfileChangeDocument(documentFile) : null;
            await submitWargaProfileChangeRequest({ jenis_perubahan: changeField, data_lama: currentValue, data_baru: newValue, alasan: reason, dokumen_pendukung: dokumen });
            await loadRequests();
            closeChangeModal();
            setMessage("Permintaan perubahan data resmi sudah dikirim ke petugas.");
        } catch (err) { setError(getErrorMessage(err, "Pengajuan perubahan data gagal dikirim.")); } finally { setSubmittingChange(false); }
    }

    function closeChangeModal() { setChangeOpen(false); setChangeField(""); setNewValue(""); setReason(""); setDocumentFile(null); }

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat profil...</main>;
    if (!profile) return <State title="Data belum dapat dimuat." onRetry={refresh} />;

    return <main className="min-h-screen bg-[#F7F9FC] px-4 py-6 text-slate-800 sm:px-8 lg:px-16"><form onSubmit={submitProfile} className="mx-auto max-w-6xl space-y-5"><Header />{message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p> : null}{error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">{error}</p> : null}<div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"><ProfileCard profile={profile} avatar={avatar} file={file} saving={saving} onPhoto={choosePhoto} /><EditableData saving={saving} telepon={telepon} email={email} alamat={alamat} rt={rt} rw={rw} onTelepon={setTelepon} onEmail={setEmail} onAlamat={setAlamat} onRt={setRt} onRw={setRw} /></div><IdentityData profile={profile} onChangeClick={() => { setChangeOpen(true); setMessage(""); setError(""); }} /><Button type="submit" variant="gold" disabled={saving} className="min-h-[56px] w-full text-base shadow-[0_14px_35px_rgba(245,179,1,.24)]">{saving ? "Menyimpan perubahan..." : <><Save size={20} /> 💾 SIMPAN PERUBAHAN</>}</Button><ChangeStatusCard requests={requests} onRetry={(request) => { setChangeOpen(true); setChangeField(request.jenis_perubahan); setNewValue(request.data_baru); setReason(request.alasan); }} /></form>{changeOpen ? <ChangeRequestModal selected={changeField} currentValue={currentValue} newValue={newValue} reason={reason} file={documentFile} submitting={submittingChange} onSelect={(value) => { setChangeField(value); setNewValue(""); }} onNewValue={setNewValue} onReason={setReason} onFile={chooseDocument} onSubmit={submitChange} onCancel={closeChangeModal} /> : null}</main>;
}

function Header() { return <section className="rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-slate-100"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black uppercase tracking-tight text-gov-950 sm:text-4xl">PROFIL WARGA</h1><p className="mt-2 max-w-2xl text-sm font-bold text-slate-600 sm:text-base">Kelola data profil Anda. Data ini digunakan otomatis untuk pengajuan layanan.</p></div><p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700">✓ Profil Terverifikasi</p></div></section>; }
function ProfileCard({ profile, avatar, file, saving, onPhoto }: { profile: WargaProfile; avatar: string | null; file: File | null; saving: boolean; onPhoto: (e: ChangeEvent<HTMLInputElement>) => void }) { return <section className="rounded-[28px] border border-white bg-white p-6 text-center shadow-soft"><div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-amber-100 text-amber-600 ring-4 ring-amber-50">{avatar ? <img src={avatar} alt="Foto profil" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <UserRound size={68} />}</div><h2 className="mt-5 text-2xl font-black text-gov-950">{profile.nama_lengkap}</h2><p className="mt-1 text-sm font-bold text-slate-500">NIK: {mask(profile.nik)}</p><p className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">✓ Data Profil Terverifikasi</p><label className="mx-auto mt-5 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent-400 px-5 py-3 text-sm font-black text-gov-950 shadow-soft hover:bg-accent-200 sm:w-auto"><Camera size={18} /> Ubah Foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} className="hidden" disabled={saving} /></label><p className="mt-3 text-xs font-bold text-slate-500">JPG / PNG / WebP, maksimal 5 MB. {file ? `Preview siap: ${file.name}` : "Preview tampil sebelum disimpan."}</p></section>; }
function EditableData(props: { saving: boolean; telepon: string; email: string; alamat: string; rt: string; rw: string; onTelepon: (v: string) => void; onEmail: (v: string) => void; onAlamat: (v: string) => void; onRt: (v: string) => void; onRw: (v: string) => void }) { return <section className="rounded-[28px] border-2 border-amber-200 bg-amber-50/65 p-5 shadow-soft sm:p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">DATA YANG BISA DIUBAH</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Nomor WhatsApp / Telepon"><Input value={props.telepon} onChange={props.onTelepon} disabled={props.saving} inputMode="tel" placeholder="0812234567890" /></Field><Field label="Email"><Input type="email" value={props.email} onChange={props.onEmail} disabled={props.saving} placeholder="ratih@gmail.com" /></Field><Field label="Alamat Domisili"><Input value={props.alamat} onChange={props.onAlamat} disabled={props.saving} placeholder="langon indah" /></Field><Field label="RT"><Input value={props.rt} onChange={props.onRt} disabled={props.saving} inputMode="numeric" placeholder="05" /></Field><Field label="RW"><Input value={props.rw} onChange={props.onRw} disabled={props.saving} inputMode="numeric" placeholder="12" /></Field></div></section>; }
function IdentityData({ profile, onChangeClick }: { profile: WargaProfile; onChangeClick: () => void }) { return <section className="rounded-[28px] border border-slate-200 bg-slate-100/80 p-5 shadow-soft sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black text-gov-950">DATA IDENTITAS TERVERIFIKASI</h2><p className="mt-2 text-sm font-bold text-slate-600">Data ini telah diverifikasi petugas dan tidak dapat diubah langsung.</p></div><p className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">✓ Terverifikasi</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{identityRows(profile).map(([label, value]) => <DataBox key={label} label={`${label} 🔒`} value={value} />)}</div><button type="button" onClick={onChangeClick} className="mt-5 text-left text-sm font-black text-gov-800 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-amber-700">Data identitas tidak sesuai? Minta perubahan data resmi</button></section>; }
function ChangeRequestModal(props: { selected: string; currentValue: string; newValue: string; reason: string; file: File | null; submitting: boolean; onSelect: (v: string) => void; onNewValue: (v: string) => void; onReason: (v: string) => void; onFile: (e: ChangeEvent<HTMLInputElement>) => void; onSubmit: (e: FormEvent) => void; onCancel: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"><form onSubmit={props.onSubmit} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-2xl font-black text-gov-950">PERUBAHAN DATA RESMI</h2><p className="mt-1 text-sm font-bold text-slate-500">Permintaan diperiksa petugas sebelum mengubah data terkunci.</p></div><button type="button" onClick={props.onCancel} className="rounded-full bg-slate-100 p-2 text-slate-600"><X size={18} /></button></div><div className="mt-5 space-y-4"><Field label="Data yang ingin diperbaiki"><select value={props.selected} onChange={(e) => props.onSelect(e.target.value)} className="input min-h-[52px] border-2 border-slate-300 bg-white text-base font-bold" required><option value="">Pilih data</option>{changeFields.map((field) => <option key={field} value={field}>{field}</option>)}</select></Field><DataBox label="Data saat ini" value={props.currentValue || "-"} /><Field label="Data yang benar"><Input value={props.newValue} onChange={props.onNewValue} placeholder="Tulis data yang benar" required /></Field><Field label="Alasan"><textarea value={props.reason} onChange={(e) => props.onReason(e.target.value)} className="input min-h-28 border-2 border-slate-300 bg-white text-base font-bold" required /></Field><Field label="Dokumen pendukung"><label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm font-black text-amber-700"><FileUp size={18} /> {props.file ? props.file.name : "Upload"}<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={props.onFile} className="hidden" /></label></Field></div><Button type="submit" variant="gold" disabled={props.submitting} className="mt-5 w-full">{props.submitting ? "Mengirim..." : "Kirim Permintaan"}</Button></form></div>; }
function ChangeStatusCard({ requests, onRetry }: { requests: WargaProfileChangeRequest[]; onRetry: (request: WargaProfileChangeRequest) => void }) { if (requests.length === 0) return null; return <section className="rounded-[28px] border border-white bg-white p-5 shadow-soft sm:p-6"><h2 className="text-xl font-black text-gov-950">Status Perubahan Data Resmi</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{requests.map((request) => <article key={request.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-black text-gov-950">{request.jenis_perubahan}</p><p className="mt-1 text-sm font-bold text-slate-500">Diajukan {formatDate(request.created_at)}</p><p className={`mt-2 text-sm font-black ${statusClass(request.status)}`}>{statusText(request.status)}</p>{request.status === "rejected" ? <button type="button" onClick={() => onRetry(request)} className="mt-3 text-sm font-black text-gov-800 underline">Ajukan kembali</button> : null}</article>)}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-black text-gov-950">{label}</span>{children}</label>; }
function Input({ value, onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & { value: string; onChange: (value: string) => void }) { return <input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="input min-h-[54px] border-2 border-slate-300 bg-white px-4 text-base font-bold shadow-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />; }
function DataBox({ label, value }: { label: React.ReactNode; value: React.ReactNode }) { return <div className="rounded-2xl border border-slate-200 bg-white/90 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-bold text-gov-950">{value}</p></div>; }
function identityRows(profile: WargaProfile) { return [["Nama Lengkap", profile.nama_lengkap || "-"], ["NIK", mask(profile.nik)], ["Tempat/Tanggal Lahir", `${profile.tempat_lahir || "-"}${profile.tanggal_lahir ? `, ${profile.tanggal_lahir}` : ""}`], ["Jenis Kelamin", profile.jenis_kelamin || "-"], ["Nomor KK", mask(profile.nomor_kk)], ["Kelurahan", profile.kelurahan || "Tamansari"], ["Kecamatan", profile.kecamatan || "Pulomerak"], ["Kota", "Cilegon"]]; }
function getIdentityValue(profile: WargaProfile, field: string) { return Object.fromEntries(identityRows(profile))[field] ?? ""; }
function statusText(status: string) { if (status === "approved") return "Disetujui"; if (status === "rejected") return "Ditolak"; return "Menunggu Verifikasi"; }
function statusClass(status: string) { if (status === "approved") return "text-emerald-700"; if (status === "rejected") return "text-red-700"; return "text-amber-700"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function State({ title, onRetry }: { title: string; onRetry: () => Promise<void> }) { return <main className="min-h-screen bg-[#F7F9FC] p-10"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black">{title}</h1><button onClick={() => void onRetry()} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black">Coba Lagi</button></section></main>; }
function mask(v?: string | null) { const s = v || "-"; return s.length > 8 ? `${s.slice(0, 4)}********${s.slice(-4)}` : s; }
function getErrorMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }