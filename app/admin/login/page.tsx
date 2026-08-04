"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/services/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login() {
    const client = createSupabaseBrowserClient();
    if (!client) return setError("Supabase belum dikonfigurasi.");

    const { error: authError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) setError(authError.message);
    else router.push("/admin/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#edf4f1] p-4">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-soft">
        <p className="text-xs font-black uppercase tracking-[.25em] text-accent-700">
          Admin Kelurahan
        </p>
        <h1 className="mt-2 text-3xl font-black text-gov-950">Login TAMSAR</h1>
        <input
          className="mt-6 w-full rounded-2xl bg-slate-50 p-4"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="mt-3 w-full rounded-2xl bg-slate-50 p-4"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="mt-3 text-sm font-bold text-red-600">{error}</p>
        )}
        <button
          onClick={login}
          className="mt-5 w-full rounded-2xl bg-gov-950 p-4 font-black text-white"
        >
          Masuk Dashboard
        </button>
      </section>
    </main>
  );
}
