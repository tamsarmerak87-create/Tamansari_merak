import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { VERIFICATION_STAGES, getActiveStage, isWorkflowRole } from "@/services/verification-workflow";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

type Action = "proses_tahap" | "verifikasi" | "setujui" | "selesai" | "tolak";
type StageRow = { id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };

function stageShortName(stage: StageRow) {
    return VERIFICATION_STAGES.find((item) => item.tahap === stage.tahap)?.nama_tahap.replace(/^Verifikasi\s+|^Persetujuan\s+/, "") ?? stage.nama_tahap;
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
    } | null;

    if (!body?.id) return jsonError("ID pengajuan wajib diisi.");
    if (!body.action) return jsonError("Aksi pengajuan wajib diisi.");

    const petugasId = session.profile.id;
    const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";
    const now = new Date().toISOString();

    if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);

    if (body.action === "selesai") {
        const { data, error } = await supabase.from("pengajuan_surat").update({ status: "Selesai", selesai_at: now, selesai_by: petugasId, updated_at: now }).eq("id", body.id).eq("status", "Disetujui").select("*").maybeSingle();
        if (error) return jsonError(error.message, 500);
        if (!data) return jsonError("Pengajuan hanya bisa diselesaikan setelah disetujui Lurah.", 403);
        await supabase.from("tracking_pengajuan").insert({ pengajuan_id: body.id, status: "Selesai", keterangan: body.catatan_petugas?.trim() || "Dokumen selesai diproses.", petugas: petugasName, created_at: now });
        return NextResponse.json({ ok: true, data });
    }

    if (!isWorkflowRole(session.profile.role)) return jsonError("Role petugas tidak memiliki kewenangan workflow verifikasi.", 403);

    const { data: stages, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", body.id).order("tahap", { ascending: true });
    if (stageError) return jsonError(stageError.message, 500);
    const orderedStages = (stages ?? []) as StageRow[];
    const activeStage = getActiveStage(orderedStages);
    if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
    if (activeStage.role_petugas !== session.profile.role) return jsonError(`Tahap aktif hanya dapat diproses oleh ${activeStage.nama_tahap}.`, 403);
    if (!["Menunggu", "Diproses"].includes(activeStage.status)) return jsonError("Tahap aktif sudah tidak bisa diproses.", 409);

    const { data: pengajuanAktif, error: pengajuanError } = await supabase.from("pengajuan_surat").select("id,status").eq("id", body.id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuanAktif) return jsonError("Pengajuan tidak ditemukan.", 404);
    if (["Ditolak", "Disetujui", "Selesai"].includes(String(pengajuanAktif.status))) return jsonError("Pengajuan sudah final dan tidak bisa diproses ulang.", 409);

    const isReject = body.action === "tolak";
    const catatan = (isReject ? body.alasan_penolakan : body.catatan_petugas)?.trim();
    if (isReject && !catatan) return jsonError("Alasan penolakan wajib diisi.");

    const { error: verificationError } = await supabase.from("verifikasi_pengajuan").update({ status: isReject ? "Ditolak" : "Disetujui", petugas_id: petugasId, acted_at: now, catatan: catatan ?? null }).eq("id", activeStage.id).in("status", ["Menunggu", "Diproses"]);
    if (verificationError) return jsonError(verificationError.message, 500);

    const status = isReject ? "Ditolak" : activeStage.tahap === 5 ? "Disetujui" : "Menunggu Verifikasi";
    const pengajuanUpdate: Record<string, string | null> = { status, updated_at: now, catatan_admin: catatan ?? null };
    if (isReject) pengajuanUpdate.alasan_penolakan = catatan ?? "Ditolak";
    if (!isReject && activeStage.tahap === 5) {
        pengajuanUpdate.verified_at = now;
        pengajuanUpdate.verified_by = petugasId;
        pengajuanUpdate.alasan_penolakan = null;
    }

    const { data, error } = await supabase.from("pengajuan_surat").update(pengajuanUpdate).eq("id", body.id).select("*").single();
    if (error) return jsonError(error.message, 500);

    const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
    if (!isReject && nextStage) {
        const { error: nextError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses" }).eq("id", nextStage.id).eq("status", "Menunggu");
        if (nextError) return jsonError(nextError.message, 500);
    }
    const trackingRows = isReject
        ? [{ pengajuan_id: body.id, status: activeStage.nama_tahap, keterangan: `Pengajuan ditolak pada tahap ${stageShortName(activeStage)}. ${catatan}`, petugas: petugasName, created_at: now }]
        : activeStage.tahap === 5
            ? [{ pengajuan_id: body.id, status: "Persetujuan Lurah", keterangan: "Pengajuan disetujui oleh Lurah.", petugas: petugasName, created_at: now }]
            : [
                { pengajuan_id: body.id, status: activeStage.nama_tahap, keterangan: `Pengajuan diperiksa oleh ${stageShortName(activeStage)}.`, petugas: petugasName, created_at: now },
                { pengajuan_id: body.id, status: nextStage?.nama_tahap ?? status, keterangan: nextStage ? `Pengajuan diteruskan ke ${stageShortName(nextStage)}.` : "Pengajuan diteruskan.", petugas: petugasName, created_at: now },
            ];
    await supabase.from("tracking_pengajuan").insert(trackingRows);

    return NextResponse.json({ ok: true, data });
}