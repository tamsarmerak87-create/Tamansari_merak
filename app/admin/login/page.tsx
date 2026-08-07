"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginAdminPortal } from "@/services/admin-auth.service";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    try {
      setError("");
      setLoading(true);
      await loginAdminPortal(email, password);
      router.replace("/admin/dashboard");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Gagal masuk Portal Admin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#f6d889_0,#f8fafc_32%,#071a33_100%)] p-4">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(7,26,51,.82),rgba(11,44,106,.64),rgba(255,255,255,.18))]" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/30 bg-white/90 shadow-[0_28px_90px_rgba(7,26,51,.35)] backdrop-blur-xl lg:grid-cols-[1.05fr_.95fr]">
        <div className="bg-[linear-gradient(135deg,#071a33,#0B2C6A)] p-8 text-white sm:p-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-400 text-gov-950 shadow-[0_18px_40px_rgba(246,216,137,.35)]">
            <Building2 className="size-9" />
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[.25em] text-accent-200">Portal Admin Kelurahan Tamansari</p>
          <h1 className="mt-4 text-4xl font-black leading-tight">Ruang kerja petugas untuk pelayanan digital warga.</h1>
          <p className="mt-5 leading-8 text-white/75">Akses terpisah dari Portal Warga. Hanya akun Supabase dengan role <b>admin</b> atau <b>petugas</b> yang dapat mengelola verifikasi warga dan layanan administrasi.</p>
          <div className="mt-8 rounded-[2rem] border border-white/15 bg-white/10 p-5">
            <ShieldCheck className="size-7 text-accent-300" />
            <p className="mt-3 font-black">Pemerintah Digital Indonesia</p>
            <p className="mt-1 text-sm font-bold text-white/65">Aman, terotorisasi, dan siap memicu realtime status warga.</p>
          </div>
        </div>
        <form onSubmit={login} className="p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.25em] text-accent-700">Admin Login</p>
          <h2 className="mt-2 text-3xl font-black text-gov-950">Masuk Dashboard</h2>
          <label className="mt-8 block text-sm font-black text-gov-950">Email Admin/Petugas</label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100 focus-within:ring-accent-300">
            <Mail className="size-5 text-slate-400" />
            <input className="w-full bg-transparent font-bold outline-none" placeholder="admin@tamansari.id" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <label className="mt-5 block text-sm font-black text-gov-950">Password</label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100 focus-within:ring-accent-300">
            <LockKeyhole className="size-5 text-slate-400" />
            <input className="w-full bg-transparent font-bold outline-none" placeholder="••••••••" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700">{error}</p>}
          <Button type="submit" variant="gold" disabled={loading} className="mt-6 w-full sm:w-full">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
            {loading ? "Memverifikasi role..." : "Masuk Portal Admin"}
          </Button>
        </form>
      </section>
    </main>
  );
}
