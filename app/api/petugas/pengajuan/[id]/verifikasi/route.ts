import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { ROLE_STAGE_STATUS, STAGE_WAITING_STATUS, VERIFICATION_STAGES, getActiveStage, isFinalSubmissionStatus, normalizeSubmissionStatus, normalizeWorkflowRole } from "@/services/verification-workflow";

type RouteContext = { params: Promise<{ id: string }> };
type SupabaseError = { message?: string; details?: string; hint?: string; code?: string };
type VerificationBody = { catatan?: string; pemeriksaan?: unknown };
type StageRow = { id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };

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

function logSupabaseError(operation: string, error: SupabaseError | null) {
    if (!error) return;
    console.error(`[VERIFIKASI PETUGAS] Supabase gagal: ${operation}`, {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
    });
}

function logSupabaseNoRows(operation: string, context: Record<string, unknown>) {
    console.error(`[VERIFIKASI PETUGAS] Supabase gagal: ${operation}`, {
        message: "Operasi tidak mengubah/mengembalikan baris apa pun.",
        details: context,
        hint: "Periksa filter id/status, RLS policy, trigger, atau data workflow yang tidak sinkron.",
        code: "NO_ROWS",
    });
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
        if (workflowRole !== "staff_pelayanan") {
            // Endpoint ini dipakai tombol Verifikasi tahap 1 di portal petugas.
            return jsonError("Tombol Verifikasi hanya dapat diproses oleh Staff Pelayanan.", 403);
        }

        const supabase = createSupabaseAdminClient();
        if (!supabase) {
            logConfigError("create supabase admin client", "Supabase service role belum dikonfigurasi.", { pengajuanId, petugasId: session.profile.id });
            return publicSaveError();
        }

        const body = await request.json().catch(() => null) as VerificationBody | null;
        const now = new Date().toISOString();
        const catatan = body?.catatan?.trim() || "Dokumen telah diverifikasi dan lengkap";
        const petugasId = session.profile.id;
        const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";

        console.log("[VERIFIKASI PETUGAS] START", { pengajuanId, petugasId, role: workflowRole });

        const { data: pengajuan, error: pengajuanError } = await supabase
            .from("pengajuan_surat")
            .select("id,status,workflow_status")
            .eq("id", pengajuanId)
            .maybeSingle();
        if (pengajuanError) {
            logSupabaseError("select pengajuan_surat", pengajuanError);
            throw pengajuanError;
        }
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (isFinalSubmissionStatus(String(pengajuan.status))) return jsonError("Pengajuan sudah final dan tidak bisa diproses ulang.", 409);

        const { data: stages, error: stageError } = await supabase
            .from("verifikasi_pengajuan")
            .select("id,tahap,nama_tahap,role_petugas,status")
            .eq("pengajuan_id", pengajuanId)
            .order("tahap", { ascending: true });
        if (stageError) {
            logSupabaseError("select verifikasi_pengajuan", stageError);
            throw stageError;
        }

        const orderedStages = (stages ?? []) as StageRow[];
        const activeStage = getActiveStage(orderedStages);
        if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
        if (activeStage.role_petugas !== workflowRole) return jsonError(`Tahap aktif hanya dapat diproses oleh ${activeStage.nama_tahap}.`, 403);
        if (!includesStageStatus(activeStage.status)) return jsonError("Tahap aktif sudah tidak bisa diproses.", 409);

        const normalizedSubmissionStatus = normalizeSubmissionStatus(String(pengajuan.workflow_status ?? pengajuan.status));
        const requiredStatus = ROLE_STAGE_STATUS[workflowRole];
        if (!workflowStatusMatches(String(normalizedSubmissionStatus), requiredStatus, activeStage)) return jsonError(`${activeStage.nama_tahap} hanya boleh memproses status ${requiredStatus}.`, 403);
        if (STAGE_WAITING_STATUS[activeStage.tahap] !== requiredStatus) return jsonError("Tahap workflow aktif tidak sesuai dengan status pengajuan.", 409);

        const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
        const nextWorkflowStatus = nextStage ? STAGE_WAITING_STATUS[nextStage.tahap] : "SELESAI";
        const hasilVerifikasi = JSON.stringify({
            status: "Data dan dokumen dinyatakan lengkap.",
            pemeriksaan: body?.pemeriksaan ?? { check_status: "checked", check_notes: catatan, checked_at: now, checked_by: petugasId },
        });

        const { data: updatedStage, error: updateStageError } = await supabase
            .from("verifikasi_pengajuan")
            .update({
                status: "Disetujui",
                petugas_id: petugasId,
                user_id: petugasId,
                nama_petugas: petugasName,
                jabatan: activeStage.nama_tahap,
                catatan,
                hasil_verifikasi: hasilVerifikasi,
                acted_at: now,
                approved_at: now,
                updated_at: now,
            })
            .eq("id", activeStage.id)
            .in("status", ["Menunggu", "Diproses"])
            .select("id")
            .maybeSingle();
        if (updateStageError) {
            logSupabaseError("update verifikasi_pengajuan tahap aktif", updateStageError);
            throw updateStageError;
        }
        if (!updatedStage) {
            logSupabaseNoRows("update verifikasi_pengajuan tahap aktif", { pengajuanId, stageId: activeStage.id, allowedStatus: ["Menunggu", "Diproses"] });
            return jsonError("Tahap aktif sudah diproses. Muat ulang data pengajuan.", 409);
        }

        if (nextStage) {
            const { error: nextStageError } = await supabase
                .from("verifikasi_pengajuan")
                .update({ status: "Diproses", updated_at: now })
                .eq("id", nextStage.id)
                .eq("status", "Menunggu");
            if (nextStageError) {
                logSupabaseError("update verifikasi_pengajuan tahap berikutnya", nextStageError);
                throw nextStageError;
            }
        }

        const pengajuanUpdate = {
            workflow_status: nextWorkflowStatus,
            status: nextStage ? "Diproses" : "Selesai",
            updated_at: now,
        };
        const { data: updatedPengajuan, error: updatePengajuanError } = await supabase
            .from("pengajuan_surat")
            .update(pengajuanUpdate)
            .eq("id", pengajuanId)
            .select("id,status,workflow_status")
            .maybeSingle();
        if (updatePengajuanError) {
            logSupabaseError("update pengajuan_surat", updatePengajuanError);
            throw updatePengajuanError;
        }
        if (!updatedPengajuan) {
            logSupabaseNoRows("update pengajuan_surat", { pengajuanId, nextWorkflowStatus, petugasId });
            throw new Error("Update pengajuan_surat tidak mengembalikan data.");
        }

        const trackingRows = [{
            pengajuan_id: pengajuanId,
            status: nextStage ? "Diproses" : "SELESAI",
            keterangan: nextStage ? `Pengajuan diteruskan ke ${stageShortName(nextStage)}.` : "Pengajuan selesai diverifikasi.",
            petugas: petugasName,
            created_at: now,
        }];
        const { error: trackingError } = await supabase.from("tracking_pengajuan").insert(trackingRows);
        if (trackingError) {
            logSupabaseError("insert tracking_pengajuan", trackingError);
            throw trackingError;
        }

        const auditPayload = {
            pengajuan_id: pengajuanId,
            user_id: petugasId,
            nama_petugas: petugasName,
            role: workflowRole,
            tahap: STAGE_AUDIT_LABEL[activeStage.tahap] ?? activeStage.nama_tahap,
            aksi: "VERIFIKASI",
            action: "VERIFIKASI",
            status: "Diproses",
            status_sebelum: requiredStatus,
            status_sesudah: nextWorkflowStatus,
            catatan,
            metadata: { tahap: activeStage.tahap, next_tahap: nextStage?.tahap ?? null, role: workflowRole, pemeriksaan: body?.pemeriksaan ?? null },
        };
        const { error: auditError } = await supabase.from("audit_pengajuan").insert(auditPayload);
        if (auditError) {
            logSupabaseError("insert audit_pengajuan", auditError);
            throw auditError;
        }

        console.log("[VERIFIKASI PETUGAS] SUCCESS", { pengajuanId, stage: activeStage.tahap, nextStatus: nextWorkflowStatus });
        return NextResponse.json({ ok: true, data: updatedPengajuan });
    } catch (error) {
        console.error("[VERIFIKASI PETUGAS] UNHANDLED ERROR", { pengajuanId, error });
        return publicSaveError();
    }
}

function includesStageStatus(status: string) {
    return ["Menunggu", "Diproses"].includes(status);
}