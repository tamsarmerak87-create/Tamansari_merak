"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Edit3, Lock, MapPin, Phone, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { getWargaProfilePhotoUrl, updateWargaProfile, uploadWargaProfilePhoto } from "@/services/warga-auth.service";

const maxPhoto = 5 * 1024 * 1024;
const allowedPhoto = ["image/jpeg", "image/png", "image/webp"];

export default function WargaProfilPage() {
    const router = useRouter();
    const { user, profile, loading, refresh } = useWargaAuth();
    const [telepon, setTelepon] = useState("");
    const [email, setEmail] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => {
        queueMicrotask(() => {
            setTelepon(profile?.nomor_whatsapp || profile?.nomor_hp || "");
            setEmail(profile?.email || user?.email || "");
        });
    }, [profile, user?.email]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const avatar = useMemo(() => preview || getWargaProfilePhotoUrl(profile?.foto_url), [preview, profile?.foto_url]);

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

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!telepon.trim() || telepon.trim().length < 8) { setError("Nomor WhatsApp / Telepon wajib diisi."); return; }
        if (!email.trim() || !email.includes("@")) { setError("Email wajib diisi dengan format yang benar."); return; }
        try {
            setSaving(true); setError(""); setMessage("");
            let foto_url = profile?.foto_url ?? null;
            if (file) {
                setUploading(true);
                const uploaded = await uploadWargaProfilePhoto(file);
                foto_url = uploaded.path;
                setUploading(false);
            }
            await updateWargaProfile({ nomor_whatsapp: telepon.trim(), nomor_hp: telepon.trim(), email: email.trim(), foto_url });
            await refresh();
            setFile(null);
            setEditing(false);
            setMessage("Profil berhasil diperbarui");
        } catch (err) {
            const supabaseError = err as { message?: string; code?: string; statusCode?: string | number; status?: string | number };
            if (process.env.NODE_ENV !== "production") console.error("[dashboard/profil] gagal menyimpan profil", { message: supabaseError.message, code: supabaseError.code, statusCode: supabaseError.statusCode ?? supabaseError.status });
            setError(supabaseError.message || "Profil gagal diperbarui. Silakan coba lagi.");
        } finally { setUploading(false); setSaving(false); }
    }

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat profil...</main>;
    if (!profile) return <State title="Data belum dapat dimuat." onRetry={refresh} />;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-6xl space-y-6"><Hero title={editing ? "Edit Profil" : "Profil Saya"} text="Data identitas di profil menjadi sumber utama seluruh pengajuan layanan." /><div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><aside className="rounded-[28px] border border-white bg-white p-6 text-center shadow-soft"><div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-amber-100 text-amber-600 ring-4 ring-amber-50">{avatar ? <img src={avatar} alt="Foto profil" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <UserRound size={68} />}</div><h2 className="mt-5 text-2xl font-black text-gov-950">{profile.nama_lengkap}</h2><p className="mt-1 text-sm font-bold text-slate-500">NIK: {mask(profile.nik)}</p><p className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">✓ Data Profil Terverifikasi</p><Button type="button" variant="gold" onClick={() => { setEditing(true); setMessage(""); setError(""); }} className="mt-4 !w-auto px-5 py-2.5 text-sm shadow-sm"><Edit3 size={16} /> Edit Profil</Button></aside>{editing ? <form onSubmit={submit} className="space-y-5 rounded-[28px] border border-white bg-white p-6 shadow-soft"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-600">Data yang dapat diedit</p><h2 className="mt-2 text-2xl font-black text-gov-950">Edit Profil</h2></div><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-black text-gov-950">Foto Profil</label><label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm font-black text-amber-700"><Camera size={18} /> {file ? `File dimuat: ${file.name}` : "Ubah Foto"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="hidden" disabled={saving} /></label>{uploading ? <p className="mt-2 text-sm font-bold text-amber-700">Mengunggah foto...</p> : null}</div><Field label="Nomor WhatsApp / Telepon"><input value={telepon} onChange={(e) => setTelepon(e.target.value)} className="input" placeholder="Nomor WhatsApp / Telepon" /></Field><Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="email@contoh.com" /></Field></div><VerifiedData profile={profile} />{error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}{message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}<div className="flex flex-wrap gap-3"><Button type="submit" variant="gold" disabled={saving}>{saving ? (uploading ? "Mengunggah foto..." : "Menyimpan perubahan...") : <><Save size={18} /> Simpan Perubahan</>}</Button><Button type="button" variant="glass" onClick={() => { setEditing(false); setError(""); setMessage(""); setFile(null); setTelepon(profile.nomor_whatsapp || profile.nomor_hp || ""); setEmail(profile.email || user.email || ""); if (preview) URL.revokeObjectURL(preview); setPreview(null); }}><X size={18} /> Batal</Button></div></form> : <section className="rounded-[28px] border border-white bg-white p-6 shadow-soft"><h2 className="text-2xl font-black text-gov-950">Ringkasan Profil</h2><p className="mt-2 text-sm font-bold text-slate-500">Gunakan tombol Edit Profil di kartu warga untuk mengubah kontak dan foto profil.</p><InfoGrid profile={profile} email={profile.email || user.email} /></section>}</div>{!editing ? <InfoGrid profile={profile} email={profile.email || user.email} /> : null}</section></main>;
}

