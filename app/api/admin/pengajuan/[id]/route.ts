import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeSubmissionObjectPath, SUBMISSION_DOCUMENT_BUCKET } from "@/services/submission-storage";

type RouteContext = { params: Promise<{ id: string }> };
type DokumenPengajuan = { url_file: string | null };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SURAT_BUCKET = SUBMISSION_DOCUMENT_BUCKET;

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function getSuratStoragePath(urlFile?: string | null) {
    return normalizeSubmissionObjectPath(urlFile) || null;
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
        const session = await getAdminSession(request, { cookie: "admin" });
        if (session.error || !session.profile) {
            return jsonError("Sesi admin tidak valid.", 401);
        }

        const adminOnlyError = requireAdmin(session.profile);
        if (adminOnlyError) {
            return jsonError("Hanya admin yang dapat menghapus pengajuan.", 403);
        }

        const { id } = await params;
        if (!id || !UUID_REGEX.test(id)) {
            return jsonError("ID pengajuan tidak valid.", 400);
        }

        const supabase = createSupabaseAdminClient();
        const { data: pengajuan, error: pengajuanError } = await supabase
            .from("pengajuan_surat")
            .select("id")
            .eq("id", id)
            .maybeSingle();

        if (pengajuanError) return jsonError(pengajuanError.message, 500);
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);

        const { data: dokumen, error: dokumenError } = await supabase
            .from("dokumen_pengajuan")
            .select("url_file")
            .eq("pengajuan_id", id);

        if (dokumenError) return jsonError(dokumenError.message, 500);

        const storagePaths = Array.from(new Set((dokumen as DokumenPengajuan[] | null ?? [])
            .map((item) => getSuratStoragePath(item.url_file))
            .filter((path): path is string => Boolean(path))));

        if (storagePaths.length > 0) {
            const { error: storageError } = await supabase.storage.from(SURAT_BUCKET).remove(storagePaths);
            if (storageError) return jsonError(`Gagal menghapus file Storage: ${storageError.message}`, 500);
        }

        const { error: deleteError } = await supabase
            .from("pengajuan_surat")
            .delete()
            .eq("id", id);

        if (deleteError) return jsonError(deleteError.message, 500);

        return NextResponse.json({ ok: true, deletedId: id, removedFiles: storagePaths.length });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal menghapus pengajuan.";
        console.error(`[api/admin/pengajuan/[id]] ${message}`);
        return jsonError(message, 500);
    }
}