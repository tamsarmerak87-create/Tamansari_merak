import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { logSubmissionStorageError, SUBMISSION_DOCUMENT_BUCKET } from "@/services/submission-storage";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function logDokumenPath(label: string, meta: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    console.info(label, meta);
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const adminOnlyError = requireAdmin(session.profile);
    if (adminOnlyError) return jsonError("Hanya admin yang dapat mengunggah dokumen admin.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const formData = await request.formData();
    const pengajuanId = String(formData.get("pengajuan_id") ?? "");
    const file = formData.get("file") as File | null;

    if (!pengajuanId || !file) return jsonError("ID pengajuan dan file wajib diisi.");

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `pendukung/${pengajuanId}-${Date.now()}-${safeName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from(SUBMISSION_DOCUMENT_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { logSubmissionStorageError("admin_upload", uploadError); return jsonError("Dokumen belum dapat diakses. Silakan hubungi administrator.", 500); }
    const uploadedPath = uploadData.path;
    logDokumenPath("UPLOAD PATH", { bucket: SUBMISSION_DOCUMENT_BUCKET, path: uploadedPath, plannedPath: path, fileName: file.name });
    logDokumenPath("DATABASE PATH", { bucket: SUBMISSION_DOCUMENT_BUCKET, url_file: uploadedPath });

    const { data, error: insertError } = await supabase
        .from("dokumen_pengajuan")
        .insert({ pengajuan_id: pengajuanId, nama_file: file.name, jenis: "Hasil Surat", url_file: uploadedPath })
        .select("*")
        .single();

    if (insertError) return jsonError(insertError.message, 500);
    const { data: signed } = await supabase.storage.from(SUBMISSION_DOCUMENT_BUCKET).createSignedUrl(uploadedPath, 60 * 10);
    const url = signed?.signedUrl ?? "";
    return NextResponse.json({ ok: true, data, url });
}
