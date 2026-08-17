import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { ROLE_STAGE_STATUS, STAGE_WAITING_STATUS, VERIFICATION_STAGES, getActiveStage, isFinalSubmissionStatus, normalizeSubmissionStatus, normalizeWorkflowRole } from "@/services/verification-workflow";
import { createWargaNotification } from "@/services/warga-notifikasi.service";

type RouteContext = { params: Promise<{ id: string }> };
type SupabaseError = { message?: string; details?: string; hint?: string; code?: string };
type VerificationAction = "simpan" | "revisi" | "tolak" | "approve" | "selesai";
type VerificationBody = { action?: VerificationAction | null; catatan?: string; pemeriksaan?: unknown };
type StageRow = { id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };
type DebugContext = { pengajuanId: string; petugasId?: string; role?: string | null; action?: string; currentStatus?: string | null; currentStage?: number | string | null };

const STAGE_AUDIT_LABEL: Record<number, string> = { 1: "STAFF", 2: "LAPANGAN", 3: "KASI", 4: "SEKLUR", 5: "LURAH" };

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function publicSaveError() {
    return jsonError("Data belum dapat disimpan. Silakan coba lagi.", 500);
}

function logConfigError(operation: string, message: string, context?: Record<string, unknown>) {
    console.error(`[VERIFIKASI PETUGAS] Konfigurasi gagal: ${operation}`, {
        message,
        details: context,
        hint: "Pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tersedia untuk route server.",
        code: "CONFIG_ERROR",
    });
}

function logSupabaseOperation(context: DebugContext, operation: string, table: string, error?: SupabaseError | null) {
    console.error(error ? "[SUPABASE VERIFIKASI ERROR]" : "[VERIFIKASI SAVE DEBUG]", {
        pengajuanId: context.pengajuanId,
        petugasId: context.petugasId,
        role: context.role,
        action: context.action,
        currentStatus: context.currentStatus,
        currentStage: context.currentStage,
        operation,
        table,
        success: !error,
        code: error?.code ?? null,
        message: error?.message ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
    });
}

function logSupabaseNoRows(context: DebugContext, operation: string, table: string, details: Record<string, unknown>) {
    logSupabaseOperation(context, operation, table, {
        message: "Operasi tidak mengubah/mengembalikan baris apa pun.",
        details: JSON.stringify(details),
        hint: "Periksa filter id/status, RLS policy, trigger, atau data workflow yang tidak sinkron.",
        code: "NO_ROWS",
    });
}

function logDebug(event: string, context: Record<string, unknown>) {
    console.log("[VERIFIKASI SAVE DEBUG]", { event, ...context });
}

function isMissingColumn(error: SupabaseError, column: string) {
    return error.code === "42703" && String(error.message ?? "").includes(column);
}

async function insertAuditPengajuan(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, payload: Record<string, unknown>, context: DebugContext) {
    const { error } = await supabase.from("audit_pengajuan").insert(payload);
    if (!error) return null;
    logSupabaseOperation(context, "insert audit_pengajuan", "audit_pengajuan", error);
    if (!isMissingColumn(error, "user_id")) return error;

    const { user_id: _userId, ...payloadTanpaUserId } = payload;
    const retry = await supabase.from("audit_pengajuan").insert(payloadTanpaUserId);
    if (retry.error) logSupabaseOperation(context, "insert audit_pengajuan tanpa user_id", "audit_pengajuan", retry.error);
    return retry.error ?? null;
}

function workflowStatusMatches(actualStatus: string, requiredStatus: string, activeStage: StageRow) {
    if (actualStatus === requiredStatus) return true;
    return activeStage.tahap === 1 && ["MENUNGGU_STAFF", "MENUNGGU_VERIFIKASI"].includes(actualStatus);
}

function stageShortName(stage: StageRow) {
    return VERIFICATION_STAGES.find((item) => item.tahap === stage.tahap)?.nama_tahap.replace(/^Verifikasi\s+|^Persetujuan\s+/, "") ?? stage.nama_tahap.replace(/^Verifikasi\s+|^Persetujuan\s+/, "");
}

