import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { STAGE_WAITING_STATUS, VERIFICATION_STAGES, getActiveStage, isFinalSubmissionStatus, isWorkflowRole } from "@/services/verification-workflow";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

type Action = "proses_tahap" | "verifikasi" | "setujui" | "selesai" | "tolak" | "revisi";
type StageRow = { id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };

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
    } | null;

    if (!body?.id) return jsonError("ID pengajuan wajib diisi.");
    if (!body.action) return jsonError("Aksi pengajuan wajib diisi.");

    const petugasId = session.profile.id;
    const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";
    const now = new Date().toISOString();

    if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);

    if (!isWorkflowRole(session.profile.role)) return jsonError("Role petugas tidak memiliki kewenangan workflow verifikasi.", 403);

    const { data: stages, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", body.id).order("tahap", { ascending: true });
    if (stageError) return jsonError(stageError.message, 500);
    const orderedStages = (stages ?? []) as StageRow[];
    const activeStage = getActiveStage(orderedStages);
    if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
    if (activeStage.role_petugas !== session.profile.role) return jsonError(`Tahap aktif hanya dapat diproses oleh ${activeStage.nama_tahap}.`, 403);
    if (!["Menunggu", "Diproses"].includes(activeStage.status)) return jsonError("Tahap aktif sudah tidak bisa diproses.", 409);

    const { data: pengajuanAktif, error: pengajuanError } = await supabase.from("pengajuan_surat").select("id,status,nomor_surat").eq("id", body.id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuanAktif) return jsonError("Pengajuan tidak ditemukan.", 404);
    if (isFinalSubmissionStatus(String(pengajuanAktif.status))) return jsonError("Pengajuan sudah final dan tidak bisa diproses ulang tanpa pembatalan/revisi resmi.", 409);

    const isReject = body.action === "tolak" || body.action === "revisi";
    const catatan = (isReject ? body.alasan_penolakan : body.catatan_petugas)?.trim();
    if (isReject && !catatan) return jsonError("Alasan penolakan wajib diisi.");

    const { error: verificationError } = await supabase.from("verifikasi_pengajuan").update({ status: isReject ? "Ditolak" : "Disetujui", petugas_id: petugasId, user_id: petugasId, nama_petugas: petugasName, jabatan: session.profile.jabatan ?? stageShortName(activeStage), acted_at: now, approved_at: isReject ? null : now, updated_at: now, catatan: catatan ?? null, hasil_verifikasi: body.hasil_verifikasi?.trim() || null, dokumentasi_url: body.dokumentasi_url?.trim() || null }).eq("id", activeStage.id).in("status", ["Menunggu", "Diproses"]);
    if (verificationError) return jsonError(verificationError.message, 500);

    const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
    const status = isReject ? (body.action === "revisi" ? "REVISI" : "DITOLAK") : activeStage.tahap === 5 ? "SELESAI" : STAGE_WAITING_STATUS[activeStage.tahap + 1];
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

    const { data, error } = await supabase.from("pengajuan_surat").update(pengajuanUpdate).eq("id", body.id).select("*").single();
    if (error) return jsonError(error.message, 500);

    if (!isReject && nextStage) {
        const { error: nextError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses" }).eq("id", nextStage.id).eq("status", "Menunggu");
        if (nextError) return jsonError(nextError.message, 500);
    }
    const trackingRows = isReject
        ? [{ pengajuan_id: body.id, status: activeStage.nama_tahap, keterangan: `Pengajuan ditolak pada tahap ${stageShortName(activeStage)}. ${catatan}`, petugas: petugasName, created_at: now }]
        : activeStage.tahap === 5
            ? [{ pengajuan_id: body.id, status: "SELESAI", keterangan: "Surat divalidasi dan diterbitkan oleh Lurah.", petugas: petugasName, created_at: now }]
            : [
                { pengajuan_id: body.id, status: activeStage.nama_tahap, keterangan: `Pengajuan diperiksa oleh ${stageShortName(activeStage)}.`, petugas: petugasName, created_at: now },
                { pengajuan_id: body.id, status: nextStage?.nama_tahap ?? status, keterangan: nextStage ? `Pengajuan diteruskan ke ${stageShortName(nextStage)}.` : "Pengajuan diteruskan.", petugas: petugasName, created_at: now },
            ];
    await supabase.from("tracking_pengajuan").insert(trackingRows);
    await supabase.from("audit_pengajuan").insert({ pengajuan_id: body.id, tahap: activeStage.nama_tahap, status, action: body.action, user_id: petugasId, nama_petugas: petugasName, jabatan: session.profile.jabatan ?? stageShortName(activeStage), catatan: catatan ?? null, metadata: { tahap: activeStage.tahap, next_tahap: nextStage?.tahap ?? null } });

    return NextResponse.json({ ok: true, data });
}