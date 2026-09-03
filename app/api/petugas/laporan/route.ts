import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type R = Record<string, any>;
export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return NextResponse.json({ ok: false, error: "Sesi petugas tidak valid." }, { status: 401 });
    if (!isPetugas(session.profile)) return NextResponse.json({ ok: false, error: "Akses khusus petugas." }, { status: 403 });
    const db = createSupabaseAdminClient();
    if (!db) return NextResponse.json({ ok: false, error: "Supabase service role belum dikonfigurasi." }, { status: 500 });
    const [submissions, stages, officers] = await Promise.all([
        db.from("pengajuan_surat").select("id,nomor_pengajuan,nama_lengkap,status,created_at,selesai_at,selesai_by,verified_by,layanan:layanan_id(nama)").order("created_at", { ascending: false }),
        db.from("verifikasi_pengajuan").select("pengajuan_id,tahap,role_petugas,status,petugas_id,created_at,acted_at").order("tahap", { ascending: true }),
        db.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active").eq("is_active", true),
    ]);
    const problem = submissions.error ?? stages.error ?? officers.error;
    if (problem) return NextResponse.json({ ok: false, error: problem.message }, { status: 500 });
    const people = (officers.data ?? []) as R[]; const byId = new Map(people.map((p) => [String(p.id), p])); const grouped = new Map<string, R[]>();
    for (const stage of (stages.data ?? []) as R[]) grouped.set(String(stage.pengajuan_id), [...(grouped.get(String(stage.pengajuan_id)) ?? []), stage]);
    const rows = ((submissions.data ?? []) as R[]).map((item) => { const ss = grouped.get(String(item.id)) ?? []; const handled = [...ss].filter((s) => s.petugas_id).sort((a, b) => String(b.acted_at ?? b.created_at).localeCompare(String(a.acted_at ?? a.created_at)))[0]; const pid = handled?.petugas_id ?? item.selesai_by ?? item.verified_by; const person = pid ? byId.get(String(pid)) : null; const active = ss.find((s) => s.status === "Diproses") ?? ss.find((s) => s.status === "Menunggu"); return { id: item.id, nomor_pengajuan: item.nomor_pengajuan ?? item.id, nama_pemohon: item.nama_lengkap, jenis_layanan: Array.isArray(item.layanan) ? item.layanan[0]?.nama : item.layanan?.nama, petugas_id: pid ?? null, petugas_nama: person?.nama_lengkap ?? person?.username ?? null, peran_petugas: handled?.role_petugas ?? person?.role ?? person?.jabatan ?? active?.role_petugas ?? null, status: item.status ?? active?.status ?? "Menunggu", tanggal_masuk: item.created_at, tanggal_selesai: item.selesai_at ?? null }; });
    return NextResponse.json({ ok: true, data: { rows, officers: people.map((p) => ({ id: p.id, nama: p.nama_lengkap ?? p.username, peran: p.role ?? p.jabatan })) } });
}