export async function POST(request: NextRequest, context: RouteContext) {
    let pengajuanId = "";

    try {
        const params = await context.params;
        pengajuanId = params.id;
        if (!pengajuanId) return jsonError("Pengajuan tidak ditemukan.", 404);

        const session = await getAdminSession(request, { cookie: "petugas" });
        if (session.error || !session.profile) return jsonError("Sesi petugas tidak valid.", 401);
        if (!isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
        if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);

        const workflowRole = normalizeWorkflowRole(session.profile.role);
        if (!workflowRole) return jsonError("Role petugas tidak memiliki kewenangan workflow verifikasi.", 403);

        const supabase = createSupabaseAdminClient();
        if (!supabase) {
            logConfigError("create supabase admin client", "Supabase service role belum dikonfigurasi.", { pengajuanId, petugasId: session.profile.id });
            return publicSaveError();
        }

        const body = await request.json().catch(() => null) as VerificationBody | null;
        if (!body || typeof body !== "object") return jsonError("Payload verifikasi wajib berupa JSON.", 400);
        const action = body?.action ?? "approve";
        if (!["simpan", "revisi", "tolak", "approve", "selesai"].includes(action)) return jsonError("Aksi verifikasi tidak valid.", 400);
        if ((action === "simpan" || action === "approve" || action === "selesai") && body.pemeriksaan == null) return jsonError("Checklist pemeriksaan wajib dikirim.", 400);
        const now = new Date().toISOString();
        const catatan = body?.catatan?.trim() || (action === "simpan" ? "Pemeriksaan data dan dokumen disimpan." : "Dokumen telah diverifikasi dan lengkap");
        const petugasId = session.profile.id;
        const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";

        logDebug("start", { pengajuanId, petugasId, role: workflowRole, action, payloadFields: { action: body.action ?? null, catatan: body.catatan ? "present" : "empty", checklist: (body.pemeriksaan as { checklist?: unknown } | null)?.checklist ? "present" : "not-provided", pengajuanId, stage: null, role: workflowRole } });

        const { data: pengajuan, error: pengajuanError } = await supabase
            .from("pengajuan_surat")
            .select("id,nik,status,workflow_status")
            .eq("id", pengajuanId)
            .maybeSingle();
        if (pengajuanError) {
            logSupabaseOperation({ pengajuanId, petugasId, role: workflowRole, action }, "select pengajuan_surat", "pengajuan_surat", pengajuanError);
            throw pengajuanError;
        }
        logSupabaseOperation({ pengajuanId, petugasId, role: workflowRole, action, currentStatus: pengajuan?.workflow_status ?? pengajuan?.status ?? null }, "select pengajuan_surat", "pengajuan_surat");
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (isFinalSubmissionStatus(String(pengajuan.status))) return jsonError("Pengajuan sudah final dan tidak bisa diproses ulang.", 409);

        const { data: stages, error: stageError } = await supabase
            .from("verifikasi_pengajuan")
            .select("id,tahap,nama_tahap,role_petugas,status")
            .eq("pengajuan_id", pengajuanId)
            .order("tahap", { ascending: true });
        if (stageError) {
            logSupabaseOperation({ pengajuanId, petugasId, role: workflowRole, action, currentStatus: pengajuan.workflow_status ?? pengajuan.status }, "select verifikasi_pengajuan", "verifikasi_pengajuan", stageError);
            throw stageError;
        }
        logSupabaseOperation({ pengajuanId, petugasId, role: workflowRole, action, currentStatus: pengajuan.workflow_status ?? pengajuan.status }, "select verifikasi_pengajuan", "verifikasi_pengajuan");

        const orderedStages = (stages ?? []) as StageRow[];
        const activeStage = getActiveStage(orderedStages);
        if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
        if (activeStage.role_petugas !== workflowRole) return jsonError(`Tahap aktif hanya dapat diproses oleh ${activeStage.nama_tahap}.`, 403);
        if (!includesStageStatus(activeStage.status)) return jsonError("Tahap aktif sudah tidak bisa diproses.", 409);

        const normalizedSubmissionStatus = normalizeSubmissionStatus(String(pengajuan.workflow_status ?? pengajuan.status));
        const requiredStatus = ROLE_STAGE_STATUS[workflowRole];
        if (!workflowStatusMatches(String(normalizedSubmissionStatus), requiredStatus, activeStage)) return jsonError(`${activeStage.nama_tahap} hanya boleh memproses status ${requiredStatus}.`, 403);
        if (STAGE_WAITING_STATUS[activeStage.tahap] !== requiredStatus) return jsonError("Tahap workflow aktif tidak sesuai dengan status pengajuan.", 409);

        const hasilVerifikasi = JSON.stringify({
            status: action === "simpan" ? "Pemeriksaan tersimpan." : action === "revisi" || action === "tolak" ? "Data atau dokumen perlu diperbaiki." : "Data dan dokumen dinyatakan lengkap.",
            pemeriksaan: body?.pemeriksaan ?? { check_status: "checked", check_notes: catatan, checked_at: now, checked_by: petugasId },
        });
        const debugContext = { pengajuanId, petugasId, role: workflowRole, action, currentStatus: normalizedSubmissionStatus, currentStage: activeStage.tahap };

        if (action === "simpan") {
            const { data: savedStage, error: saveStageError } = await supabase
                .from("verifikasi_pengajuan")
                .update({
                    petugas_id: petugasId,
                    nama_petugas: petugasName,
                    jabatan: activeStage.nama_tahap,
                    catatan,
                    hasil_verifikasi: hasilVerifikasi,
                    updated_at: now,
                })
                .eq("id", activeStage.id)
                .in("status", ["Menunggu", "Diproses"])
                .select("id,status")
                .maybeSingle();
            if (saveStageError) {
                logSupabaseOperation(debugContext, "update verifikasi_pengajuan simpan pemeriksaan", "verifikasi_pengajuan", saveStageError);
                throw saveStageError;
            }
            logSupabaseOperation(debugContext, "update verifikasi_pengajuan simpan pemeriksaan", "verifikasi_pengajuan");
            if (!savedStage) {
                logSupabaseNoRows(debugContext, "update verifikasi_pengajuan simpan pemeriksaan", "verifikasi_pengajuan", { stageId: activeStage.id, allowedStatus: ["Menunggu", "Diproses"] });
                return jsonError("Pemeriksaan tidak dapat disimpan karena tahap sudah berubah. Muat ulang data pengajuan.", 409);
            }
            logDebug("saved-inspection", { pengajuanId, stage: activeStage.tahap, status: activeStage.status });
            return NextResponse.json({ ok: true, data: { id: pengajuanId, workflow_status: normalizedSubmissionStatus, stage_status: savedStage.status } });
        }

        const isReject = action === "revisi" || action === "tolak";
        if (isReject && !body?.catatan?.trim()) return jsonError("Catatan/alasan penolakan wajib diisi.", 400);
        if (activeStage.tahap === 5 && action === "revisi") return jsonError("Tahap Lurah hanya dapat menyelesaikan atau menolak pengajuan.", 400);

        const nextStage = isReject ? null : orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
        const nextWorkflowStatus = isReject ? (action === "revisi" ? "REVISI" : "DITOLAK") : nextStage ? STAGE_WAITING_STATUS[nextStage.tahap] : "SELESAI";
        const stageStatus = isReject ? "Ditolak" : "Disetujui";

        const { data: updatedStage, error: updateStageError } = await supabase
            .from("verifikasi_pengajuan")
            .update({
                status: stageStatus,
                petugas_id: petugasId,
                nama_petugas: petugasName,
                jabatan: activeStage.nama_tahap,
                catatan,
                hasil_verifikasi: hasilVerifikasi,
                approved_at: isReject ? null : now,
                updated_at: now,
            })
            .eq("id", activeStage.id)
            .in("status", ["Menunggu", "Diproses"])
            .select("id")
            .maybeSingle();
        if (updateStageError) {
            logSupabaseOperation(debugContext, "update verifikasi_pengajuan tahap aktif", "verifikasi_pengajuan", updateStageError);
            throw updateStageError;
        }
        logSupabaseOperation(debugContext, "update verifikasi_pengajuan tahap aktif", "verifikasi_pengajuan");
        if (!updatedStage) {
            logSupabaseNoRows(debugContext, "update verifikasi_pengajuan tahap aktif", "verifikasi_pengajuan", { stageId: activeStage.id, allowedStatus: ["Menunggu", "Diproses"] });
            return jsonError("Tahap aktif sudah diproses. Muat ulang data pengajuan.", 409);
        }

        if (nextStage) {
            const { error: nextStageError } = await supabase
                .from("verifikasi_pengajuan")
                .update({ status: "Diproses", updated_at: now })
                .eq("id", nextStage.id)
                .eq("status", "Menunggu");
            if (nextStageError) {
                logSupabaseOperation(debugContext, "update verifikasi_pengajuan tahap berikutnya", "verifikasi_pengajuan", nextStageError);
                throw nextStageError;
            }
            logSupabaseOperation(debugContext, "update verifikasi_pengajuan tahap berikutnya", "verifikasi_pengajuan");
        }

        const pengajuanUpdate = {
            workflow_status: nextWorkflowStatus,
            status: isReject ? nextWorkflowStatus : nextStage ? "Diproses" : "Selesai",
            updated_at: now,
        };
        const { data: updatedPengajuan, error: updatePengajuanError } = await supabase
            .from("pengajuan_surat")
            .update(pengajuanUpdate)
            .eq("id", pengajuanId)
            .select("id,status,workflow_status")
            .maybeSingle();
        if (updatePengajuanError) {
            logSupabaseOperation(debugContext, "update pengajuan_surat", "pengajuan_surat", updatePengajuanError);
            throw updatePengajuanError;
        }
        logSupabaseOperation(debugContext, "update pengajuan_surat", "pengajuan_surat");
        if (!updatedPengajuan) {
            logSupabaseNoRows(debugContext, "update pengajuan_surat", "pengajuan_surat", { nextWorkflowStatus });
            throw new Error("Update pengajuan_surat tidak mengembalikan data.");
        }

        const trackingRows = [{
            pengajuan_id: pengajuanId,
            status: isReject ? (action === "revisi" ? "Dikembalikan untuk revisi" : "Ditolak") : nextStage ? "Diproses" : "SELESAI",
            keterangan: isReject ? `${action === "revisi" ? "Pengajuan dikembalikan" : "Pengajuan ditolak"} pada tahap ${stageShortName(activeStage)}. ${catatan}` : nextStage ? `Pengajuan diteruskan ke ${stageShortName(nextStage)}.` : "Pengajuan selesai diverifikasi.",
            petugas: petugasName,
            created_at: now,
        }];
        const { error: trackingError } = await supabase.from("tracking_pengajuan").insert(trackingRows);
        if (trackingError) {
            logSupabaseOperation(debugContext, "insert tracking_pengajuan", "tracking_pengajuan", trackingError);
            throw trackingError;
        }
        logSupabaseOperation(debugContext, "insert tracking_pengajuan", "tracking_pengajuan");

        const auditPayload = {
            pengajuan_id: pengajuanId,
            user_id: petugasId,
            nama_petugas: petugasName,
            role: workflowRole,
            tahap: STAGE_AUDIT_LABEL[activeStage.tahap] ?? activeStage.nama_tahap,
            aksi: isReject ? (action === "revisi" ? "KEMBALIKAN" : "TOLAK") : "VERIFIKASI",
            action: isReject ? (action === "revisi" ? "KEMBALIKAN" : "TOLAK") : "VERIFIKASI",
            status: isReject ? nextWorkflowStatus : "Diproses",
            status_sebelum: requiredStatus,
            status_sesudah: nextWorkflowStatus,
            catatan,
            metadata: { tahap: activeStage.tahap, next_tahap: nextStage?.tahap ?? null, role: workflowRole, petugas_id: petugasId, pemeriksaan: body?.pemeriksaan ?? null },
        };
        const auditError = await insertAuditPengajuan(supabase, auditPayload, debugContext);
        if (auditError) {
            logSupabaseOperation(debugContext, "insert audit_pengajuan", "audit_pengajuan", auditError);
            throw auditError;
        }
        logSupabaseOperation(debugContext, "insert audit_pengajuan", "audit_pengajuan");

        await createWargaNotification({ pengajuanId, nik: String(pengajuan.nik ?? ""), status: isReject ? "rejected" : nextStage ? "verified" : "completed", catatan }).catch((notificationError) => {
            console.error("WARGA NOTIFICATION INSERT ERROR", notificationError);
        });

        logDebug("success", { pengajuanId, stage: activeStage.tahap, action, nextStatus: nextWorkflowStatus });
        return NextResponse.json({ ok: true, data: updatedPengajuan });
    } catch (error) {
        const supabaseError = error as SupabaseError;
        console.error("[VERIFIKASI ERROR ASLI]", {
            pengajuanId,
            code: supabaseError?.code ?? null,
            message: supabaseError?.message ?? null,
            details: supabaseError?.details ?? null,
            hint: supabaseError?.hint ?? null,
            error,
        });
        return publicSaveError();
    }
}

function includesStageStatus(status: string) {
    return ["Menunggu", "Diproses"].includes(status);
}