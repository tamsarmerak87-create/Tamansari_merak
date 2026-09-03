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
    const profile = session.profile;
    const role = profile.role;
    const isLurah = role === "lurah";
    const [submissions, stages, officers] = await Promise.all([
        db.from("pengajuan_surat").select("id,nomor_pengajuan,nama_lengkap,status,created_at,selesai_at,selesai_by,verified_by,layanan:layanan_id(nama)").order("created_at", { ascending: false }),
        db.from("verifikasi_pengajuan").select("pengajuan_id,tahap,role_petugas,status,petugas_id,created_at,acted_at").order("tahap", { ascending: true }),
        db.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active").eq("is_active", true),
    ]);
    const problem = submissions.error ?? stages.error ?? officers.error;
    if (problem) return NextResponse.json({ ok: false, error: problem.message }, { status: 500 });
    const people = (officers.data ?? []) as R[]; const byId = new Map(people.map((p) => [String(p.id), p])); const grouped = new Map<string, R[]>();
    for (const stage of (stages.data ?? []) as R[]) grouped.set(String(stage.pengajuan_id), [...(grouped.get(String(stage.pengajuan_id)) ?? []), stage]);
    const rows = ((submissions.data ?? []) as R[]).flatMap((item) => {
        const ss = grouped.get(String(item.id)) ?? [];
        const active = ss.find((s) => ["Diproses", "Menunggu"].includes(String(s.status))) ?? ss.at(-1);
        // Lurah monitors all workflow stages. Other roles receive only their
        // own stage; staff/lapangan additionally require the existing assignment.
        const visible = isLurah
            ? ss
            : ss.filter((s) => s.role_petugas === role && (role === "kepala_seksi" || role === "seklur" || String(s.petugas_id) === String(profile.id)));
        if (!visible.length) return [];
        const stage = visible.find((s) => s.id === active?.id) ?? visible.at(-1)!;
        const pid = stage.petugas_id ?? (isLurah ? item.selesai_by ?? item.verified_by : null);
        const person = pid ? byId.get(String(pid)) : null;
        return [{ id: item.id, nomor_pengajuan: item.nomor_pengajuan ?? item.id, nama_pemohon: item.nama_lengkap, jenis_layanan: Array.isArray(item.layanan) ? item.layanan[0]?.nama : item.layanan?.nama, petugas_id: pid ?? null, petugas_nama: person?.nama_lengkap ?? person?.username ?? null, peran_petugas: stage.role_petugas ?? role, status: stage.status ?? item.status ?? "Menunggu", tanggal_masuk: item.created_at, tanggal_selesai: item.selesai_at ?? null }];
    });
    return NextResponse.json({ ok: true, data: { rows, role, officers: isLurah ? people.map((p) => ({ id: p.id, nama: p.nama_lengkap ?? p.username, peran: p.role ?? p.jabatan })) : [] } });
}