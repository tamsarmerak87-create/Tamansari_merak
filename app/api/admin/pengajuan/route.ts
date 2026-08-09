import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { ROLE_STAGE_STATUS, STAGE_WAITING_STATUS, VERIFICATION_STAGES, getActiveStage, isFinalSubmissionStatus, normalizeSubmissionStatus, normalizeWorkflowRole } from "@/services/verification-workflow";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

type Action = "proses_tahap" | "verifikasi" | "setujui" | "selesai" | "tolak" | "revisi";
type StageRow = { id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };
type ActionDecision = { status: "Disetujui" | "Ditolak"; submissionStatus: string; auditLabel: string; trackingLabel: string };

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

function createNomorSurat(sequence: number, date = new Date()) {
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][date.getMonth()];
    return `${String(sequence).padStart(3, "0")}/KEL.TMS/${roman}/${date.getFullYear()}`;
}

function publicBaseUrl(request: NextRequest) {
    return process.env.NEXT_PUBLIC_SITE_URL ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

function actionDecision(action: Action, stage: StageRow): ActionDecision {
    if (action === "tolak") return { status: "Ditolak", submissionStatus: "DITOLAK", auditLabel: stage.tahap === 5 ? "Validasi Akhir" : "Penolakan", trackingLabel: "Ditolak" };
    if (action === "revisi") return { status: "Ditolak", submissionStatus: "REVISI", auditLabel: "Dikembalikan / Revisi", trackingLabel: "Dikembalikan untuk revisi" };
    if (stage.tahap === 5) return { status: "Disetujui", submissionStatus: "SELESAI", auditLabel: "Validasi Akhir", trackingLabel: "SURAT DITERBITKAN" };
    return { status: "Disetujui", submissionStatus: STAGE_WAITING_STATUS[stage.tahap + 1], auditLabel: stage.tahap === 3 ? "Persetujuan" : "Verifikasi Pengajuan", trackingLabel: "Disetujui" };
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
    const session = await getAdminSession(request);
    if (session.error || !session.profile) return jsonError("Session admin tidak valid.", 401);

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

    const petugasId = session.profile.id;
    const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";
    const now = new Date().toISOString();

    if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);

    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (!workflowRole) return jsonError("Role petugas tidak memiliki kewenangan workflow verifikasi.", 403);

    const { data: stages, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", body.id).order("tahap", { ascending: true });
    if (stageError) return jsonError(stageError.message, 500);
    const orderedStages = (stages ?? []) as StageRow[];
    const activeStage = getActiveStage(orderedStages);
    if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
    if (activeStage.role_petugas !== workflowRole) return jsonError(`Tahap aktif hanya dapat diproses oleh ${activeStage.nama_tahap}.`, 403);
    if (!["Menunggu", "Diproses"].includes(activeStage.status)) return jsonError("Tahap aktif sudah tidak bisa diproses.", 409);

    const { data: pengajuanAktif, error: pengajuanError } = await supabase.from("pengajuan_surat").select("id,status,workflow_status,nomor_surat").eq("id", body.id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuanAktif) return jsonError("Pengajuan tidak ditemukan.", 404);
    if (isFinalSubmissionStatus(String(pengajuanAktif.status))) return jsonError("Pengajuan sudah final dan tidak bisa diproses ulang tanpa pembatalan/revisi resmi.", 409);
    const normalizedSubmissionStatus = normalizeSubmissionStatus(String(pengajuanAktif.workflow_status ?? pengajuanAktif.status));
    const requiredStatus = ROLE_STAGE_STATUS[workflowRole];
    if (normalizedSubmissionStatus !== requiredStatus) return jsonError(`${roleLabelForError(workflowRole)} hanya boleh memproses status ${requiredStatus}.`, 403);
    if (STAGE_WAITING_STATUS[activeStage.tahap] !== requiredStatus) return jsonError("Tahap workflow aktif tidak sesuai dengan status pengajuan.", 409);

    const isReject = body.action === "tolak" || body.action === "revisi";
    const catatan = (isReject ? body.alasan_penolakan : body.catatan_petugas)?.trim();
    if (isReject && !catatan) return jsonError("Alasan penolakan wajib diisi.");
    if (!isReject && activeStage.tahap === 5 && body.action !== "selesai") return jsonError("Tahap Lurah wajib diproses dengan aksi VALIDASI & TERBITKAN SURAT.", 400);
    const decision = actionDecision(body.action, activeStage);

    const { error: verificationError } = await supabase.from("verifikasi_pengajuan").update({ status: decision.status, petugas_id: petugasId, user_id: petugasId, nama_petugas: petugasName, jabatan: session.profile.jabatan ?? stageShortName(activeStage), acted_at: now, approved_at: isReject ? null : now, updated_at: now, catatan: catatan ?? null, hasil_verifikasi: body.hasil_verifikasi?.trim() || null, dokumentasi_url: body.dokumentasi_url?.trim() || null }).eq("id", activeStage.id).in("status", ["Menunggu", "Diproses"]);
    if (verificationError) return jsonError(verificationError.message, 500);

    const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
    const status = decision.submissionStatus;
    const pengajuanUpdate: Record<string, string | number | null> = { status, workflow_status: status, updated_at: now, catatan_admin: catatan ?? null };
    if (isReject) pengajuanUpdate.alasan_penolakan = catatan ?? "Ditolak";
    if (!isReject && activeStage.tahap === 5) {
        const { count } = await supabase.from("pengajuan_surat").select("id", { count: "exact", head: true }).not("nomor_surat", "is", null);
        const token = crypto.randomBytes(24).toString("hex");
        const nomorSurat = pengajuanAktif.nomor_surat || createNomorSurat((count ?? 0) + 1);
        pengajuanUpdate.verified_at = now;
        pengajuanUpdate.verified_by = petugasId;
        pengajuanUpdate.alasan_penolakan = null;
        pengajuanUpdate.validated_by = petugasId;
        pengajuanUpdate.validated_at = now;
        pengajuanUpdate.lurah_id = petugasId;
        pengajuanUpdate.lurah_name = petugasName;
        pengajuanUpdate.nomor_surat = nomorSurat;
        pengajuanUpdate.tanggal_surat = now.slice(0, 10);
        pengajuanUpdate.verification_token = token;
        pengajuanUpdate.verification_url = `${publicBaseUrl(request)}/verifikasi/${token}`;
        pengajuanUpdate.final_pdf_url = `/api/surat/${token}/pdf`;
    }
    if (!isReject && activeStage.tahap !== 5) {
        pengajuanUpdate.verified_at = now;
        pengajuanUpdate.verified_by = petugasId;
        pengajuanUpdate.verified_name = petugasName;
        pengajuanUpdate.verified_role = workflowRole;
        pengajuanUpdate.verification_note = catatan ?? null;
        pengajuanUpdate.alasan_penolakan = null;
    }

    const { data, error } = await supabase.from("pengajuan_surat").update(pengajuanUpdate).eq("id", body.id).select("*").single();
    if (error) return jsonError(error.message, 500);

    if (!isReject && nextStage) {
        const { error: nextError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses" }).eq("id", nextStage.id).eq("status", "Menunggu");
        if (nextError) return jsonError(nextError.message, 500);
    }
    const trackingRows = isReject
        ? [{ pengajuan_id: body.id, status: activeStage.nama_tahap, keterangan: `${decision.trackingLabel} pada tahap ${stageShortName(activeStage)}. ${catatan}`, petugas: petugasName, created_at: now }]
        : activeStage.tahap === 5
            ? [{ pengajuan_id: body.id, status: "SELESAI", keterangan: "Surat divalidasi dan diterbitkan oleh Lurah.", petugas: petugasName, created_at: now }]
            : [
                { pengajuan_id: body.id, status: activeStage.nama_tahap, keterangan: `Pengajuan diperiksa oleh ${stageShortName(activeStage)}.`, petugas: petugasName, created_at: now },
                { pengajuan_id: body.id, status: nextStage?.nama_tahap ?? status, keterangan: nextStage ? `Pengajuan diteruskan ke ${stageShortName(nextStage)}.` : "Pengajuan diteruskan.", petugas: petugasName, created_at: now },
            ];
    const { error: trackingError } = await supabase.from("tracking_pengajuan").insert(trackingRows);
    if (trackingError) return jsonError(trackingError.message, 500);

    const auditPayload = {
        pengajuan_id: body.id,
        petugas_id: petugasId,
        user_id: petugasId,
        nama_petugas: petugasName,
        role: workflowRole.toUpperCase(),
        tahap: STAGE_AUDIT_LABEL[activeStage.tahap] ?? activeStage.nama_tahap,
        aksi: auditActionLabel(body.action, activeStage),
        action: decision.auditLabel,
        status: decision.trackingLabel,
        status_sebelum: requiredStatus,
        status_sesudah: status,
        jabatan: session.profile.jabatan ?? stageShortName(activeStage),
        catatan: catatan ?? null,
        metadata: { tahap: activeStage.tahap, next_tahap: nextStage?.tahap ?? null, role: workflowRole, checklist: body.checklist ?? null, hasil_verifikasi: body.hasil_verifikasi ?? null, dokumentasi_url: body.dokumentasi_url ?? null },
    };
    const { error: auditError } = await supabase.from("audit_pengajuan").insert(auditPayload);
    if (auditError) return jsonError(auditError.message, 500);

    return NextResponse.json({ ok: true, data });
}

function roleLabelForError(role: string) {
    return VERIFICATION_STAGES.find((stage) => stage.role_petugas === role)?.nama_tahap ?? role;
}