"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthField, AuthShell, authInputClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { getFriendlyMessage } from "@/lib/messages";
import { requestPasswordReset } from "@/services/warga-auth.service";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function submit(event: FormEvent) {
        event.preventDefault();
        try {
            setLoading(true); setError(""); setMessage("");
            await requestPasswordReset(email);
            setMessage("Jika email terdaftar, link reset password akan dikirim ke email Anda.");
        } catch (cause) {
            setError(getFriendlyMessage(cause, "Permintaan reset password belum berhasil. Silakan coba lagi."));
        } finally { setLoading(false); }
    }

    return <AuthShell title="Lupa Password?" subtitle="Masukkan email akun Anda."><form onSubmit={submit} className="mt-8 space-y-5">{message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}{error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}<AuthField label="Email"><input aria-label="Email" type="email" required className={authInputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></AuthField><Button type="submit" variant="gold" disabled={loading}><Mail size={18} />{loading ? "Mengirim..." : "Kirim Link Reset Password"}</Button><p className="text-center text-sm font-bold"><Link href="/login" className="text-gov-950 underline">Kembali ke Login</Link></p></form></AuthShell>;
}