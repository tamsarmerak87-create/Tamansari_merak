import { NextResponse, type NextRequest } from "next/server";
import { canManageUsers, getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

const wargaColumns = "id,nama_lengkap,nik,email,nomor_hp,nomor_whatsapp,nomor_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,alamat,rt,rw,kelurahan,kecamatan,status_verifikasi,alasan_penolakan,created_at";

function jsonError(message: string, status: number) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return jsonError("Session admin tidak valid.", 401);
    if (!canManageUsers(session.profile)) return jsonError("Akses khusus admin.", 403);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("warga_profiles")
        .select(wargaColumns)
        .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, data: data ?? [] });
}