function Hero({ title, text }: { title: string; text: string }) { return <div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><ShieldCheck className="text-accent-300" /><p className="mt-4 font-black uppercase tracking-[.2em] text-accent-200">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">{title}</h1><p className="mt-3 text-white/75">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-black text-gov-950">{label}</span>{children}</label>; }
function InfoGrid({ profile, email }: { profile: { nomor_whatsapp?: string | null; nomor_hp?: string | null; alamat?: string | null; kelurahan?: string | null; kecamatan?: string | null }; email?: string | null }) { const rows = [[Phone, "Telepon", profile.nomor_whatsapp || profile.nomor_hp || "-"], [MapPin, "Alamat", `${profile.alamat || "-"}, ${profile.kelurahan || "Tamansari"}, ${profile.kecamatan || "Pulomerak"}, Kota Cilegon`], [ShieldCheck, "Email", email || "-"]] as const; return <div className="grid gap-4 md:grid-cols-3">{rows.map(([Icon, label, value]) => <article key={label} className="rounded-3xl border border-white bg-white p-5 shadow-soft"><Icon className="text-emerald-600" /><p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-bold text-gov-950">{value}</p></article>)}</div>; }
function VerifiedData({ profile }: { profile: { nama_lengkap?: string | null; nik?: string | null; tempat_lahir?: string | null; tanggal_lahir?: string | null; jenis_kelamin?: string | null; nomor_kk?: string | null; alamat?: string | null; rt?: string | null; rw?: string | null; kelurahan?: string | null; kecamatan?: string | null } }) { const rows = [["Nama Lengkap", profile.nama_lengkap || "-"], ["NIK", mask(profile.nik)], ["Tempat/Tanggal Lahir", `${profile.tempat_lahir || "-"}${profile.tanggal_lahir ? `, ${profile.tanggal_lahir}` : ""}`], ["Jenis Kelamin", profile.jenis_kelamin || "-"], ["Nomor KK", mask(profile.nomor_kk)], ["Alamat", profile.alamat || "-"], ["RT/RW", `${profile.rt || "-"}/${profile.rw || "-"}`], ["Kelurahan", profile.kelurahan || "Tamansari"], ["Kecamatan", profile.kecamatan || "Pulomerak"], ["Kota", "Cilegon"]]; return <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Data Identitas Terverifikasi</p><p className="mt-2 text-sm font-bold text-emerald-800">Data ini telah diverifikasi petugas dan tidak dapat diedit langsung.</p></div><Button type="button" variant="glass" className="!w-auto border-emerald-200 px-4 py-2 text-emerald-800">Ajukan Perubahan Data</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-2xl bg-white/85 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">{label} <Lock size={13} /></p><p className="mt-1 font-bold text-gov-950">{value}</p></div>)}</div></section>; }
function State({ title, onRetry }: { title: string; onRetry: () => Promise<void> }) { return <main className="min-h-screen bg-[#F7F9FC] p-10"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black">{title}</h1><button onClick={() => void onRetry()} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black">Coba Lagi</button></section></main>; }
function mask(v?: string | null) { const s = v || "-"; return s.length > 8 ? `${s.slice(0, 4)}********${s.slice(-4)}` : s; }