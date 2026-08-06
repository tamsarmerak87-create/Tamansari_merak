"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField, AuthShell, authInputClass } from "@/components/auth/auth-ui";
import { resendWargaOtp, verifyWargaOtp } from "@/services/warga-auth.service";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";

export default function VerifyPage() {
    const { profile, refresh } = useWargaAuth();
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    async function submit(event: FormEvent) { event.preventDefault(); try { setLoading(true); await verifyWargaOtp(otp); await refresh(); alert("✔ Akun Terverifikasi"); } catch (error) { alert(error instanceof Error ? error.message : "Gagal verifikasi OTP."); } finally { setLoading(false); } }
    async function resend() { try { setLoading(true); await resendWargaOtp(); alert("Kode OTP baru telah dikirim."); } catch (error) { alert(error instanceof Error ? error.message : "Gagal kirim ulang OTP."); } finally { setLoading(false); } }
    return <AuthShell title={profile?.status_verifikasi === "Akun Terverifikasi" ? "✔ Akun Terverifikasi" : "Verifikasi Akun"} subtitle="Masukkan kode OTP 6 digit yang dikirim melalui Email atau WhatsApp."><form onSubmit={submit} className="mt-8 space-y-5"><div className="rounded-[24px] bg-gov-50 p-5 font-bold text-gov-950">Status: {profile?.status_verifikasi ?? "Belum Terverifikasi"}</div><AuthField label="6 Digit OTP"><input aria-label="6 Digit OTP" inputMode="numeric" maxLength={6} className={authInputClass} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} /></AuthField><div className="flex flex-wrap gap-3"><Button type="submit" variant="gold" disabled={loading}><CheckCircle2 size={18} />{loading ? "Memproses..." : "Verifikasi"}</Button><Button type="button" variant="glass" onClick={resend} disabled={loading}><Send size={18} />Kirim Ulang OTP</Button></div></form></AuthShell>;
}