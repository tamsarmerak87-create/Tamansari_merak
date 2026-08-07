import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

type Action = "verifikasi" | "setujui" | "tolak";

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
        verified_by: session.profile.id,
        verified_at: now,
    };

    if (body.action === "setujui") {
        updatePayload.status = "Diproses";
        updatePayload.alasan_penolakan = null;
        if (body.catatan_petugas?.trim()) updatePayload.catatan_admin = body.catatan_petugas.trim();
    }

    if (body.action === "tolak") {
        const reason = body.alasan_penolakan?.trim();
        if (!reason) return jsonError("Alasan penolakan wajib diisi.");
        updatePayload.status = "Ditolak";
        updatePayload.alasan_penolakan = reason;
        updatePayload.catatan_admin = body.catatan_petugas?.trim() || reason;
    }

    if (body.action === "verifikasi") {
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

    return NextResponse.json({ ok: true, data });
}