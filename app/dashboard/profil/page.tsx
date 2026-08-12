"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { updateWargaProfile, uploadWargaProfilePhoto } from "@/services/warga-auth.service";

const maxPhoto = 5 * 1024 * 1024;
const allowedPhoto = ["image/jpeg", "image/png", "image/webp"];

export default function WargaProfilPage() {
    const router = useRouter();
    const { user, profile, loading, refresh } = useWargaAuth();
    const [nama, setNama] = useState("");
    const [telepon, setTelepon] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => { if (!loading && !user) router.push("/login"); }, [loading, user, router]);
    useEffect(() => { setNama(profile?.nama_lengkap ?? ""); setTelepon(profile?.nomor_whatsapp || profile?.nomor_hp || ""); }, [profile]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const avatar = useMemo(() => preview || profile?.foto_url || "", [preview, profile?.foto_url]);

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
        if (!nama.trim() || nama.trim().length < 3) { setError("Nama lengkap wajib diisi minimal 3 karakter."); return; }
        if (!telepon.trim() || telepon.trim().length < 8) { setError("Nomor WhatsApp / Telepon wajib diisi."); return; }
        try {
            setSaving(true); setError(""); setMessage("");
            let foto_url = profile?.foto_url ?? null;
            if (file) {
                setUploading(true);
                const uploaded = await uploadWargaProfilePhoto(file);
                foto_url = uploaded.url;
                setUploading(false);
            }
            await updateWargaProfile({ nama_lengkap: nama.trim(), nomor_whatsapp: telepon.trim(), nomor_hp: telepon.trim(), foto_url });
            await refresh();
            setFile(null);
            setMessage(file ? "Foto profil berhasil diperbarui. Profil berhasil diperbarui." : "Profil berhasil diperbarui.");
        } catch {
            setError("Profil gagal diperbarui. Silakan coba lagi.");
        } finally { setUploading(false); setSaving(false); }
    }

    if (loading || !user) return <main className="min-h-screen bg-[#F7F9FC] p-10 font-black text-gov-950">Memuat profil...</main>;
    if (!profile) return <State title="Data belum dapat dimuat." onRetry={refresh} />;

    return <main className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-slate-800 sm:px-10 lg:px-20"><section className="mx-auto max-w-6xl space-y-6"><Hero title="Profil Saya" text="Data warga diambil langsung dari Supabase berdasarkan akun yang sedang login." /><div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><aside className="rounded-[28px] border border-white bg-white p-6 text-center shadow-soft"><div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-amber-100 text-amber-600 ring-4 ring-amber-50">{avatar ? <img src={avatar} alt="Foto profil" className="h-full w-full object-cover" /> : <UserRound size={68} />}</div><h2 className="mt-5 text-2xl font-black text-gov-950">{profile.nama_lengkap}</h2><p className="mt-1 text-sm font-bold text-slate-500">NIK: {mask(profile.nik)}</p><p className="mt-1 text-sm font-bold text-slate-500">Warga Tamansari</p></aside><form onSubmit={submit} className="rounded-[28px] border border-white bg-white p-6 shadow-soft"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nama Lengkap"><input value={nama} onChange={(e) => setNama(e.target.value)} className="input" placeholder="Nama Lengkap" /></Field><Field label="Nomor WhatsApp / Telepon"><input value={telepon} onChange={(e) => setTelepon(e.target.value)} className="input" placeholder="Nomor WhatsApp / Telepon" /></Field><Field label="Email (read-only)"><input value={profile.email || user.email || ""} readOnly className="input bg-slate-50 text-slate-500" /></Field><Field label="NIK (read-only)"><input value={mask(profile.nik)} readOnly className="input bg-slate-50 text-slate-500" /></Field><Field label="Alamat"><input value={profile.alamat || "-"} readOnly className="input bg-slate-50 text-slate-500" /></Field><Field label="Kelurahan / Kecamatan / Kota"><input value={`${profile.kelurahan || "Tamansari"}, ${profile.kecamatan || "Pulomerak"}, Kota Cilegon`} readOnly className="input bg-slate-50 text-slate-500" /></Field><div className="sm:col-span-2"><label className="mb-2 block text-sm font-black text-gov-950">Ganti Foto Profil</label><label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm font-black text-amber-700"><Camera size={18} /> Pilih gambar JPG/PNG/WebP maksimal 5 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="hidden" /></label>{uploading ? <p className="mt-2 text-sm font-bold text-amber-700">Mengunggah foto...</p> : null}</div></div>{error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}{message ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}<div className="mt-6 flex flex-wrap gap-3"><Button type="submit" variant="gold" disabled={saving}>{saving ? "Menyimpan perubahan..." : <><Save size={18} /> Simpan Perubahan</>}</Button><Button type="button" variant="glass" href="/dashboard">Kembali ke Dashboard</Button></div></form></div><InfoGrid profile={profile} email={user.email || profile.email} /></section></main>;
}

function Hero({ title, text }: { title: string; text: string }) { return <div className="rounded-[32px] bg-[linear-gradient(135deg,#0B2C6A,#071a33)] p-8 text-white shadow-[0_24px_80px_rgba(11,44,106,.18)]"><ShieldCheck className="text-accent-300" /><p className="mt-4 font-black uppercase tracking-[.2em] text-accent-200">Dashboard Warga</p><h1 className="mt-3 text-4xl font-black">{title}</h1><p className="mt-3 text-white/75">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-black text-gov-950">{label}</span>{children}</label>; }
function InfoGrid({ profile, email }: { profile: { nomor_whatsapp?: string | null; nomor_hp?: string | null; alamat?: string | null; kelurahan?: string | null; kecamatan?: string | null }; email?: string | null }) { const rows = [[Mail, "Email", email || "-"], [Phone, "Telepon", profile.nomor_whatsapp || profile.nomor_hp || "-"], [MapPin, "Alamat", `${profile.alamat || "-"}, ${profile.kelurahan || "Tamansari"}, ${profile.kecamatan || "Pulomerak"}, Kota Cilegon`]] as const; return <div className="grid gap-4 md:grid-cols-3">{rows.map(([Icon, label, value]) => <article key={label} className="rounded-3xl border border-white bg-white p-5 shadow-soft"><Icon className="text-emerald-600" /><p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-bold text-gov-950">{value}</p></article>)}</div>; }
function State({ title, onRetry }: { title: string; onRetry: () => Promise<void> }) { return <main className="min-h-screen bg-[#F7F9FC] p-10"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black">{title}</h1><button onClick={() => void onRetry()} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black">Coba Lagi</button></section></main>; }
function mask(v?: string | null) { const s = v || "-"; return s.length > 8 ? `${s.slice(0, 4)}********${s.slice(-4)}` : s; }