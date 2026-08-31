import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { DOCUMENT_UNAVAILABLE_MESSAGE, logSubmissionStorageError, normalizeSubmissionObjectPath, SUBMISSION_DOCUMENT_BUCKET } from "@/services/submission-storage";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return jsonError("Session admin tidak valid.", 401);
    if (requireAdmin(session.profile)) return jsonError("Akses khusus admin.", 403);

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
                .select("id,nama_lengkap,nik,email,nomor_hp,nomor_whatsapp,nomor_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,alamat,rt,rw,kelurahan,kecamatan,role,created_at,status_verifikasi,alasan_penolakan")
                // The admin verification queue is driven by the account status,
                // not by the separate letter-submission workflow stages.
                .eq("status_verifikasi", "Belum Terverifikasi")
                .order("created_at", { ascending: true }),
            supabase
                .from("warga_profiles")
                .select("id,nama_lengkap,nik,email,nomor_hp,nomor_whatsapp,nomor_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,alamat,rt,rw,kelurahan,kecamatan,role,created_at,status_verifikasi,alasan_penolakan")
                .order("created_at", { ascending: false }),
        ]);

    const firstError = submissionsError ?? servicesError ?? pendingWargaError ?? wargaProfilesError;
    if (firstError) {
        console.error("ADMIN DATA QUERY ERROR");
        console.dir(firstError, { depth: null });
        return jsonError(firstError.message, 500);
    }

    const submissionIds = (submissions ?? []).map((item) => item.id).filter(Boolean);

    const [{ data: documents, error: documentsError }, { data: tracking, error: trackingError }, { data: verification, error: verificationError }] = await Promise.all([
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
        submissionIds.length
            ? supabase
                .from("verifikasi_pengajuan")
                .select("*")
                .in("pengajuan_id", submissionIds)
                .order("tahap", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (documentsError) return jsonError(documentsError.message, 500);
    if (trackingError) return jsonError(trackingError.message, 500);
    if (verificationError) return jsonError(verificationError.message, 500);

    const petugasIds = Array.from(new Set([
        ...(submissions ?? []).map((item) => item.verified_by).filter(Boolean),
        ...(verification ?? []).map((item) => item.petugas_id).filter(Boolean),
    ]));
    const { data: petugas, error: petugasError } = petugasIds.length
        ? await supabase.from("petugas").select("id,username,nama_lengkap,nip,jabatan,role").in("id", petugasIds)
        : { data: [], error: null };
    if (petugasError) return jsonError(petugasError.message, 500);

    const signedDocuments = await Promise.all((documents ?? []).map(async (doc) => {
        const path = normalizeSubmissionObjectPath(doc.url_file);
        if (!path) return { ...doc, file_url: "", storage_error: DOCUMENT_UNAVAILABLE_MESSAGE };
        const { data, error } = await supabase.storage.from(SUBMISSION_DOCUMENT_BUCKET).createSignedUrl(path, 60 * 10);
        if (error) { logSubmissionStorageError("admin_view", error); return { ...doc, file_url: "", storage_error: DOCUMENT_UNAVAILABLE_MESSAGE }; }
        return { ...doc, file_url: data.signedUrl, signed_url: data.signedUrl };
    }));
    const documentsBySubmission = new Map<string, unknown[]>();
    for (const doc of signedDocuments) {
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

    const verificationBySubmission = new Map<string, Record<string, unknown>[]>();
    for (const item of verification ?? []) {
        const pengajuanId = String(item.pengajuan_id ?? "");
        if (!verificationBySubmission.has(pengajuanId)) verificationBySubmission.set(pengajuanId, []);
        verificationBySubmission.get(pengajuanId)?.push(item);
    }

    const petugasById = new Map((petugas ?? []).map((item) => [item.id, item]));
    const enrichedSubmissions = (submissions ?? []).map((item) => ({
        ...item,
        dokumen_pengajuan: documentsBySubmission.get(String(item.id)) ?? [],
        tracking_pengajuan: trackingBySubmission.get(String(item.id)) ?? [],
        verifikasi_pengajuan: (verificationBySubmission.get(String(item.id)) ?? []).map((stage) => ({
            ...stage,
            petugas: stage.petugas_id ? petugasById.get(stage.petugas_id) ?? null : null,
        })),
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
