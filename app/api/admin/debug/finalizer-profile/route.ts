import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

const FINALIZER_PROFILE_TARGET = "d481e74e-d960-4c60-a195-5921198439ae";
const LEGAL_FIELDS = ["nik", "nomor_kk", "nama_lengkap", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "alamat", "rt", "rw", "kelurahan", "kecamatan"] as const;

function sanitizedErrorMessage(message?: string) {
    if (!message) return null;
    return message.replace(/[^a-zA-Z0-9 .,_():-]/g, "?").slice(0, 160);
}

export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }

    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) {
        return NextResponse.json({ ok: false, error: "Session admin tidak valid." }, { status: 401 });
    }
    if (requireAdmin(session.profile)) {
        return NextResponse.json({ ok: false, error: "Akses khusus admin." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: pengajuan, error: pengajuanError } = await supabase
        .from("pengajuan_surat")
        .select("id,nik")
        .eq("id", FINALIZER_PROFILE_TARGET)
        .maybeSingle();

    if (pengajuanError || !pengajuan) {
        console.info("[PROFILE FINALIZER DIAGNOSTIC]", {
            target_found: false,
            profile_found: false,
            profile_query_error: Boolean(pengajuanError),
        });
        return NextResponse.json({
            pengajuan_found: false,
            profile_query_ok: false,
            profile_found: false,
            profile_match_count: null,
            profile_status_is_terverifikasi: false,
            legal_fields_complete: false,
            query_error_code: pengajuanError?.code ?? null,
            query_error_message: sanitizedErrorMessage(pengajuanError?.message),
        });
    }

    // Keep this query identical to the authoritative profile query in the finalizer.
    const { data: wargaProfile, error: wargaError } = await supabase.from("warga_profiles")
        .select("nik,nomor_kk,nama_lengkap,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,alamat,rt,rw,kelurahan,kecamatan,status_verifikasi,tahap_verifikasi")
        .eq("nik", pengajuan.nik)
        .eq("status_verifikasi", "Terverifikasi")
        .maybeSingle();

    // Separate read-only cardinality check; never expose identity values.
    const { count: profileMatchCount, error: countError } = await supabase
        .from("warga_profiles")
        .select("id", { count: "exact", head: true })
        .eq("nik", pengajuan.nik);
    const queryError = wargaError ?? countError;
    const legalFieldsComplete = Boolean(wargaProfile && LEGAL_FIELDS.every((field) => String(wargaProfile[field] ?? "").trim() !== ""));

    console.info("[PROFILE FINALIZER DIAGNOSTIC]", {
        target_found: true,
        profile_found: Boolean(wargaProfile),
        profile_query_error: Boolean(queryError),
    });

    return NextResponse.json({
        pengajuan_found: true,
        profile_query_ok: !wargaError,
        profile_found: Boolean(wargaProfile),
        profile_match_count: countError ? null : profileMatchCount,
        profile_status_is_terverifikasi: wargaProfile?.status_verifikasi === "Terverifikasi",
        legal_fields_complete: legalFieldsComplete,
        query_error_code: queryError?.code ?? null,
        query_error_message: sanitizedErrorMessage(queryError?.message),
    });
}