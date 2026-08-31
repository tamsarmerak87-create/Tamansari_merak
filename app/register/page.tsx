"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, ImageIcon, Loader2, RotateCcw, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField, AuthShell, authInputClass } from "@/components/auth/auth-ui";
import { registerWarga, wargaRegisterSchema, type WargaRegisterInput } from "@/services/warga-auth.service";
import { getFriendlyMessage } from "@/lib/messages";
import { compressWargaFile, MAX_WARGA_FILE_SIZE } from "@/services/warga-file-compress";

type RegisterForm = Omit<WargaRegisterInput, "agama" | "status_perkawinan" | "status_pekerjaan"> & { agama: WargaRegisterInput["agama"] | ""; status_perkawinan: WargaRegisterInput["status_perkawinan"] | ""; status_pekerjaan: WargaRegisterInput["status_pekerjaan"] | "" };
const empty: RegisterForm = { nama_lengkap: "", nik: "", nomor_kk: "", email: "", nomor_whatsapp: "", tempat_lahir: "", tanggal_lahir: "", jenis_kelamin: "", agama: "", status_perkawinan: "", status_pekerjaan: "", alamat: "", rt: "", rw: "", kelurahan: "Tamansari", kecamatan: "Pulomerak", password: "", confirmPassword: "", terms: false };
const MAX_FILE_SIZE = MAX_WARGA_FILE_SIZE;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
type Toast = { type: "success" | "error" | "loading"; message: string } | null;
type DocKey = "ktp" | "kk" | "selfie";
type DocState = { file: File | null; preview: string };

const docCopy: Record<DocKey, { title: string; description: string; ready: string; missing: string; camera: string; gallery: string; capture: "environment" | "user" }> = {
    ktp: { title: "1. FOTO KTP", description: "Foto KTP asli Anda. Pastikan tulisan terlihat jelas.", ready: "Foto KTP siap", missing: "KTP belum diupload", camera: "Ambil Foto KTP", gallery: "Pilih dari Galeri", capture: "environment" },
    kk: { title: "2. FOTO KARTU KELUARGA", description: "Foto KK asli Anda. Pastikan seluruh bagian terlihat.", ready: "Foto KK siap", missing: "KK belum diupload", camera: "Ambil Foto KK", gallery: "Pilih dari Galeri", capture: "environment" },
    selfie: { title: "3. FOTO DIRI", description: "Gunakan foto wajah Anda yang jelas untuk foto profil.", ready: "Foto wajah siap", missing: "Foto wajah belum diupload", camera: "Ambil Foto Wajah", gallery: "Pilih dari Galeri", capture: "user" },
};

