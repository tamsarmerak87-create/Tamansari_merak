import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isAdmin, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { ROLE_STAGE_STATUS, STAGE_WAITING_STATUS, VERIFICATION_STAGES, getActiveStage, isFinalSubmissionStatus, normalizeSubmissionStatus, normalizeWorkflowRole } from "@/services/verification-workflow";
import { createWargaNotification, type NotificationStatus } from "@/services/warga-notifikasi.service";
import { finalizeOfficialLetter } from "@/services/official-letter-finalization";
import { sendApplicationStatusEmailSafely, statusEmailInputFromSubmission } from "@/services/email.service";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

type Action = "proses_tahap" | "validasi_terbitkan" | "verifikasi" | "setujui" | "tolak" | "revisi";
type StageRow = { id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };
type ActionDecision = { status: "Disetujui" | "Ditolak"; submissionStatus: string; auditLabel: string; trackingLabel: string };

function notificationStatusFor(action: Action, stage: StageRow): NotificationStatus {
    if (action === "tolak" || action === "revisi") return "rejected";
    if (stage.tahap === 1) return "verified";
    if (stage.tahap === 5) return "completed";
    return "processing";
}

const STAGE_AUDIT_LABEL: Record<number, string> = {
    1: "STAFF",
    2: "LAPANGAN",
    3: "KASI",
    4: "SEKLUR",
    5: "LURAH",
};

function stageShortName(stage: StageRow) {
    return VERIFICATION_STAGES.find((item) => item.tahap === stage.tahap)?.nama_tahap.replace(/^Verifikasi\s+|^Persetujuan\s+/, "") ?? stage.nama_tahap;
}

function actionDecision(action: Action, stage: StageRow): ActionDecision {
    if (action === "tolak") return { status: "Ditolak", submissionStatus: "DITOLAK", auditLabel: "TOLAK", trackingLabel: "Ditolak" };
    if (action === "revisi") return { status: "Ditolak", submissionStatus: "REVISI", auditLabel: "KEMBALIKAN", trackingLabel: "Dikembalikan untuk revisi" };
    if (stage.tahap === 5) return { status: "Disetujui", submissionStatus: "SELESAI", auditLabel: "VALIDASI_TERBITKAN", trackingLabel: "Surat Terbit" };
    return { status: "Disetujui", submissionStatus: STAGE_WAITING_STATUS[stage.tahap + 1], auditLabel: auditActionLabel(action, stage), trackingLabel: "Diproses" };
}

function auditActionLabel(action: Action, stage: StageRow) {
    if (action === "tolak") return "TOLAK";
    if (action === "revisi") return "KEMBALIKAN";
    if (stage.tahap === 2) return "VERIFIKASI_LAPANGAN";
    if (stage.tahap === 3) return "SETUJUI";
    if (stage.tahap === 4) return "AJUKAN_KE_LURAH";
    if (stage.tahap === 5) return "VALIDASI_TERBITKAN";
    return "VERIFIKASI";
}

