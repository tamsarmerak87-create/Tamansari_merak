import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type VerificationRequestBody = {
    wargaId?: string;
    id?: string;
    status_verifikasi?: "Belum Terverifikasi" | "Terverifikasi" | "Ditolak";
    alasan_penolakan?: string | null;
};

export async function PATCH(request: NextRequest) {
    try {
        const session = await getAdminSession(request, { cookie: "admin" });
        if (session.error || !session.profile) {
            return NextResponse.json({ ok: false, error: "Sesi admin/petugas tidak valid." }, { status: 401 });
        }
        const adminOnlyError = requireAdmin(session.profile);
        if (adminOnlyError) {
            return NextResponse.json({ ok: false, error: "Hanya admin yang dapat memverifikasi akun warga." }, { status: 403 });
        }

        const body = (await request.json()) as VerificationRequestBody;
        const wargaId = body.wargaId ?? body.id;

        if (!wargaId) {
            return NextResponse.json({ ok: false, error: "ID warga wajib diisi." }, { status: 400 });
        }

        const nextStatus = body.status_verifikasi;
        if (nextStatus !== "Terverifikasi" && nextStatus !== "Ditolak") {
            return NextResponse.json({ ok: false, error: "Status verifikasi tidak valid." }, { status: 400 });
        }

        if (nextStatus === "Ditolak" && !body.alasan_penolakan?.trim()) {
            return NextResponse.json({ ok: false, error: "Alasan penolakan wajib diisi." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const updatePayload = {
            status_verifikasi: nextStatus,
            alasan_penolakan: nextStatus === "Ditolak" ? body.alasan_penolakan?.trim() : null,
            verified_at: nextStatus === "Terverifikasi" ? new Date().toISOString() : null,
            verified_by: nextStatus === "Terverifikasi" ? session.profile.id : null,
        };

        const { data, error } = await supabase
            .from("warga_profiles")
            .update(updatePayload)
            .eq("id", wargaId)
            .select("id,nama_lengkap,nik,email,status_verifikasi,alasan_penolakan,verified_at,verified_by");

        if (error) {
            return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json(
                { ok: false, error: "Tidak ada data warga yang diperbarui. Periksa ID warga atau policy RLS." },
                { status: 400 },
            );
        }

        return NextResponse.json({ ok: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal memperbarui verifikasi warga.";
        console.error(`[api/admin/verifikasi] ${message}`);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui verifikasi warga." },
            { status: 500 },
        );
    }
}