export default function RegisterPage() {
    const [form, setForm] = useState(empty);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<Toast>(null);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [docs, setDocs] = useState<Record<DocKey, DocState>>({ ktp: { file: null, preview: "" }, kk: { file: null, preview: "" }, selfie: { file: null, preview: "" } });
    const inputs = { ktp: { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) }, kk: { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) }, selfie: { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null) } };

    useEffect(() => () => Object.values(docs).forEach((doc) => { if (doc.preview) URL.revokeObjectURL(doc.preview); }), [docs]);

    const set = (key: keyof RegisterForm, value: string | boolean) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: "" })); };
    function validateBeforeSubmit() {
        const next: Record<string, string> = {};
        if (!form.nama_lengkap.trim()) next.nama_lengkap = "Nama wajib diisi.";
        if (!/^\d{16}$/.test(form.nik)) next.nik = "NIK harus 16 digit.";
        if (!/^\d{16}$/.test(form.nomor_kk)) next.nomor_kk = "Nomor KK harus 16 digit.";
        if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Email valid wajib diisi.";
        if (form.password.length < 8) next.password = "Password minimal 8 karakter.";
        if (form.password !== form.confirmPassword) next.confirmPassword = "Password dan Konfirmasi Password harus sama.";
        if (!form.terms) next.terms = "Checkbox persetujuan wajib dicentang.";
        return next;
    }
    async function selectFile(key: DocKey, event: ChangeEvent<HTMLInputElement>) {
        let file = event.target.files?.[0] ?? null;
        event.target.value = "";
        if (!file) return;
        if (!ACCEPTED_TYPES.includes(file.type)) { setToast({ type: "error", message: "Format foto harus JPG, JPEG, PNG, atau WEBP." }); return; }
        setToast({ type: "loading", message: "Mengompres file..." });
        try { file = await compressWargaFile(file); } catch (error) { setToast({ type: "error", message: error instanceof Error ? error.message : "File tidak dapat dikompres. Silakan coba foto atau file lain." }); return; }
        if (file.size > MAX_FILE_SIZE) { setToast({ type: "error", message: "Ukuran file masih lebih dari 1 MB. Silakan pilih file lain." }); return; }
        setDocs((prev) => { if (prev[key].preview) URL.revokeObjectURL(prev[key].preview); return { ...prev, [key]: { file, preview: URL.createObjectURL(file) } }; });
        setErrors((prev) => ({ ...prev, documents: "" }));
        setToast({ type: "success", message: "File berhasil dikompres dan siap diupload." });
    }
    function clearDoc(key: DocKey) { setDocs((prev) => { if (prev[key].preview) URL.revokeObjectURL(prev[key].preview); return { ...prev, [key]: { file: null, preview: "" } }; }); }
    function goToDocs() {
        const manualErrors = validateBeforeSubmit();
        if (Object.keys(manualErrors).length > 0) { setErrors(manualErrors); setToast({ type: "error", message: Object.values(manualErrors)[0] ?? "Periksa kembali data pendaftaran." }); return; }
        const parsed = wargaRegisterSchema.safeParse(form);
        if (!parsed.success) { const fieldErrors = Object.fromEntries(parsed.error.issues.map((item) => [String(item.path[0]), item.message])); setErrors(fieldErrors); setToast({ type: "error", message: parsed.error.issues[0]?.message ?? "Validasi pendaftaran gagal." }); return; }
        setStep(2);
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (step === 1) { goToDocs(); return; }
        if (!docs.ktp.file || !docs.kk.file || !docs.selfie.file) { setErrors((prev) => ({ ...prev, documents: "Silakan upload KTP dan KK terlebih dahulu." })); setToast({ type: "error", message: "Silakan upload KTP dan KK terlebih dahulu." }); return; }
        try {
            setLoading(true); setErrors({}); setToast({ type: "loading", message: "Membuat akun dan mengupload dokumen..." });
            const parsed = wargaRegisterSchema.parse(form);
            await registerWarga(parsed, { ktp: docs.ktp.file, kk: docs.kk.file, selfie: docs.selfie.file });
            setStep(3); setToast({ type: "success", message: "Registrasi berhasil. Silakan cek email Anda untuk mengaktifkan akun." });
            window.location.assign(`/verify?registered=1&email=${encodeURIComponent(parsed.email)}`);
        } catch (error) { setToast({ type: "error", message: getFriendlyMessage(error, "Registrasi belum berhasil. Silakan periksa data dan coba lagi.") }); }
        finally { setLoading(false); }
    }
    const fields: [keyof WargaRegisterInput, string, string][] = [["nama_lengkap", "Nama Lengkap", "text"], ["nik", "NIK", "text"], ["nomor_kk", "Nomor KK", "text"], ["email", "Email", "email"], ["nomor_whatsapp", "Nomor WhatsApp", "text"], ["tempat_lahir", "Tempat Lahir", "text"], ["tanggal_lahir", "Tanggal Lahir", "date"], ["alamat", "Alamat", "text"], ["rt", "RT", "text"], ["rw", "RW", "text"], ["kelurahan", "Kelurahan", "text"], ["kecamatan", "Kecamatan", "text"], ["password", "Password", "password"], ["confirmPassword", "Konfirmasi Password", "password"]];
    const status = (key: DocKey) => docs[key].file ? `✓ ${docCopy[key].ready.replace("Foto ", "").replace(" siap", " sudah siap")}` : `⚠ ${docCopy[key].missing}`;

    return <AuthShell title="Daftar Akun Warga" subtitle="Ikuti 3 langkah mudah: isi data, upload dokumen, lalu tunggu verifikasi petugas.">{toast ? <div className={`fixed right-5 top-5 z-[100] flex max-w-md items-start gap-3 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-2xl ${toast.type === "success" ? "bg-emerald-600" : toast.type === "loading" ? "bg-slate-800" : "bg-red-600"}`}>{toast.type === "success" ? <CheckCircle2 className="shrink-0" size={20} /> : toast.type === "loading" ? <Loader2 className="shrink-0 animate-spin" size={20} /> : <XCircle className="shrink-0" size={20} />}<span>{toast.message}</span></div> : null}<div className="mt-8 grid grid-cols-3 gap-2 text-center text-sm font-black"><div className={`rounded-2xl border p-3 ${step >= 1 ? "border-gov-950 bg-gov-950 text-white" : "bg-white"}`}>1. Data Diri</div><div className={`rounded-2xl border p-3 ${step >= 2 ? "border-gov-950 bg-gov-950 text-white" : "bg-white"}`}>2. Upload Dokumen</div><div className={`rounded-2xl border p-3 ${step >= 3 ? "border-gov-950 bg-gov-950 text-white" : "bg-white"}`}>3. Selesai</div></div><form onSubmit={submit} className="mt-8 grid gap-4 md:grid-cols-2">{step === 1 ? <>{fields.slice(0, 6).map(([key, label, type]) => <AuthField key={key} label={label} error={errors[key]}><input aria-label={label} type={type} className={authInputClass} value={String(form[key])} onChange={(e) => set(key, e.target.value)} disabled={loading} /></AuthField>)}<AuthField label="Jenis Kelamin" error={errors.jenis_kelamin}><select aria-label="Jenis Kelamin" className={authInputClass} value={form.jenis_kelamin} onChange={(e) => set("jenis_kelamin", e.target.value)} disabled={loading}><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></AuthField><AuthField label="Agama" error={errors.agama}><select aria-label="Agama" className={authInputClass} value={form.agama} onChange={(e) => set("agama", e.target.value)} disabled={loading}><option value="">Pilih</option><option>Islam</option><option>Kristen</option><option>Katolik</option><option>Hindu</option><option>Buddha</option><option>Konghucu</option></select></AuthField><AuthField label="Status Perkawinan" error={errors.status_perkawinan}><select aria-label="Status Perkawinan" className={authInputClass} value={form.status_perkawinan} onChange={(e) => set("status_perkawinan", e.target.value)} disabled={loading}><option value="">Pilih</option><option>Menikah</option><option>Belum Menikah</option><option>Janda</option><option>Duda</option></select></AuthField><AuthField label="Status Pekerjaan" error={errors.status_pekerjaan}><select aria-label="Status Pekerjaan" className={authInputClass} value={form.status_pekerjaan} onChange={(e) => set("status_pekerjaan", e.target.value)} disabled={loading}><option value="">Pilih</option><option>Bekerja</option><option>Belum Bekerja</option></select></AuthField>{fields.slice(6).map(([key, label, type]) => <AuthField key={key} label={label} error={errors[key]}><input aria-label={label} type={type} className={authInputClass} value={String(form[key])} onChange={(e) => set(key, e.target.value)} disabled={loading} /></AuthField>)}<label className="flex items-start gap-3 text-sm font-bold text-gov-950 md:col-span-2"><input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} disabled={loading} className="mt-1 size-5 accent-gov-950" />Saya menyetujui syarat dan ketentuan.</label>{errors.terms ? <p className="text-sm font-bold text-red-600 md:col-span-2">{errors.terms}</p> : null}<Button type="submit" variant="gold" disabled={loading} className="h-14 text-base md:col-span-2"><UserPlus size={18} />Lanjut Upload Dokumen</Button></> : null}{step === 2 ? <div className="grid gap-5 md:col-span-2"><div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-gov-950"><h3 className="text-lg font-black">Cara foto yang benar</h3><div className="mt-3 grid gap-2 text-sm font-bold"><span>✓ Gunakan tempat terang</span><span>✓ Foto tidak buram</span><span>✓ Semua bagian KTP/KK terlihat</span><span>✓ Jangan terpotong</span><span>✓ Jangan terkena pantulan cahaya</span><span>✓ Gunakan dokumen asli</span></div></div><div className="grid gap-2 rounded-3xl border bg-white p-5 text-base font-black text-gov-950"><span>{status("ktp")}</span><span>{status("kk")}</span><span>{status("selfie")}</span></div>{(["ktp", "kk", "selfie"] as DocKey[]).map((key) => <section key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-gov-950">{docCopy[key].title}</h2><p className="mt-2 text-base font-semibold text-slate-600">{docCopy[key].description}</p>{docs[key].preview ? <div className="mt-4 overflow-hidden rounded-2xl border bg-slate-50"><Image src={docs[key].preview} alt={docCopy[key].title} width={900} height={600} className="h-64 w-full object-cover" unoptimized /></div> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2"><input ref={inputs[key].camera} type="file" accept="image/*" capture={docCopy[key].capture} className="hidden" onChange={(e) => selectFile(key, e)} /><input ref={inputs[key].gallery} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => selectFile(key, e)} /><Button type="button" variant="glass" className="h-14 text-base" onClick={() => inputs[key].camera.current?.click()} disabled={loading}><Camera size={20} />{docCopy[key].camera}</Button><Button type="button" variant="glass" className="h-14 text-base" onClick={() => inputs[key].gallery.current?.click()} disabled={loading}><ImageIcon size={20} />{docCopy[key].gallery}</Button></div>{docs[key].file ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4 font-black text-emerald-700"><span>✓ {docCopy[key].ready}</span><Button type="button" variant="glass" onClick={() => clearDoc(key)} disabled={loading}><RotateCcw size={16} />Ulangi Foto</Button></div> : null}</section>)}{errors.documents ? <p className="text-sm font-bold text-red-600">{errors.documents}</p> : null}<div className="grid gap-3 sm:grid-cols-2"><Button type="button" variant="glass" className="h-14" onClick={() => setStep(1)} disabled={loading}>Kembali</Button><Button type="submit" variant="gold" disabled={loading} className="h-14 text-base">{loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}{loading ? "Mendaftarkan..." : "Daftar Sekarang"}</Button></div></div> : null}{step === 3 ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center text-gov-950 md:col-span-2"><CheckCircle2 className="mx-auto text-emerald-600" size={56} /><h2 className="mt-4 text-2xl font-black">Registrasi Berhasil</h2><p className="mt-2 text-lg font-bold">Data Anda sudah diterima dan sedang menunggu verifikasi petugas.</p><p className="mt-4 inline-flex rounded-full bg-white px-5 py-3 text-base font-black text-emerald-700 shadow-sm">Menunggu Verifikasi</p></div> : null}</form></AuthShell>;
}
