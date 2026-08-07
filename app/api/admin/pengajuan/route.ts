import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

type Action = "verifikasi" | "setujui" | "selesai" | "tolak";

function actionStatus(action: Action) {
    if (action === "verifikasi") return "Terverifikasi";
    if (action === "setujui") return "Diproses";
    if (action === "selesai") return "Selesai";
    return "Ditolak";
}

function actionLabel(action: Action) {
    if (action === "verifikasi") return "Berkas Diverifikasi";
    if (action === "setujui") return "Pengajuan Diproses";
    if (action === "selesai") return "Pengajuan Selesai";
    return "Pengajuan Ditolak";
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

    const now = new Date().toISOString();
    const updatePayload: Record<string, string | null> = {
        status: actionStatus(body.action),
        verified_by: session.profile.id,
        verified_at: now,
    };

    if (body.action === "setujui") {
        updatePayload.alasan_penolakan = null;
        if (body.catatan_petugas?.trim()) updatePayload.catatan_admin = body.catatan_petugas.trim();
    }

    if (body.action === "selesai") {
        updatePayload.alasan_penolakan = null;
        updatePayload.catatan_admin = body.catatan_petugas?.trim() || "Pengajuan telah selesai diproses petugas.";
    }

    if (body.action === "tolak") {
        const reason = body.alasan_penolakan?.trim();
        if (!reason) return jsonError("Alasan penolakan wajib diisi.");
        updatePayload.alasan_penolakan = reason;
        updatePayload.catatan_admin = body.catatan_petugas?.trim() || reason;
    }

    if (body.action === "verifikasi") {
        updatePayload.alasan_penolakan = null;
        updatePayload.catatan_admin = body.catatan_petugas?.trim() || "Berkas telah diverifikasi petugas.";
    }

    const { data, error } = await supabase
        .from("pengajuan_surat")
        .update(updatePayload)
        .eq("id", body.id)
        .select("*")
        .single();

    if (error) {
        console.error("ADMIN PENGAJUAN UPDATE ERROR");
        console.dir(error, { depth: null });
        return jsonError(error.message, 500);
    }

    const trackingPayload = {
        pengajuan_id: body.id,
        status: updatePayload.status,
        keterangan: updatePayload.catatan_admin ?? actionLabel(body.action),
        catatan: updatePayload.catatan_admin ?? actionLabel(body.action),
        petugas_id: session.profile.id,
        nama_petugas: session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan",
        created_at: now,
    };

    const { error: trackingError } = await supabase.from("tracking_pengajuan").insert(trackingPayload);
    if (trackingError) {
        console.error("ADMIN TRACKING INSERT ERROR");
        console.error(trackingError);
        console.dir(trackingError, { depth: null });
        return jsonError(`Status tersimpan, tetapi riwayat aktivitas gagal dicatat: ${trackingError.message}`, 500);
    }

    return NextResponse.json({ ok: true, data });
}