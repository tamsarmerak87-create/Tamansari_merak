"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField, AuthShell, authInputClass } from "@/components/auth/auth-ui";
import { registerWarga, wargaRegisterSchema, type WargaRegisterInput } from "@/services/warga-auth.service";

const empty: WargaRegisterInput = { nama_lengkap: "", nik: "", nomor_kk: "", email: "", nomor_whatsapp: "", tempat_lahir: "", tanggal_lahir: "", jenis_kelamin: "", alamat: "", rt: "", rw: "", kelurahan: "Tamansari", kecamatan: "Pulomerak", password: "", confirmPassword: "", terms: false };

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState(empty);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const set = (key: keyof WargaRegisterInput, value: string | boolean) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: "" })); };
    function validateBeforeSubmit() {
        const next: Record<string, string> = {};
        if (!form.nama_lengkap.trim()) next.nama_lengkap = "Nama wajib diisi.";
        if (!/^\d{16}$/.test(form.nik)) next.nik = "NIK harus 16 digit.";
        if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Email valid wajib diisi.";
        if (form.password.length < 8) next.password = "Password minimal 8 karakter.";
        if (form.password !== form.confirmPassword) next.confirmPassword = "Password dan Konfirmasi Password harus sama.";
        if (!form.terms) next.terms = "Checkbox persetujuan wajib dicentang.";
        return next;
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        try {
            setLoading(true);
            setErrors({});
            setNotice(null);
            const manualErrors = validateBeforeSubmit();
            if (Object.keys(manualErrors).length > 0) {
                setErrors(manualErrors);
                setNotice({ type: "error", message: Object.values(manualErrors)[0] ?? "Periksa kembali data pendaftaran." });
                return;
            }
            const parsed = wargaRegisterSchema.safeParse(form);
            console.log("register validation response", parsed);
            console.log("register validation data", parsed.success ? parsed.data : null);
            if (!parsed.success) {
                const fieldErrors = Object.fromEntries(parsed.error.issues.map((item) => [String(item.path[0]), item.message]));
                console.error(parsed.error);
                setErrors(fieldErrors);
                setNotice({ type: "error", message: parsed.error.issues[0]?.message ?? "Validasi pendaftaran gagal." });
                return;
            }
            const response = await registerWarga(parsed.data);
            console.log("register response", response);
            console.log("register data", response);
            setNotice({ type: "success", message: "Akun berhasil dibuat." });
            window.setTimeout(() => router.push("/verify"), 700);
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : "Terjadi kesalahan tidak dikenal saat mendaftar.";
            setNotice({ type: "error", message });
        } finally {
            setLoading(false);
        }
    }
    const fields: [keyof WargaRegisterInput, string, string][] = [["nama_lengkap", "Nama Lengkap", "text"], ["nik", "NIK", "text"], ["nomor_kk", "Nomor KK", "text"], ["email", "Email", "email"], ["nomor_whatsapp", "Nomor WhatsApp", "text"], ["tempat_lahir", "Tempat Lahir", "text"], ["tanggal_lahir", "Tanggal Lahir", "date"], ["alamat", "Alamat", "text"], ["rt", "RT", "text"], ["rw", "RW", "text"], ["kelurahan", "Kelurahan", "text"], ["kecamatan", "Kecamatan", "text"], ["password", "Password", "password"], ["confirmPassword", "Konfirmasi Password", "password"]];
    return <AuthShell title="Daftar Akun Warga" subtitle="Buat akun warga untuk mengakses layanan digital secara personal dan aman.">{notice ? <div className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.type === "success" ? <CheckCircle2 className="shrink-0" size={20} /> : <XCircle className="shrink-0" size={20} />}<span>{notice.type === "success" ? "✅ " : "❌ "}{notice.message}</span></div> : null}<form onSubmit={submit} className="mt-8 grid gap-4 md:grid-cols-2">{fields.slice(0, 6).map(([key, label, type]) => <AuthField key={key} label={label} error={errors[key]}><input aria-label={label} type={type} className={authInputClass} value={String(form[key])} onChange={(e) => set(key, e.target.value)} disabled={loading} /></AuthField>)}<AuthField label="Jenis Kelamin" error={errors.jenis_kelamin}><select aria-label="Jenis Kelamin" className={authInputClass} value={form.jenis_kelamin} onChange={(e) => set("jenis_kelamin", e.target.value)} disabled={loading}><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></AuthField>{fields.slice(6).map(([key, label, type]) => <AuthField key={key} label={label} error={errors[key]}><input aria-label={label} type={type} className={authInputClass} value={String(form[key])} onChange={(e) => set(key, e.target.value)} disabled={loading} /></AuthField>)}<label className="md:col-span-2 flex items-start gap-3 text-sm font-bold text-gov-950"><input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} disabled={loading} className="mt-1 size-5 accent-gov-950" />Saya menyetujui syarat dan ketentuan.</label>{errors.terms ? <p className="text-sm font-bold text-red-600 md:col-span-2">{errors.terms}</p> : null}<Button type="submit" variant="gold" disabled={loading} className="md:col-span-2">{loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}{loading ? "Mendaftarkan..." : "Daftar Sekarang"}</Button></form></AuthShell>;
}