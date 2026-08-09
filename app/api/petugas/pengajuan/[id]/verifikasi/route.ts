import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeWorkflowRole } from "@/services/verification-workflow";

type StageRow = { id: string; pengajuan_id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };

const NEXT_STAGE_LABEL: Record<number, string> = { 1: "Petugas Lapangan", 2: "Kepala Seksi", 3: "Seklur", 4: "Lurah" };
const CURRENT_STAGE_LABEL: Record<number, string> = { 1: "Staff Pelayanan", 2: "Petugas Lapangan", 3: "Kepala Seksi", 4: "Seklur", 5: "Lurah" };

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }
function trackingMessage(stage: StageRow) { return stage.tahap === 5 ? "Pengajuan telah divalidasi Lurah dan surat diterbitkan." : `Pengajuan telah diverifikasi ${CURRENT_STAGE_LABEL[stage.tahap] ?? stage.nama_tahap} dan diteruskan ke ${NEXT_STAGE_LABEL[stage.tahap] ?? "tahap berikutnya"}.`; }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const session = await getAdminSession(request);
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);

    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (!workflowRole) return jsonError("Role petugas tidak memiliki kewenangan workflow verifikasi.", 403);

    const body = await request.json().catch(() => null) as { catatan?: string } | null;
    const catatan = body?.catatan?.trim() || "Dokumen telah diverifikasi dan lengkap";
    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const now = new Date().toISOString();
    const petugasId = session.profile.id;
    const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";

    const { data: pengajuan, error: pengajuanError } = await supabase.from("pengajuan_surat").select("id,status").eq("id", id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
    if (String(pengajuan.status).toLowerCase() === "selesai") return jsonError("Pengajuan sudah selesai.", 409);

    const { data: stages, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,pengajuan_id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", id).order("tahap", { ascending: true });
    if (stageError) return jsonError(stageError.message, 500);
    const orderedStages = (stages ?? []) as StageRow[];
    const activeStage = orderedStages.find((stage) => stage.status === "Diproses");
    if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
    if (activeStage.role_petugas !== workflowRole) return jsonError(`Tahap aktif adalah ${activeStage.nama_tahap}; akun ini tidak berwenang memproses tahap tersebut.`, 403);

    const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
    const { data: updatedStage, error: updateStageError } = await supabase
        .from("verifikasi_pengajuan")
        .update({ status: "Disetujui", petugas_id: petugasId, catatan, acted_at: now })
        .eq("id", activeStage.id)
        .eq("status", "Diproses")
        .select("*")
        .single();
    if (updateStageError) return jsonError(updateStageError.message, 500);

    if (nextStage) {
        const { error: nextError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses" }).eq("id", nextStage.id).eq("status", "Menunggu");
        if (nextError) return jsonError(nextError.message, 500);
    }

    const pengajuanUpdate = activeStage.tahap === 5
        ? { status: "Selesai", selesai_at: now, selesai_by: petugasId, updated_at: now }
        : { status: "Diproses", diproses_at: now, diproses_by: petugasId, updated_at: now };
    const { data: updatedPengajuan, error: updatePengajuanError } = await supabase.from("pengajuan_surat").update(pengajuanUpdate).eq("id", id).select("*").single();
    if (updatePengajuanError) return jsonError(updatePengajuanError.message, 500);

    const { error: trackingError } = await supabase.from("tracking_pengajuan").insert({ pengajuan_id: id, status: activeStage.tahap === 5 ? "Selesai" : "Diproses", keterangan: trackingMessage(activeStage), petugas: petugasName, created_at: now });
    if (trackingError) return jsonError(trackingError.message, 500);

    const { error: auditError } = await supabase.from("audit_pengajuan").insert({ pengajuan_id: id, user_id: petugasId, nama_petugas: petugasName, role: workflowRole, tahap: `${activeStage.tahap} - ${activeStage.nama_tahap}`, aksi: "VERIFIKASI", action: "VERIFIKASI", status: "Disetujui", status_sebelum: "Diproses", status_sesudah: "Disetujui", catatan, created_at: now });
    if (auditError) return jsonError(auditError.message, 500);

    return NextResponse.json({ ok: true, data: updatedPengajuan, verifikasi: updatedStage });
}