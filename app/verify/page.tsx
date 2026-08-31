"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Info, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { AuthField, AuthShell, authInputClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { getFriendlyMessage } from "@/lib/messages";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { getCurrentWargaVerificationStatus, isVerified, resendSignupConfirmation, updateWargaPassword, wargaPasswordSchema } from "@/services/warga-auth.service";

type View = "checking" | "idle" | "registered" | "confirmed" | "recovery" | "recovery-error" | "updated" | "error";

function VerifyContent() {
    const router = useRouter();
    const params = useSearchParams();
    const [view, setView] = useState<View>("checking");
    const [message, setMessage] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [saving, setSaving] = useState(false);
    const [resending, setResending] = useState(false);
    const [accountVerified, setAccountVerified] = useState(false);

    useEffect(() => {
        let active = true;
        const supabase = createSupabaseBrowserClient();
        if (!supabase) { void Promise.resolve().then(() => { setMessage("Layanan autentikasi belum tersedia."); setView("error"); }); return; }
        if (params.get("registered") === "1") {
            void Promise.resolve().then(() => setView("registered"));
            return;
        }
        const run = async () => {
            const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
            const callbackError = params.get("error_description") || params.get("error") || hash.get("error_description") || hash.get("error");
            if (callbackError && /otp_expired|access_denied|expired|invalid/i.test(callbackError)) {
                setView("recovery-error");
                return;
            }
            if (callbackError) throw new Error(/unsupported provider|provider.*not enabled/i.test(callbackError) ? "Login dengan Google belum tersedia saat ini. Silakan gunakan email dan password." : "Link sudah tidak valid atau telah kedaluwarsa. Silakan minta link baru.");
            const code = params.get("code");
            const type = params.get("type") || hash.get("type");
            const hasCallback = Boolean(code || type || hash.get("access_token") || hash.get("refresh_token"));
            if (!hasCallback) {
                setView("idle");
                return;
            }
            if (code) { const { error } = await supabase.auth.exchangeCodeForSession(code); if (error) throw error; }
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (!data.session) throw new Error("Link verifikasi tidak valid atau sudah kedaluwarsa.");
            if (!active) return;
            if (type === "recovery") { setView("recovery"); return; }
            if (data.session.user.app_metadata?.provider === "google") { router.replace("/dashboard"); return; }
            if (!data.session.user.email_confirmed_at) throw new Error("Email belum berhasil dikonfirmasi.");
            // Confirmation only proves email ownership; officer verification remains database-driven.
            try {
                const { profile } = await getCurrentWargaVerificationStatus();
                if (!active) return;
                setAccountVerified(isVerified(profile));
            } catch {
                // A profile that cannot be read must never be presented as officer-verified.
                setAccountVerified(false);
            }
            setView("confirmed");
        };
        const { data } = supabase.auth.onAuthStateChange((event) => { if (active && event === "PASSWORD_RECOVERY") setView("recovery"); });
        void run().catch((error) => { if (active) { setMessage(getFriendlyMessage(error, "Link verifikasi tidak valid atau sudah kedaluwarsa.")); setView("error"); } });
        return () => { active = false; data.subscription.unsubscribe(); };
    }, [params, router]);

    async function save(event: FormEvent) {
        event.preventDefault(); setMessage("");
        const parsed = wargaPasswordSchema.safeParse(password);
        if (!parsed.success) { setMessage(parsed.error.issues[0]?.message || "Password belum memenuhi ketentuan."); return; }
        if (password !== confirmation) { setMessage("Konfirmasi password tidak sama."); return; }
        try { setSaving(true); await updateWargaPassword(password); setPassword(""); setConfirmation(""); setView("updated"); }
        catch (error) { setMessage(getFriendlyMessage(error, "Link reset password tidak valid atau sudah kedaluwarsa.")); }
        finally { setSaving(false); }
    }

    async function resend() {
        const email = params.get("email") || "";
        setMessage("");
        try {
            setResending(true);
            await resendSignupConfirmation(email);
            setMessage("Email konfirmasi berhasil dikirim.");
        } catch (error) {
            setMessage(getFriendlyMessage(error, "Email konfirmasi belum berhasil dikirim. Silakan coba lagi."));
        } finally {
            setResending(false);
        }
    }

    if (view === "checking") return <AuthShell title="Memeriksa Link" subtitle="Mohon tunggu, kami sedang memverifikasi tautan Anda."><div className="mt-8 flex justify-center gap-3 font-bold"><Loader2 className="animate-spin" />Memproses...</div></AuthShell>;
    if (view === "idle") return <AuthShell title="Verifikasi Email" subtitle="Silakan gunakan link yang dikirim ke email Anda."><div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center text-blue-950"><Info aria-label="Informasi" className="mx-auto size-10 text-blue-600" /><h2 className="mt-4 font-black">Belum ada proses yang sedang diproses.</h2><p className="mt-2 text-sm font-semibold leading-6">Silakan buka link dari email konfirmasi untuk mengaktifkan email Anda, atau gunakan link reset password jika Anda sedang mengatur ulang password.</p></div><Button href="/login" variant="gold" className="mt-6 w-full">Kembali ke Portal</Button></AuthShell>;
    if (view === "registered") return <AuthShell title="Registrasi Berhasil" subtitle="Silakan cek email Anda untuk mengaktifkan akun."><div className="mt-8 space-y-5 text-center"><CheckCircle2 className="mx-auto size-14 text-emerald-600" />{message && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${message.includes("berhasil") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</div>}<Button type="button" variant="gold" disabled={resending} onClick={resend}>{resending ? <Loader2 className="animate-spin" size={18} /> : null}{resending ? "Mengirim..." : "Kirim Ulang Email Konfirmasi"}</Button><Link href="/login" className="block text-sm font-bold underline">Kembali ke Portal</Link></div></AuthShell>;
    if (view === "recovery") return <AuthShell title="Reset Password" subtitle="Silakan buat password baru untuk akun Anda."><form onSubmit={save} className="mt-8 space-y-5">{message && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{message}</div>}<AuthField label="Password Baru"><input aria-label="Password Baru" type="password" autoComplete="new-password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} required /></AuthField><AuthField label="Konfirmasi Password"><input aria-label="Konfirmasi Password" type="password" autoComplete="new-password" className={authInputClass} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required /></AuthField><Button type="submit" variant="gold" disabled={saving}><KeyRound size={18} />{saving ? "Menyimpan..." : "Simpan Password"}</Button></form></AuthShell>;
    if (view === "recovery-error") return <AuthShell title="Link Reset Tidak Dapat Diproses" subtitle="Link reset password sudah kedaluwarsa atau tidak valid."><div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-950"><ShieldAlert aria-label="Link reset tidak valid" className="mx-auto size-12 text-red-600" /><p className="mt-4 text-sm font-bold leading-6">Link sudah tidak dapat digunakan. Silakan minta link reset password baru.</p></div><Button href="/forgot-password" variant="gold" className="mt-6 w-full">Minta Link Reset Baru</Button></AuthShell>;
    if (view === "error") return <AuthShell title="Link Tidak Dapat Diproses" subtitle={message || "Link sudah tidak valid atau telah kedaluwarsa. Silakan minta link baru."}><div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-950"><ShieldAlert aria-label="Link tidak valid" className="mx-auto size-12 text-red-600" /><p className="mt-4 text-sm font-bold leading-6">Link sudah tidak valid atau telah kedaluwarsa. Silakan minta link baru.</p></div><Button href="/forgot-password" variant="gold" className="mt-6 w-full">Minta Link Baru</Button></AuthShell>;
    const updated = view === "updated";
    return <AuthShell title={updated ? "Password Diperbarui" : "Email Terkonfirmasi"} subtitle={updated ? "Password berhasil diperbarui." : "Email Anda berhasil dikonfirmasi."}><div className="mt-8 space-y-6 text-center"><CheckCircle2 aria-label="Berhasil" className="mx-auto size-16 text-emerald-600" />{!updated && (accountVerified ? <div data-account-status="verified" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left text-emerald-950"><div className="flex items-start gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-emerald-600" /><div><h2 className="font-black">Akun Anda Telah Diverifikasi</h2><p className="mt-2 text-sm font-semibold leading-6">Verifikasi akun oleh petugas Kelurahan Tamansari telah selesai. Anda sekarang dapat menggunakan layanan Portal Warga.</p><span className="mt-4 inline-flex rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">Terverifikasi</span></div></div></div> : <div data-account-status="pending" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left text-amber-950"><div className="flex items-start gap-3"><Clock3 aria-label="Menunggu" className="mt-0.5 size-6 shrink-0 text-amber-600" /><div><h2 className="font-black">Akun Menunggu Verifikasi Petugas</h2><p className="mt-2 text-sm font-semibold leading-6">Email Anda sudah berhasil dikonfirmasi. Akun Anda sekarang sedang menunggu verifikasi oleh petugas Kelurahan Tamansari.</p><span className="mt-4 inline-flex rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-black tracking-wide text-amber-800">Menunggu Verifikasi Petugas</span><p className="mt-4 text-sm font-semibold leading-6">Setelah akun diverifikasi, Anda dapat menggunakan layanan Portal Warga.</p></div></div></div>)}<Button href="/login" variant="gold">Masuk ke Portal</Button></div></AuthShell>;
}

export default function VerifyPage() {
    return <Suspense fallback={<main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></main>}><VerifyContent /></Suspense>;
}