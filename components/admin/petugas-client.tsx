"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, Pencil, Plus, Power, ShieldCheck, Trash2, UserCog } from "lucide-react";

type Role = "admin" | "petugas";
type Petugas = {
    id: string;
    username: string;
    nama_lengkap: string | null;
    nip: string | null;
    jabatan: string | null;
    role: Role;
    is_active: boolean;
};

type FormState = {
    nama_lengkap: string;
    username: string;
    password: string;
    nip: string;
    jabatan: string;
    role: Role;
    is_active: boolean;
};

const initialForm: FormState = {
    nama_lengkap: "",
    username: "",
    password: "",
    nip: "",
    jabatan: "",
    role: "petugas",
    is_active: true,
};

async function readJson(response: Response) {
    const json = await response.json().catch(() => null) as { ok?: boolean; message?: string; data?: unknown } | null;
    if (!response.ok || json?.ok === false) throw new Error(json?.message ?? "Permintaan gagal diproses.");
    return json;
}

export function PetugasListPage() {
    const router = useRouter();
    const [rows, setRows] = useState<Petugas[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const json = await readJson(await fetch("/api/admin/petugas", { credentials: "include", cache: "no-store" }));
            setRows((json?.data as Petugas[]) ?? []);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Gagal memuat data petugas.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(() => { void load(); }, 0);
        return () => window.clearTimeout(timeout);
    }, [load]);

    const remove = async (row: Petugas) => {
        if (!confirm(`Hapus petugas ${row.nama_lengkap ?? row.username}?`)) return;
        await readJson(await fetch(`/api/admin/petugas/${row.id}`, { method: "DELETE", credentials: "include" }));
        setMessage("Petugas berhasil dihapus.");
        await load();
    };

    const toggleActive = async (row: Petugas) => {
        await readJson(await fetch(`/api/admin/petugas/${row.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ ...row, is_active: !row.is_active }),
        }));
        setMessage(row.is_active ? "Petugas berhasil dinonaktifkan." : "Petugas berhasil diaktifkan.");
        await load();
    };

    const resetPassword = async (row: Petugas) => {
        const passwordBaru = prompt(`Password baru untuk ${row.nama_lengkap ?? row.username} (minimal 6 karakter):`);
        if (!passwordBaru) return;
        await readJson(await fetch("/api/admin/petugas/reset-password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id: row.id, passwordBaru }),
        }));
        setMessage("Password petugas berhasil direset dengan bcrypt hash.");
    };

    return <PetugasFrame>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
                <p className="text-xs font-black uppercase tracking-[.22em] text-accent-700">Portal Admin Aman</p>
                <h1 className="mt-2 text-3xl font-black text-gov-950">Manajemen Petugas</h1>
                <p className="mt-1 font-bold text-slate-500">CRUD petugas dengan password tersimpan sebagai bcrypt hash.</p>
            </div>
            <Link href="/admin/petugas/tambah" className="inline-flex items-center gap-2 rounded-2xl bg-accent-400 px-5 py-3 font-black text-gov-950 shadow-soft">
                <Plus size={18} /> Tambah Petugas
            </Link>
        </div>
        {message && <div className="mb-4 rounded-2xl bg-gov-950 px-5 py-3 font-bold text-white">{message}</div>}
        <section className="rounded-[2rem] bg-white p-5 shadow-soft">
            {loading ? <div className="flex items-center gap-2 font-black text-gov-950"><Loader2 className="animate-spin" /> Memuat data petugas...</div> : <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.14em] text-slate-500">
                        <tr><th className="p-4">Nama</th><th className="p-4">Username</th><th className="p-4">NIP</th><th className="p-4">Jabatan</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Aksi</th></tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => <tr key={row.id} className="border-t align-top">
                            <td className="p-4 font-black text-gov-950">{row.nama_lengkap ?? "-"}</td>
                            <td className="p-4 font-bold">{row.username}</td>
                            <td className="p-4">{row.nip ?? "-"}</td>
                            <td className="p-4">{row.jabatan ?? "-"}</td>
                            <td className="p-4"><span className="rounded-full bg-accent-100 px-3 py-1 font-black text-gov-950">{row.role}</span></td>
                            <td className="p-4"><span className={row.is_active ? "rounded-full bg-emerald-100 px-3 py-1 font-black text-emerald-700" : "rounded-full bg-red-100 px-3 py-1 font-black text-red-700"}>{row.is_active ? "Aktif" : "Nonaktif"}</span></td>
                            <td className="p-4"><div className="flex flex-wrap gap-2">
                                <button onClick={() => router.push(`/admin/petugas/edit/${row.id}`)} className="rounded-xl bg-gov-950 px-3 py-2 font-black text-white"><Pencil size={15} className="inline" /> Edit</button>
                                <button onClick={() => resetPassword(row)} className="rounded-xl bg-amber-500 px-3 py-2 font-black text-gov-950"><KeyRound size={15} className="inline" /> Reset Password</button>
                                <button onClick={() => toggleActive(row)} className="rounded-xl bg-slate-700 px-3 py-2 font-black text-white"><Power size={15} className="inline" /> {row.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                                <button onClick={() => remove(row)} className="rounded-xl bg-red-600 px-3 py-2 font-black text-white"><Trash2 size={15} className="inline" /> Hapus</button>
                            </div></td>
                        </tr>)}
                    </tbody>
                </table>
                {rows.length === 0 && <p className="py-10 text-center font-bold text-slate-500">Belum ada data petugas.</p>}
            </div>}
        </section>
    </PetugasFrame>;
}

export function PetugasFormPage({ id }: { id?: string }) {
    const router = useRouter();
    const [form, setForm] = useState<FormState>(initialForm);
    const [loading, setLoading] = useState(Boolean(id));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const editing = Boolean(id);

    useEffect(() => {
        if (!id) return;
        void (async () => {
            try {
                const json = await readJson(await fetch(`/api/admin/petugas/${id}`, { credentials: "include", cache: "no-store" }));
                const row = json?.data as Petugas;
                setForm({ nama_lengkap: row.nama_lengkap ?? "", username: row.username, password: "", nip: row.nip ?? "", jabatan: row.jabatan ?? "", role: row.role, is_active: row.is_active });
            } catch (error) {
                setMessage(error instanceof Error ? error.message : "Gagal memuat petugas.");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            if (!editing && form.password.length < 6) throw new Error("Password minimal 6 karakter.");
            await readJson(await fetch(editing ? `/api/admin/petugas/${id}` : "/api/admin/petugas", {
                method: editing ? "PATCH" : "POST",
                headers: { "content-type": "application/json" },
                credentials: "include",
                body: JSON.stringify(form),
            }));
            router.push("/admin/petugas");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Gagal menyimpan petugas.");
        } finally {
            setSaving(false);
        }
    };

    return <PetugasFrame>
        <Link href="/admin/petugas" className="mb-5 inline-flex items-center gap-2 font-black text-gov-950"><ArrowLeft size={18} /> Kembali ke Petugas</Link>
        <section className="rounded-[2rem] bg-white p-6 shadow-soft">
            <div className="mb-6 rounded-[1.5rem] bg-[linear-gradient(135deg,#071a33,#0B2C6A)] p-6 text-white">
                <UserCog className="size-9 text-accent-300" />
                <h1 className="mt-3 text-3xl font-black">{editing ? "Edit Petugas" : "Tambah Petugas"}</h1>
                <p className="mt-2 font-bold text-white/70">Password baru selalu diproses dengan bcrypt.hash(password, 10), bukan plaintext.</p>
            </div>
            {message && <div className="mb-4 rounded-2xl bg-red-600 px-5 py-3 font-bold text-white">{message}</div>}
            {loading ? <div className="flex items-center gap-2 font-black"><Loader2 className="animate-spin" /> Memuat...</div> : <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                <Field label="Nama Lengkap" value={form.nama_lengkap} onChange={(v) => setForm({ ...form, nama_lengkap: v })} required />
                <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required />
                {!editing && <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />}
                <Field label="NIP" value={form.nip} onChange={(v) => setForm({ ...form, nip: v })} />
                <Field label="Jabatan" value={form.jabatan} onChange={(v) => setForm({ ...form, jabatan: v })} />
                <label className="grid gap-2 font-black text-gov-950">Role
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="rounded-2xl bg-slate-50 p-4 font-bold outline-none ring-1 ring-slate-100">
                        <option value="admin">admin</option><option value="petugas">petugas</option>
                    </select>
                </label>
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black text-gov-950">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-5" /> Status Aktif
                </label>
                <button disabled={saving} className="md:col-span-2 rounded-2xl bg-accent-400 px-6 py-4 font-black text-gov-950 disabled:opacity-60">
                    {saving ? "Menyimpan..." : "Simpan"}
                </button>
            </form>}
        </section>
    </PetugasFrame>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
    return <label className="grid gap-2 font-black text-gov-950">{label}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="rounded-2xl bg-slate-50 p-4 font-bold outline-none ring-1 ring-slate-100" />
    </label>;
}

function PetugasFrame({ children }: { children: React.ReactNode }) {
    return <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc,#eef5ff_48%,#fff8e1)] p-4 text-slate-900 lg:p-8">
        <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between rounded-[2rem] bg-white p-4 shadow-soft">
                <Link href="/admin/dashboard" className="inline-flex items-center gap-2 font-black text-gov-950"><ShieldCheck className="text-accent-600" /> Admin Tamansari</Link>
                <Link href="/admin/dashboard" className="rounded-2xl bg-gov-950 px-4 py-2 font-black text-white">Dashboard</Link>
            </div>
            {children}
        </div>
    </main>;
}
