"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField, AuthShell, authInputClass } from "@/components/auth/auth-ui";
import { registerWarga, wargaRegisterSchema, type WargaRegisterInput } from "@/services/warga-auth.service";

const empty: WargaRegisterInput = { nama_lengkap: "", nik: "", nomor_kk: "", email: "", nomor_whatsapp: "", tempat_lahir: "", tanggal_lahir: "", jenis_kelamin: "", alamat: "", rt: "", rw: "", kelurahan: "Tamansari", kecamatan: "Pulomerak", password: "", confirmPassword: "", terms: false };

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState(empty);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const set = (key: keyof WargaRegisterInput, value: string | boolean) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: "" })); };
    async function submit(event: FormEvent) { event.preventDefault(); try { setLoading(true); setErrors({}); wargaRegisterSchema.parse(form); await registerWarga(form); alert("Pendaftaran berhasil. Kode OTP telah dikirim melalui Email/WhatsApp."); router.push("/verify"); } catch (error) { const issues = typeof error === "object" && error && "issues" in error ? (error as { issues: { path: (string | number)[]; message: string }[] }).issues : null; if (issues) setErrors(Object.fromEntries(issues.map((item) => [String(item.path[0]), item.message]))); else alert(error instanceof Error ? error.message : "Gagal mendaftar."); } finally { setLoading(false); } }
    const fields: [keyof WargaRegisterInput, string, string][] = [["nama_lengkap", "Nama Lengkap", "text"], ["nik", "NIK", "text"], ["nomor_kk", "Nomor KK", "text"], ["email", "Email", "email"], ["nomor_whatsapp", "Nomor WhatsApp", "text"], ["tempat_lahir", "Tempat Lahir", "text"], ["tanggal_lahir", "Tanggal Lahir", "date"], ["alamat", "Alamat", "text"], ["rt", "RT", "text"], ["rw", "RW", "text"], ["kelurahan", "Kelurahan", "text"], ["kecamatan", "Kecamatan", "text"], ["password", "Password", "password"], ["confirmPassword", "Konfirmasi Password", "password"]];
    return <AuthShell title="Daftar Akun Warga" subtitle="Buat akun warga untuk mengakses layanan digital secara personal dan aman."><form onSubmit={submit} className="mt-8 grid gap-4 md:grid-cols-2">{fields.slice(0, 6).map(([key, label, type]) => <AuthField key={key} label={label} error={errors[key]}><input aria-label={label} type={type} className={authInputClass} value={String(form[key])} onChange={(e) => set(key, e.target.value)} /></AuthField>)}<AuthField label="Jenis Kelamin" error={errors.jenis_kelamin}><select aria-label="Jenis Kelamin" className={authInputClass} value={form.jenis_kelamin} onChange={(e) => set("jenis_kelamin", e.target.value)}><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></AuthField>{fields.slice(6).map(([key, label, type]) => <AuthField key={key} label={label} error={errors[key]}><input aria-label={label} type={type} className={authInputClass} value={String(form[key])} onChange={(e) => set(key, e.target.value)} /></AuthField>)}<label className="md:col-span-2 flex items-start gap-3 text-sm font-bold text-gov-950"><input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} className="mt-1 size-5 accent-gov-950" />Saya menyetujui syarat dan ketentuan.</label>{errors.terms ? <p className="text-sm font-bold text-red-600 md:col-span-2">{errors.terms}</p> : null}<Button type="submit" variant="gold" disabled={loading} className="md:col-span-2"><UserPlus size={18} />{loading ? "Mendaftarkan..." : "Daftar Sekarang"}</Button></form></AuthShell>;
}