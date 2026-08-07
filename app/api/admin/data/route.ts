import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const [{ data: submissions, error: submissionsError }, { data: services, error: servicesError }, { data: pendingWarga, error: pendingWargaError }, { data: wargaProfiles, error: wargaProfilesError }] =
        await Promise.all([
            supabase
                .from("pengajuan_surat")
                .select("*, layanan(*)")
                .order("created_at", { ascending: false }),
            supabase
                .from("layanan")
                .select(`
          id,
          nama,
          deskripsi,
          aktif,
          persyaratan,
          alur,
          dasar_hukum,
          output,
          kanal,
          created_at
        `)
                .order("nama", { ascending: true }),
            supabase
                .from("warga_profiles")
                .select("id,nama_lengkap,nik,email,created_at,status_verifikasi,alasan_penolakan")
                .eq("status_verifikasi", "Belum Terverifikasi")
                .order("created_at", { ascending: true }),
            supabase
                .from("warga_profiles")
                .select("id,nama_lengkap,nik,email,created_at,status_verifikasi,alasan_penolakan")
                .order("created_at", { ascending: false }),
        ]);

    const firstError = submissionsError ?? servicesError ?? pendingWargaError ?? wargaProfilesError;
    if (firstError) {
        console.error("ADMIN DATA QUERY ERROR");
        console.dir(firstError, { depth: null });
        return jsonError(firstError.message, 500);
    }

    return NextResponse.json({
        ok: true,
        data: {
            submissions: submissions ?? [],
            services: services ?? [],
            pendingWarga: pendingWarga ?? [],
            wargaProfiles: wargaProfiles ?? [],
        },
    });
}