export async function PATCH(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return jsonError("Session admin tidak valid.", 401);
    if (requireAdmin(session.profile)) return jsonError("Akses khusus admin.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const body = await request.json().catch(() => null) as {
        id?: string;
        action?: Action;
        catatan_petugas?: string;
        alasan_penolakan?: string;
        hasil_verifikasi?: string;
        dokumentasi_url?: string;
        checklist?: Record<string, boolean>;
    } | null;

    if (!body?.id) return jsonError("ID pengajuan wajib diisi.");
    if (!body.action) return jsonError("Aksi pengajuan wajib diisi.");
    console.log("[ADMIN ACTION START]", { pengajuanId: body.id, action: body.action });

    const petugasId = session.profile.id;
    const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";
    const now = new Date().toISOString();

    if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);

    const adminHasFullAccess = isAdmin(session.profile);
    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (!adminHasFullAccess && !workflowRole) return jsonError("Role petugas tidak memiliki kewenangan workflow verifikasi.", 403);

    const { data: stages, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", body.id).order("tahap", { ascending: true });
    if (stageError) return jsonError(stageError.message, 500);
    const orderedStages = (stages ?? []) as StageRow[];
    const activeStage = getActiveStage(orderedStages);
    if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
    console.log("[ADMIN ACTIVE STAGE]", { pengajuanId: body.id, tahap: activeStage.tahap, status: activeStage.status });
    if (!adminHasFullAccess && activeStage.role_petugas !== workflowRole) return jsonError(`Tahap aktif hanya dapat diproses oleh ${activeStage.nama_tahap}.`, 403);
    if (!["Menunggu", "Diproses"].includes(activeStage.status)) return jsonError("Tahap aktif sudah tidak bisa diproses.", 409);

    const { data: pengajuanAktif, error: pengajuanError } = await supabase.from("pengajuan_surat").select("id,nik,status").eq("id", body.id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuanAktif) return jsonError("Pengajuan tidak ditemukan.", 404);
    if (isFinalSubmissionStatus(String(pengajuanAktif.status))) return jsonError("Pengajuan sudah final dan tidak bisa diproses ulang tanpa pembatalan/revisi resmi.", 409);
    const normalizedSubmissionStatus = STAGE_WAITING_STATUS[activeStage.tahap] ?? normalizeSubmissionStatus(String(pengajuanAktif.status));
    const requiredStatus = adminHasFullAccess ? STAGE_WAITING_STATUS[activeStage.tahap] : ROLE_STAGE_STATUS[workflowRole!];
    if (normalizedSubmissionStatus !== requiredStatus) return jsonError(`${adminHasFullAccess ? "Administrator" : roleLabelForError(workflowRole!)} hanya boleh memproses status ${requiredStatus}.`, 403);
    if (STAGE_WAITING_STATUS[activeStage.tahap] !== requiredStatus) return jsonError("Tahap workflow aktif tidak sesuai dengan status pengajuan.", 409);

    // The server is the source of truth for sequencing. Do not rely on the
    // aggregate submission status or on a stage/role supplied by the client.
    const previousStages = orderedStages.filter((stage) => stage.tahap < activeStage.tahap);
    if (previousStages.some((stage) => stage.status !== "Disetujui")) {
        return jsonError("Tahap sebelumnya harus disetujui terlebih dahulu.", 409);
    }
    if (activeStage.tahap === 5 && orderedStages.find((stage) => stage.tahap === 4)?.status !== "Disetujui") {
        return jsonError("Seklur harus disetujui sebelum Lurah dapat diproses.", 409);
    }

    const isReject = body.action === "tolak" || body.action === "revisi";
    const catatan = (isReject ? body.alasan_penolakan : body.catatan_petugas)?.trim();
    if (isReject && !catatan) return jsonError("Alasan penolakan wajib diisi.");
    if (!isReject && activeStage.tahap === 4 && body.action !== "proses_tahap") return jsonError("Tahap Seklur wajib diproses dengan aksi proses_tahap.", 400);
    if (!isReject && activeStage.tahap === 5 && body.action !== "validasi_terbitkan") return jsonError("Tahap Lurah wajib diproses dengan aksi validasi_terbitkan.", 400);
    if (!isReject && activeStage.tahap === 5) {
        const { data: lurahProfiles, error: lurahError } = await supabase.from("petugas")
            .select("id,username,nama_lengkap,nip,jabatan,role,is_active")
            .eq("role", "lurah")
            .eq("is_active", true)
            .limit(2);
        if (lurahError) return jsonError(lurahError.message, 500);
        if (lurahProfiles?.length !== 1) return jsonError("Data authoritative Lurah aktif harus tersedia tepat satu.", 422);
        return finalizeOfficialLetter(request, {
            id: body.id,
            actorProfile: session.profile,
            signerProfile: lurahProfiles[0],
            catatan,
        });
    }
    const decision = actionDecision(body.action, activeStage);

    console.log("[ADMIN ACTION UPDATE]", { pengajuanId: body.id, tahap: activeStage.tahap });
    const previousStageStatus = activeStage.status;
    const { error: verificationError } = await supabase.from("verifikasi_pengajuan").update({ status: decision.status, petugas_id: petugasId, acted_at: now, catatan: catatan ?? null }).eq("id", activeStage.id).in("status", ["Menunggu", "Diproses"]);
    if (verificationError) return jsonError(verificationError.message, 500);

    const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
    const status = decision.submissionStatus;
    const pengajuanUpdate: Record<string, string | number | null> = { status: isReject ? status : activeStage.tahap === 5 ? "Selesai" : "Diproses", updated_at: now, catatan_admin: catatan ?? null };
    if (!isReject && activeStage.tahap === 5) {
        pengajuanUpdate.selesai_at = now;
        pengajuanUpdate.selesai_by = petugasId;
    }
    if (!isReject && activeStage.tahap !== 5) {
        pengajuanUpdate.verified_at = now;
        pengajuanUpdate.verified_by = petugasId;
        pengajuanUpdate.diproses_at = now;
        pengajuanUpdate.diproses_by = petugasId;
    }

    const { data, error } = await supabase.from("pengajuan_surat").update(pengajuanUpdate).eq("id", body.id).select("*, layanan(*)").single();
    if (error) {
        await supabase.from("verifikasi_pengajuan").update({ status: previousStageStatus, petugas_id: null, acted_at: null, catatan: null }).eq("id", activeStage.id).eq("status", decision.status);
        return jsonError(error.message, 500);
    }

    if (!isReject && nextStage) {
        const { error: nextError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses" }).eq("id", nextStage.id).eq("status", "Menunggu");
        if (nextError) {
            await supabase.from("verifikasi_pengajuan").update({ status: previousStageStatus, petugas_id: null, acted_at: null, catatan: null }).eq("id", activeStage.id).eq("status", decision.status);
            return jsonError(nextError.message, 500);
        }
    }
    const trackingRows = isReject
        ? [{ pengajuan_id: body.id, status: activeStage.nama_tahap, keterangan: `${decision.trackingLabel} pada tahap ${stageShortName(activeStage)}. ${catatan}`, petugas: petugasName, created_at: now }]
        : activeStage.tahap === 5
            ? [{ pengajuan_id: body.id, status: "SELESAI", keterangan: "Surat divalidasi dan diterbitkan oleh Lurah.", petugas: petugasName, created_at: now }]
            : [
                { pengajuan_id: body.id, status: "Diproses", keterangan: nextStage ? `Pengajuan diteruskan ke ${stageShortName(nextStage)}.` : "Pengajuan diteruskan.", petugas: petugasName, created_at: now },
            ];
    const { error: trackingError } = await supabase.from("tracking_pengajuan").insert(trackingRows);
    if (trackingError) {
        await supabase.from("verifikasi_pengajuan").update({ status: previousStageStatus, petugas_id: null, acted_at: null, catatan: null }).eq("id", activeStage.id).eq("status", decision.status);
        if (nextStage && !isReject) await supabase.from("verifikasi_pengajuan").update({ status: "Menunggu" }).eq("id", nextStage.id).eq("status", "Diproses");
        return jsonError(trackingError.message, 500);
    }

    const auditPayload = {
        pengajuan_id: body.id,
        user_id: petugasId,
        nama_petugas: petugasName,
        role: adminHasFullAccess ? "admin" : workflowRole!,
        tahap: STAGE_AUDIT_LABEL[activeStage.tahap] ?? activeStage.nama_tahap,
        aksi: decision.auditLabel,
        status_sebelum: requiredStatus,
        status_sesudah: status,
        catatan: catatan ?? null,
    };
    const { error: auditError } = await supabase.from("audit_pengajuan").insert(auditPayload);
    if (auditError) {
        console.error("[ADMIN ACTION ERROR] audit_pengajuan insert", { pengajuanId: body.id, tahap: activeStage.tahap, message: auditError.message, code: auditError.code });
        await supabase.from("verifikasi_pengajuan").update({ status: previousStageStatus, petugas_id: null, acted_at: null, catatan: null }).eq("id", activeStage.id).eq("status", decision.status);
        if (nextStage && !isReject) await supabase.from("verifikasi_pengajuan").update({ status: "Menunggu" }).eq("id", nextStage.id).eq("status", "Diproses");
        await supabase.from("pengajuan_surat").update({ status: "Diproses", updated_at: now }).eq("id", body.id);
        return jsonError(auditError.message, 500);
    }

    await createWargaNotification({ pengajuanId: body.id, nik: String(pengajuanAktif.nik ?? ""), status: notificationStatusFor(body.action, activeStage), catatan }).catch((notificationError) => {
        console.error("WARGA NOTIFICATION INSERT ERROR", notificationError);
    });
    const emailStatus = notificationStatusFor(body.action, activeStage);
    await sendApplicationStatusEmailSafely(statusEmailInputFromSubmission(data as Record<string, unknown>, emailStatus, catatan, now));

    console.log("[ADMIN ACTION SUCCESS]", { pengajuanId: body.id, tahap: activeStage.tahap });
    return NextResponse.json({ ok: true, message: `${stageShortName(activeStage)} berhasil disetujui.`, data });
}

function roleLabelForError(role: string) {
    return VERIFICATION_STAGES.find((stage) => stage.role_petugas === role)?.nama_tahap ?? role;
}