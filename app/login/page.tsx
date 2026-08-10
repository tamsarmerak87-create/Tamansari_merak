"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField, AuthShell, authInputClass } from "@/components/auth/auth-ui";
import { getCurrentWargaVerificationStatus, getVerificationRedirectPath, loginWarga, signInWithGoogle } from "@/services/warga-auth.service";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { getFriendlyMessage } from "@/lib/messages";

export default function LoginPage() {
    const router = useRouter();
    const { refresh } = useWargaAuth();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    async function submit(event: FormEvent) {
        event.preventDefault();
        try {
            setLoading(true);
            setErrorMessage("");
            await loginWarga({ identifier, password, remember });
            await refresh();
            const { profile } = await getCurrentWargaVerificationStatus();
            router.replace(getVerificationRedirectPath(profile));
        } catch (error) {
            setErrorMessage(getFriendlyMessage(error, "Email/NIK atau password salah. Silakan periksa kembali."));
        } finally {
            setLoading(false);
        }
    }

    async function google() { try { setErrorMessage(""); await signInWithGoogle(); } catch (error) { setErrorMessage(getFriendlyMessage(error, "Gagal masuk dengan Google. Silakan coba lagi.")); } }

    return <AuthShell title="Selamat Datang" subtitle="Silakan masuk untuk melanjutkan."><form onSubmit={submit} className="mt-8 space-y-5">{errorMessage ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-100">{errorMessage}</div> : null}<AuthField label="Email / NIK"><input aria-label="Email atau NIK" className={authInputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></AuthField><AuthField label="Password"><input aria-label="Password" type="password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} /></AuthField><div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold"><label className="flex items-center gap-2 text-gov-950"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-5 accent-gov-950" />Ingat Saya</label><Link href="/login" className="text-gov-800 underline">Lupa Password</Link></div><Button type="submit" variant="gold" disabled={loading}><LogIn size={18} />{loading ? "Memproses..." : "Masuk"}</Button><div className="flex items-center gap-3 text-xs font-black uppercase tracking-[.2em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />atau<span className="h-px flex-1 bg-slate-200" /></div><Button type="button" variant="glass" onClick={google} className="w-full"><Mail size={18} />Masuk dengan Google</Button><p className="text-center text-sm font-bold text-slate-600">Belum punya akun? <Link href="/register" className="text-gov-950 underline">Daftar Sekarang</Link></p></form></AuthShell>;
}