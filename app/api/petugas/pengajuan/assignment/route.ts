import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { isFinalSubmissionStatus } from "@/services/verification-workflow";

function error(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return error("Session petugas tidak valid.", 401);
    if (!isPetugas(session.profile) || session.profile.role !== "kepala_seksi") return error("Hanya Kasi yang dapat membagikan tugas.", 403);
    const db = createSupabaseAdminClient();
    if (!db) return error("Supabase service role belum dikonfigurasi.", 500);
    const body = await request.json().catch(() => null) as { pengajuan_id?: string; staff_id?: string; lapangan_id?: string } | null;
    if (!body?.pengajuan_id || !body.staff_id || !body.lapangan_id) return error("Staff Pelayanan dan Petugas Lapangan wajib dipilih.");

    const { data: officers, error: officersError } = await db.from("petugas").select("id,role,is_active").in("id", [body.staff_id, body.lapangan_id]).eq("is_active", true);
    if (officersError) return error(officersError.message, 500);
    const staff = officers?.find((item) => item.id === body.staff_id);
    const lapangan = officers?.find((item) => item.id === body.lapangan_id);
    if (staff?.role !== "staff_pelayanan" || lapangan?.role !== "petugas_lapangan") return error("Petugas yang dipilih tidak sesuai role atau tidak aktif.", 400);

    const { data: submission, error: submissionError } = await db.from("pengajuan_surat").select("id,status").eq("id", body.pengajuan_id).maybeSingle();
    if (submissionError) return error(submissionError.message, 500);
    if (!submission) return error("Pengajuan tidak ditemukan.", 404);
    if (isFinalSubmissionStatus(String(submission.status))) return error("Pengajuan sudah selesai atau ditolak dan tidak dapat dibagikan.", 409);

    const { data: stages, error: stageError } = await db.from("verifikasi_pengajuan").select("id,tahap,role_petugas,status,petugas_id").eq("pengajuan_id", body.pengajuan_id).in("tahap", [1, 2]);
    if (stageError) return error(stageError.message, 500);
    const first = stages?.find((stage) => stage.tahap === 1);
    const second = stages?.find((stage) => stage.tahap === 2);
    if (!first || !second) return error("Tahap assignment existing tidak ditemukan.", 409);
    if (first.role_petugas !== "staff_pelayanan" || second.role_petugas !== "petugas_lapangan") return error("Role tahap assignment tidak sesuai workflow existing.", 409);
    if (!["Menunggu", "Diproses"].includes(first.status) || !["Menunggu", "Diproses"].includes(second.status)) return error("Pengajuan sudah diproses dan tidak dapat dibagikan ulang.", 409);
    if (first.petugas_id || second.petugas_id) return error("Pengajuan sudah dibagikan kepada petugas lain.", 409);

    const now = new Date().toISOString();
    const firstUpdate = await db.from("verifikasi_pengajuan").update({ petugas_id: body.staff_id, updated_at: now }).eq("id", first.id).eq("role_petugas", "staff_pelayanan").in("status", ["Menunggu", "Diproses"]).is("petugas_id", null).select("id");
    if (firstUpdate.error) return error(firstUpdate.error.message, 500);
    if (!firstUpdate.data?.length) return error("Tahap Staff Pelayanan sudah berubah dan tidak dapat dibagikan.", 409);
    const secondUpdate = await db.from("verifikasi_pengajuan").update({ petugas_id: body.lapangan_id, updated_at: now }).eq("id", second.id).eq("role_petugas", "petugas_lapangan").in("status", ["Menunggu", "Diproses"]).is("petugas_id", null).select("id");
    if (secondUpdate.error || !secondUpdate.data?.length) {
        const rollback = await db.from("verifikasi_pengajuan").update({ petugas_id: null }).eq("id", first.id).eq("petugas_id", body.staff_id).select("id");
        if (rollback.error) console.error("[ASSIGNMENT ROLLBACK ERROR]", rollback.error);
        return error(secondUpdate.error?.message ?? "Tahap Petugas Lapangan sudah berubah dan assignment dibatalkan.", secondUpdate.error ? 500 : 409);
    }
    return NextResponse.json({ ok: true });
}