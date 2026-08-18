import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";

type ValidatedWarga = { warga: WargaProfile | null } | { error: string; status: number };
type RouteContext = { params: Promise<{ id: string }> };

const WARGA_PROFILE_SAFE_COLUMNS = "id,nama_lengkap,nik,nomor_kk,email,nomor_hp,nomor_whatsapp,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,foto_url,role,status_verifikasi,alasan_penolakan,created_at,updated_at";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACKING_COLUMNS = "id,pengajuan_id,status,keterangan,petugas,created_at";
const DOKUMEN_COLUMNS = "id,pengajuan_id,nama_file,jenis,url_file,created_at";
const VERIFIKASI_COLUMNS = "id,pengajuan_id,tahap,nama_tahap,role_petugas,status,petugas_id,catatan,created_at,acted_at";

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

function normalizedStatus(value: unknown) {
    return String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function eventTime(row: Record<string, any> | null | undefined) {
    const value = row?.acted_at ?? row?.created_at;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
}

async function hydrateDetail(supabase: ReturnType<typeof createSupabaseAdminClient>, pengajuan: Record<string, any>) {
    const [layananResult, trackingResult, dokumenResult, verifikasiResult] = await Promise.all([
        pengajuan.layanan_id ? supabase.from("layanan").select("id,nama,deskripsi").eq("id", pengajuan.layanan_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from("tracking_pengajuan").select(TRACKING_COLUMNS).eq("pengajuan_id", pengajuan.id).order("created_at", { ascending: true }),
        supabase.from("dokumen_pengajuan").select(DOKUMEN_COLUMNS).eq("pengajuan_id", pengajuan.id).order("created_at", { ascending: false }),
        supabase.from("verifikasi_pengajuan").select(VERIFIKASI_COLUMNS).eq("pengajuan_id", pengajuan.id).order("tahap", { ascending: true }),
    ]);

    if (layananResult.error) logSupabaseError("DETAIL LAYANAN QUERY ERROR", layananResult.error);
    if (trackingResult.error) logSupabaseError("DETAIL TRACKING QUERY ERROR", trackingResult.error);
    if (dokumenResult.error) logSupabaseError("DETAIL DOKUMEN QUERY ERROR", dokumenResult.error);
    if (verifikasiResult.error) logSupabaseError("DETAIL VERIFIKASI QUERY ERROR", verifikasiResult.error);

    const verificationStages = verifikasiResult.data ?? [];
    const trackingRows = trackingResult.data ?? [];
    const primaryStatus = normalizedStatus(pengajuan.status);
    const latestReturnedStage = [...verificationStages]
        .filter((stage) => normalizedStatus(stage.status) === "DITOLAK")
        .sort((a, b) => eventTime(b) - eventTime(a))[0] ?? null;
    const latestRevisionTracking = [...trackingRows]
        .filter((track) => /revisi|dikembalikan/i.test(`${track.status ?? ""} ${track.keterangan ?? ""}`))
        .sort((a, b) => eventTime(b) - eventTime(a))[0] ?? null;
    const latestRejectionTracking = [...trackingRows]
        .filter((track) => /ditolak|penolakan/i.test(`${track.status ?? ""} ${track.keterangan ?? ""}`) && !/revisi|dikembalikan/i.test(`${track.status ?? ""} ${track.keterangan ?? ""}`))
        .sort((a, b) => eventTime(b) - eventTime(a))[0] ?? null;
    const candidateActiveStage = verificationStages.find((stage) => normalizedStatus(stage.status) === "DIPROSES")
        ?? verificationStages.find((stage) => normalizedStatus(stage.status) === "MENUNGGU")
        ?? null;
    const revisionTime = Math.max(eventTime(latestReturnedStage), eventTime(latestRevisionTracking));
    const activeTime = eventTime(candidateActiveStage);
    const terminalStatus = ["SELESAI", "DITOLAK", "DIBATALKAN"].includes(primaryStatus) ? primaryStatus : undefined;
    const resubmittedAfterRevision = revisionTime > 0 && activeTime > revisionTime;
    const revisionActive = !terminalStatus && revisionTime > 0 && !resubmittedAfterRevision;
    const rejectionActive = !terminalStatus && !revisionActive && eventTime(latestRejectionTracking) >= activeTime && eventTime(latestRejectionTracking) > 0;
    // Menunggu is a stage-level state; an active submission remains in the app's Diproses status.
    const resumedWorkflowStatus = candidateActiveStage ? "DIPROSES" : primaryStatus;
    const effectiveStatus = terminalStatus
        ?? (revisionActive ? "REVISI" : rejectionActive ? "DITOLAK" : resubmittedAfterRevision ? resumedWorkflowStatus : primaryStatus);
    const workflowStopped = ["REVISI", "DITOLAK", "SELESAI", "DIBATALKAN"].includes(effectiveStatus);
    const activeStage = workflowStopped ? null : candidateActiveStage;
    const returnedStage = revisionActive ? latestReturnedStage : null;

    return {
        ...pengajuan,
        status: effectiveStatus || pengajuan.status,
        active_stage: activeStage,
        returned_to_role: returnedStage?.role_petugas ?? null,
        revision_note: returnedStage?.catatan ?? latestRevisionTracking?.keterangan ?? pengajuan.catatan ?? null,
        layanan: layananResult.data ?? { nama: pengajuan.jenis_surat ?? "Layanan tidak tersedia" },
        tracking_pengajuan: trackingRows,
        dokumen_pengajuan: dokumenResult.data ?? [],
        verifikasi_pengajuan: verificationStages,
    };
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

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        console.log("DETAIL PENGAJUAN ID", {
            id,
            valid: Boolean(id),
        });

        if (!id) {
            console.error("DETAIL PENGAJUAN ID MISSING");
            return jsonError("ID pengajuan tidak ditemukan.", 400);
        }

        if (!UUID_REGEX.test(id)) {
            console.error("DETAIL PENGAJUAN INVALID UUID", { id });
            return jsonError("ID pengajuan tidak valid.", 400);
        }

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
            console.error("DETAIL PENGAJUAN QUERY ERROR", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                id,
            });
            throw error;
        }

        console.log("DETAIL PENGAJUAN FOUND:", Boolean(pengajuan));
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (pengajuan.nik !== warga.nik) return jsonError("Pengajuan bukan milik akun ini.", 403);

        return NextResponse.json({
            ok: true,
            data: await hydrateDetail(supabase, pengajuan),
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