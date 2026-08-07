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

    const submissionIds = (submissions ?? []).map((item) => item.id).filter(Boolean);
    const petugasIds = Array.from(new Set((submissions ?? []).map((item) => item.verified_by).filter(Boolean)));

    const [{ data: documents, error: documentsError }, { data: tracking, error: trackingError }, { data: petugas, error: petugasError }] = await Promise.all([
        submissionIds.length
            ? supabase
                .from("dokumen_pengajuan")
                .select("*")
                .in("pengajuan_id", submissionIds)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        submissionIds.length
            ? supabase
                .from("tracking_pengajuan")
                .select("*")
                .in("pengajuan_id", submissionIds)
                .order("created_at", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        petugasIds.length
            ? supabase
                .from("petugas")
                .select("id,username,nama_lengkap,nip,jabatan,role")
                .in("id", petugasIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (documentsError) return jsonError(documentsError.message, 500);
    if (trackingError) return jsonError(trackingError.message, 500);
    if (petugasError) return jsonError(petugasError.message, 500);

    const documentsBySubmission = new Map<string, unknown[]>();
    for (const doc of documents ?? []) {
        const pengajuanId = String(doc.pengajuan_id ?? "");
        if (!documentsBySubmission.has(pengajuanId)) documentsBySubmission.set(pengajuanId, []);
        documentsBySubmission.get(pengajuanId)?.push(doc);
    }

    const trackingBySubmission = new Map<string, unknown[]>();
    for (const item of tracking ?? []) {
        const pengajuanId = String(item.pengajuan_id ?? "");
        if (!trackingBySubmission.has(pengajuanId)) trackingBySubmission.set(pengajuanId, []);
        trackingBySubmission.get(pengajuanId)?.push(item);
    }

    const petugasById = new Map((petugas ?? []).map((item) => [item.id, item]));
    const enrichedSubmissions = (submissions ?? []).map((item) => ({
        ...item,
        dokumen_pengajuan: documentsBySubmission.get(String(item.id)) ?? [],
        tracking_pengajuan: trackingBySubmission.get(String(item.id)) ?? [],
        petugas: item.verified_by ? petugasById.get(item.verified_by) ?? null : null,
    }));

    return NextResponse.json({
        ok: true,
        data: {
            submissions: enrichedSubmissions,
            services: services ?? [],
            pendingWarga: pendingWarga ?? [],
            wargaProfiles: wargaProfiles ?? [],
        },
    });
}
