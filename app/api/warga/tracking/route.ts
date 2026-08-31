import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";

type ValidatedWarga = { warga: WargaProfile | null } | { error: string; status: number };

const WARGA_PROFILE_COLUMNS = "id,user_id,nama_lengkap,nik,email,agama,status_perkawinan,status_pekerjaan,role,status_verifikasi";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

async function getValidatedWarga(request: NextRequest): Promise<ValidatedWarga> {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { error: "Silakan login terlebih dahulu.", status: 401 as const };

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return { error: "Session warga tidak valid.", status: 401 as const };

    const user = userData.user;
    const byId = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("id", user.id).maybeSingle<WargaProfile>();
    if (byId.error) throw byId.error;
    if (byId.data) return { warga: byId.data };
    const byUserId = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle<WargaProfile>();
    if (byUserId.error && byUserId.error.code !== "42703") throw byUserId.error;
    if (byUserId.data) return { warga: byUserId.data };
    const byEmail = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("email", user.email ?? "").maybeSingle<WargaProfile>();
    if (byEmail.error) throw byEmail.error;
    return { warga: byEmail.data ?? null };
}

export async function GET(request: NextRequest) {
    try {
        const validated = await getValidatedWarga(request);
        if ("error" in validated) return jsonError(validated.error, validated.status);
        const warga = validated.warga;
        if (!warga?.nik) return jsonError("Profil warga tidak ditemukan.", 404);

        const supabase = createSupabaseAdminClient();
        const nomorPengajuan = request.nextUrl.searchParams.get("nomor_pengajuan")?.trim();
        let query = supabase.from("pengajuan_surat").select("id,nomor_pengajuan,nik,status,tracking_pengajuan(id,pengajuan_id,status,keterangan,petugas,created_at)").eq("nik", warga.nik).order("created_at", { ascending: false });
        if (nomorPengajuan) query = query.eq("nomor_pengajuan", nomorPengajuan);

        const { data: pengajuan, error } = await query.limit(1).maybeSingle();
        if (error) throw error;
        if (!pengajuan) return NextResponse.json({ ok: true, data: null, message: "Tracking belum tersedia" });

        const tracking = Array.isArray(pengajuan.tracking_pengajuan) ? pengajuan.tracking_pengajuan : [];
        if (tracking.length === 0) return NextResponse.json({ ok: true, data: null, message: "Tracking belum tersedia" });

        return NextResponse.json({ ok: true, data: tracking[tracking.length - 1] ?? null });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal mengambil tracking warga.";
        return jsonError(message, 500);
    }
}