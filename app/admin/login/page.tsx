"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentAdminPortalUser, loginAdminPortal } from "@/services/admin-auth.service";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { profile } = await getCurrentAdminPortalUser();
        if (mounted && profile) router.replace("/admin/dashboard");
      } catch {
        // Tetap tampilkan form login jika tidak ada cookie admin aktif.
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  async function login(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    try {
      setError("");
      setLoading(true);
      await loginAdminPortal(username, password);
      router.replace("/admin/dashboard");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Username atau password salah.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_top,#f6d889_0,#f8fafc_30%,#dbe7f5_100%)] p-4 sm:p-6">
      <div className="absolute -left-24 top-[-7rem] h-72 w-72 rounded-full bg-accent-300/30 blur-3xl" />
      <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-gov-800/20 blur-3xl" />

      <section className="relative w-full max-w-md rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(7,26,51,.18)] backdrop-blur-xl sm:p-10">
        <form onSubmit={login}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gov-950 text-accent-300 shadow-[0_14px_30px_rgba(7,26,51,.22)]">
            <Building2 className="size-8" />
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-black uppercase tracking-[.25em] text-accent-700">Login Admin</p>
            <h1 className="mt-2 text-3xl font-black text-gov-950">Masuk ke Dashboard</h1>
          </div>

          <label className="mt-8 block text-sm font-black text-gov-950" htmlFor="admin-username">
            Username atau Email
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-accent-400">
            <UserRound className="size-5 shrink-0 text-slate-400" />
            <input
              id="admin-username"
              className="min-w-0 w-full bg-transparent font-bold text-gov-950 outline-none placeholder:font-medium placeholder:text-slate-400"
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Masukkan username atau email"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <label className="mt-5 block text-sm font-black text-gov-950" htmlFor="admin-password">
            Password
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-accent-400">
            <LockKeyhole className="size-5 shrink-0 text-slate-400" />
            <input
              id="admin-password"
              className="min-w-0 w-full bg-transparent font-bold text-gov-950 outline-none placeholder:font-medium placeholder:text-slate-400"
              name="password"
              autoComplete="current-password"
              placeholder="Masukkan password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" variant="gold" disabled={loading} className="mt-6 w-full sm:w-full">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
            {loading ? "Memverifikasi akun..." : "Login Admin"}
          </Button>
        </form>
      </section>
    </main>
  );
}