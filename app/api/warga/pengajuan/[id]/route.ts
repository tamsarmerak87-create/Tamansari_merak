import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";

type ValidatedWarga = { warga: WargaProfile | null } | { error: string; status: number };
type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const WARGA_PROFILE_SAFE_COLUMNS = "id,nama_lengkap,nik,nomor_kk,email,nomor_hp,nomor_whatsapp,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,foto_url,role,status_verifikasi,alasan_penolakan,created_at,updated_at";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function logSupabaseError(label: string, error: unknown) {
    const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(label, {
        message: supabaseError.message ?? (error instanceof Error ? error.message : "Unknown error"),
        code: supabaseError.code,
        details: supabaseError.details,
        hint: supabaseError.hint,
    });
}

function logDetailError(error: unknown) {
    const supabaseError = error as { code?: string; details?: string; hint?: string };
    console.error("DETAIL PENGAJUAN ERROR", {
        message: error instanceof Error ? error.message : String(error),
        code: supabaseError.code,
        details: supabaseError.details,
        hint: supabaseError.hint,
    });
}

async function getValidatedWarga(request: NextRequest): Promise<ValidatedWarga> {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { error: "Silakan login terlebih dahulu.", status: 401 as const };

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return { error: "Session warga tidak valid.", status: 401 as const };

    const user = userData.user;
    const byId = await supabase.from("warga_profiles").select(WARGA_PROFILE_SAFE_COLUMNS).eq("id", user.id).maybeSingle<WargaProfile>();
    if (byId.error) throw byId.error;
    if (byId.data) return { warga: byId.data };

    const byEmail = await supabase.from("warga_profiles").select(WARGA_PROFILE_SAFE_COLUMNS).eq("email", user.email ?? "").maybeSingle<WargaProfile>();
    if (byEmail.error) throw byEmail.error;
    return { warga: byEmail.data ?? null };
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const validated = await getValidatedWarga(request);
        if ("error" in validated) return jsonError(validated.error, validated.status);
        const warga = validated.warga;
        if (!warga?.nik) return jsonError("Profil warga tidak ditemukan.", 404);
        console.log("DETAIL WARGA VALID:", Boolean(warga));

        const supabase = createSupabaseAdminClient();
        const { data: pengajuan, error } = await supabase
            .from("pengajuan_surat")
            .select(`
                id,
                nomor_pengajuan,
                nik,
                nama_lengkap,
                status,
                created_at,
                updated_at,
                layanan_id,
                keperluan,
                catatan,
                alamat,
                rt,
                rw,
                kelurahan,
                kecamatan,
                no_hp,
                email
            `)
            .eq("id", id)
            .maybeSingle();
        if (error) {
            logSupabaseError("DETAIL PENGAJUAN QUERY ERROR", error);
            throw error;
        }

        console.log("DETAIL PENGAJUAN FOUND:", Boolean(pengajuan));
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (pengajuan.nik !== warga.nik) return jsonError("Pengajuan bukan milik akun ini.", 403);

        return NextResponse.json({
            ok: true,
            data: pengajuan,
        });
    } catch (error) {
        logDetailError(error);
        return NextResponse.json(
            {
                ok: false,
                error: "Gagal mengambil detail pengajuan warga.",
            },
            { status: 500 },
        );
    }
}