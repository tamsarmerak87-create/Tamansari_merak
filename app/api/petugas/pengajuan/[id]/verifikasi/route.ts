import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type RouteContext = { params: Promise<{ id: string }> };
type SupabaseError = { message?: string; details?: string; hint?: string; code?: string };
type VerificationBody = { catatan?: string; pemeriksaan?: unknown };

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function publicSaveError() {
    return jsonError("Data belum dapat disimpan. Silakan coba lagi.", 500);
}

function logSupabaseError(error: SupabaseError | null) {
    if (!error) return;
    console.error("[VERIFIKASI] SUPABASE ERROR", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
    });
}

export async function POST(request: NextRequest, context: RouteContext) {
    let pengajuanId = "";

    try {
        const params = await context.params;
        pengajuanId = params.id;
        console.log("[VERIFIKASI] START", { pengajuanId });

        if (!pengajuanId) return jsonError("Pengajuan tidak ditemukan.", 404);

        const session = await getAdminSession(request, { cookie: "petugas" });
        if (session.error || !session.profile) {
            return jsonError("Sesi petugas tidak valid.", 401);
        }
        if (!isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
        if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);
        console.log("[VERIFIKASI] AUTH OK");

        const supabase = createSupabaseAdminClient();
        if (!supabase) return publicSaveError();

        const body = await request.json().catch(() => null) as VerificationBody | null;
        const now = new Date().toISOString();
        const catatan = body?.catatan?.trim() || "Dokumen telah diverifikasi dan lengkap";
        const petugasId = session.profile.id;
        const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";

        const { data: pengajuan, error: pengajuanError } = await supabase
            .from("pengajuan_surat")
            .select("id,status")
            .eq("id", pengajuanId)
            .maybeSingle();
        if (pengajuanError) {
            logSupabaseError(pengajuanError);
            throw pengajuanError;
        }
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        console.log("[VERIFIKASI] PENGAJUAN FOUND");

        const { data: activeStage, error: stageError } = await supabase
            .from("verifikasi_pengajuan")
            .select("id,nama_tahap,status")
            .eq("pengajuan_id", pengajuanId)
            .eq("status", "Diproses")
            .order("tahap", { ascending: true })
            .limit(1)
            .maybeSingle();
        if (stageError) {
            logSupabaseError(stageError);
            throw stageError;
        }

        console.log("[VERIFIKASI] UPDATE START");
        const hasilVerifikasi = JSON.stringify({
            status: "Data dan dokumen dinyatakan lengkap.",
            pemeriksaan: body?.pemeriksaan ?? {
                check_status: "checked",
                check_notes: catatan,
                checked_at: now,
                checked_by: petugasId
            }
        });

        if (activeStage) {
            const { error: updateStageError } = await supabase
                .from("verifikasi_pengajuan")
                .update({
                    petugas_id: petugasId,
                    user_id: petugasId,
                    nama_petugas: petugasName,
                    jabatan: activeStage.nama_tahap,
                    catatan,
                    hasil_verifikasi: hasilVerifikasi,
                    updated_at: now
                })
                .eq("id", activeStage.id);
            if (updateStageError) {
                logSupabaseError(updateStageError);
                throw updateStageError;
            }
        }

        const { data: updatedPengajuan, error: updatePengajuanError } = await supabase
            .from("pengajuan_surat")
            .update({ workflow_status: activeStage?.nama_tahap ?? "Diperiksa", updated_at: now })
            .eq("id", pengajuanId)
            .select("id")
            .maybeSingle();
        if (updatePengajuanError) {
            logSupabaseError(updatePengajuanError);
            throw updatePengajuanError;
        }
        if (!updatedPengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);

        console.log("[VERIFIKASI] UPDATE SUCCESS");
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[VERIFIKASI] UNHANDLED ERROR:", error);
        return publicSaveError();
    }
}