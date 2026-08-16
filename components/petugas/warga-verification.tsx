"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentPetugasPortalUser, type AdminPortalProfile } from "@/services/admin-auth.service";

type Row = Record<string, any>;

const steps = [
    { label: "Registrasi", role: null, status: "Registrasi" },
    { label: "Staff Pelayanan", role: "staff_pelayanan", status: "Menunggu Staff Pelayanan" },
    { label: "Petugas Lapangan", role: "petugas_lapangan", status: "Menunggu Petugas Lapangan" },
    { label: "Kasi", role: "kepala_seksi", status: "Menunggu Kasi" },
    { label: "Sek Lur", role: "seklur", status: "Menunggu Sek Lur" },
    { label: "Lurah", role: "lurah", status: "Menunggu Lurah" },
    { label: "Terverifikasi", role: null, status: "Terverifikasi" },
];

function getStepIndex(row: Row, history: Row[]) {
    if (row.status_verifikasi === "Terverifikasi") return steps.length - 1;
    if (row.status_verifikasi === "Dikembalikan") return Math.max(1, steps.findIndex((step) => step.role === row.returned_to_role));
    const statusIndex = steps.findIndex((step) => step.status === row.status_verifikasi || step.label === row.active_stage?.label || step.label === row.tahap_verifikasi);
    if (statusIndex > -1) return statusIndex;
    const lastHistory = [...history].reverse().find((item) => item.status_sesudah || item.returned_to_role);
    if (lastHistory?.returned_to_role) return Math.max(1, steps.findIndex((step) => step.role === lastHistory.returned_to_role));
    return 1;
}

export function PetugasWargaVerification({ id }: { id: string }) {
    const router = useRouter();
    const [profile, setProfile] = useState<AdminPortalProfile | null>(null);
    const [row, setRow] = useState<Row | null>(null);
    const [reason, setReason] = useState("");
    const [returnToRole, setReturnToRole] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            const me = await getCurrentPetugasPortalUser();
            if (!me.profile) return router.replace("/petugas/login");
            setProfile(me.profile);
            const res = await fetch(`/api/petugas/verifikasi-warga?id=${id}`, { credentials: "include", cache: "no-store" });
            const json = await res.json();
            setRow(json.data ?? null);
            setReturnToRole(json.data?.return_targets?.[0]?.role ?? json.return_targets?.[0]?.role ?? "");
        })();
    }, [id, router]);

    async function act(action: string) {
        if (["kembalikan", "tolak"].includes(action) && !reason.trim()) return alert("Alasan wajib diisi.");
        if (action === "kembalikan" && returnTargets.length && !returnToRole) return alert("Pilih tujuan pengembalian.");
        setBusy(true);
        const res = await fetch("/api/petugas/verifikasi-warga", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action, alasan: reason, returned_to_role: returnToRole }) });
        setBusy(false);
        if (res.ok) router.push("/petugas/dashboard");
        else alert((await res.json()).error ?? "Gagal memproses.");
    }

    const history = useMemo(() => Array.isArray(row?.verification_history) ? row.verification_history : [], [row]);
    const returnTargets = Array.isArray(row?.return_targets) ? row.return_targets : [];
    if (!profile || !row) return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-center font-bold">Memuat verifikasi warga...</main>;
    const current = row.active_stage?.label ?? row.tahap_verifikasi ?? row.status_verifikasi;
    const currentStep = getStepIndex(row, history);

    return <main className="min-h-screen overflow-x-hidden bg-slate-50 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-6xl space-y-5">
            <Link href="/petugas/dashboard" className="inline-flex rounded-2xl bg-white px-4 py-3 font-black shadow-sm">Kembali</Link>
            <header className="rounded-[2rem] bg-gov-950 p-5 text-white md:p-6">
                <p className="text-xs font-black tracking-[0.3em] text-accent-300">VERIFIKASI AKUN WARGA</p>
                <h1 className="mt-2 break-words text-3xl font-black md:text-4xl">{row.nama_lengkap}</h1>
                <p className="mt-2 break-words font-bold">Status: {row.status_verifikasi} | Tahap: {current}</p>
            </header>
            <section className="grid gap-4 md:grid-cols-2">{[["Nama lengkap", row.nama_lengkap], ["NIK", row.nik], ["Nomor KK", row.nomor_kk], ["Email", row.email], ["Nomor HP", row.nomor_hp ?? row.nomor_whatsapp], ["Alamat", row.alamat], ["Kelurahan", row.kelurahan], ["Kecamatan", row.kecamatan], ["Petugas menangani", row.handled_by ?? "-"]].map(([a, b]) => <div key={String(a)} className="min-w-0 rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">{a}</p><p className="break-words font-black text-gov-950">{String(b ?? "-")}</p></div>)}</section>
            <section className="overflow-x-auto rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex min-w-[720px] gap-2">{steps.map((step, index) => {
                    const done = index < currentStep || row.status_verifikasi === "Terverifikasi";
                    const active = index === currentStep && row.status_verifikasi !== "Terverifikasi";
                    return <div key={step.label} className={`flex-1 rounded-2xl px-3 py-3 text-center text-sm font-black ${done ? "bg-emerald-100 text-emerald-800" : active ? "bg-accent-300 text-gov-950" : "bg-slate-100 text-slate-500"}`}>{done ? "✓" : active ? "●" : "○"} {step.label}</div>;
                })}</div>
            </section>
            <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black text-gov-950">Riwayat Verifikasi</h2>{history.length ? history.map((h: Row, i: number) => <div key={i} className="mt-3 rounded-2xl border p-3"><b>{h.nama_petugas ?? h.role}</b><p className="break-words">{h.action}: {h.status_sebelum} -&gt; {h.status_sesudah}</p><p className="text-sm text-slate-500">{h.catatan ?? "Tidak ada catatan"}</p></div>) : <p className="mt-3 font-bold text-slate-500">Belum ada riwayat.</p>}</section>
            <section className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="font-black text-gov-950">Aksi</h2>
                {returnTargets.length > 0 && <label className="mt-3 block text-sm font-black text-slate-600">Tujuan pengembalian<select value={returnToRole} onChange={(e) => setReturnToRole(e.target.value)} className="mt-2 w-full rounded-2xl border p-3 font-bold"><option value="">Pilih tujuan</option>{returnTargets.map((target: Row) => <option key={target.role} value={target.role}>Kembalikan ke {target.label}</option>)}</select></label>}
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 min-h-28 w-full rounded-2xl border p-4" placeholder="Alasan wajib untuk kembalikan/tolak" />
                <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => act("periksa")} className="rounded-xl bg-slate-100 px-4 py-3 font-black">Periksa</button><button disabled={busy} onClick={() => act("setujui")} className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white">Setujui / Teruskan</button><button disabled={busy || !returnTargets.length} onClick={() => act("kembalikan")} className="rounded-xl bg-amber-100 px-4 py-3 font-black text-amber-900 disabled:opacity-50">Kembalikan</button><button disabled={busy} onClick={() => act("tolak")} className="rounded-xl bg-red-600 px-4 py-3 font-black text-white">Tolak</button></div>
            </section>
        </div>
    </main>;
}