import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

const ADMIN_SOURCE_TARGET = "d481e74e-d960-4c60-a195-5921198439ae";

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
    const { data: target, error: targetError } = await supabase
        .from("pengajuan_surat")
        .select("id,status,nomor_pengajuan,nik,document_locked,issued_at")
        .eq("id", ADMIN_SOURCE_TARGET)
        .maybeSingle();

    if (targetError) {
        return NextResponse.json({ ok: false, error: { code: targetError.code ?? "UNKNOWN", message: targetError.message ?? "Target audit query failed." } }, { status: 500 });
    }

    if (!target) {
        return NextResponse.json({ ok: true, target: { id: ADMIN_SOURCE_TARGET, found: false } });
    }

    const [{ data: stages, error: stagesError }, { data: profiles, error: profilesError }, { data: documents, error: documentsError }] = await Promise.all([
        supabase
            .from("verifikasi_pengajuan")
            .select("id,pengajuan_id,tahap,nama_tahap,role_petugas,status")
            .eq("pengajuan_id", ADMIN_SOURCE_TARGET)
            .order("tahap", { ascending: true }),
        supabase
            .from("warga_profiles")
            .select("id,nik,status_verifikasi,nama_lengkap,nomor_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,status_perkawinan,status_pekerjaan")
            .eq("nik", target.nik),
        supabase
            .from("dokumen_pengajuan")
            .select("id,pengajuan_id,nama_file,jenis,status,metadata,url_file")
            .eq("pengajuan_id", ADMIN_SOURCE_TARGET)
            .order("created_at", { ascending: false }),
    ]);

    const error = stagesError ?? profilesError ?? documentsError;
    if (error) {
        return NextResponse.json({ ok: false, error: { code: error.code ?? "UNKNOWN", message: error.message ?? "Detailed audit query failed." } }, { status: 500 });
    }

    const activeStage = (stages ?? []).find((stage) => stage.status === "Diproses") ?? (stages ?? []).find((stage) => stage.status === "Menunggu") ?? null;
    const profile = (profiles?.length === 1 ? profiles[0] : null) as Record<string, any> | null;
    const legalFields = ["nama_lengkap", "nik", "nomor_kk", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "alamat", "kelurahan", "kecamatan", "status_perkawinan", "status_pekerjaan"] as const;
    const legalFieldsComplete = Boolean(profile && legalFields.every((field) => String(profile[field] ?? "").trim() !== ""));
    const previousStagesApproved = [1, 2, 3, 4].every((number) => (stages ?? []).some((stage) => stage.tahap === number && stage.status === "Disetujui"));
    const documentStatus = (document: { status?: unknown }) => String(document.status ?? "").trim().toUpperCase();
    const draftDocuments = (documents ?? []).filter((document) => documentStatus(document).startsWith("DRAFT"));
    const finalDocuments = (documents ?? []).filter((document) => ["TERBIT", "FINAL", "SIGNED", "ISSUED"].includes(documentStatus(document)));
    const hasTerbitDocument = (documents ?? []).some((document) => documentStatus(document) === "TERBIT");
    const stagesReadyForFinalization = target.status !== "Selesai" && target.document_locked === false && !target.issued_at && activeStage?.tahap === 5 && activeStage.role_petugas === "lurah" && previousStagesApproved && !hasTerbitDocument && finalDocuments.length === 0;
    const profileReady = profiles?.length === 1 && profile?.nik === target.nik && profile?.status_verifikasi === "Terverifikasi" && legalFieldsComplete;
    const safeDocuments = (documents ?? []).map((document) => ({ ...document, url_file: undefined, url_file_present: Boolean(document.url_file) }));

    return NextResponse.json({
        ok: true,
        target: {
            id: target.id,
            found: true,
            status: target.status,
            nomor_pengajuan: target.nomor_pengajuan,
            nik_present: Boolean(target.nik),
            active_stage: activeStage,
            previous_stages: (stages ?? []).filter((stage) => stage.tahap < 5),
            document_locked: target.document_locked,
            issued_at: target.issued_at,
            has_terbit_document: hasTerbitDocument,
            draft_document_count: draftDocuments.length,
            final_document_count: finalDocuments.length,
            stages_ready_for_finalization: stagesReadyForFinalization,
            safe_for_integration_test: stagesReadyForFinalization && profileReady,
        },
        profile: {
            found: Boolean(profile),
            match_count: profiles?.length ?? 0,
            status: profile?.status_verifikasi ?? null,
            match: profiles?.length === 1 && profile?.nik === target.nik,
            legal_fields_complete: legalFieldsComplete,
            legal_fields: Object.fromEntries(legalFields.map((field) => [field, Boolean(profile && String(profile[field] ?? "").trim())])),
        },
        documents: safeDocuments,
    });

}