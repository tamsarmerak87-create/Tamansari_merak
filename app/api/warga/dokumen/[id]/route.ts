import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import { getDocumentManagementPolicy, isServiceResultDocument, normalizeSuratObjectPath, type DokumenPengajuan } from "@/services/warga-pengajuan.service";
import { DOCUMENT_UNAVAILABLE_MESSAGE, logSubmissionStorageError, SUBMISSION_DOCUMENT_BUCKET } from "@/services/submission-storage";
import { renderOfficialLetterPdfRoute } from "@/services/official-letter-pdf";
import { isFinalDocument } from "@/services/official-document";

type RouteContext = { params: Promise<{ id: string }> };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET = SUBMISSION_DOCUMENT_BUCKET;
const MAX_FILE_SIZE = 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function error(message: string, status: number) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function safeDisplayName(value: unknown) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/[<>\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ");
}

async function ownedManageableDocument(request: NextRequest, id: string) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { response: error("Silakan login terlebih dahulu.", 401) };
    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return { response: error("Session warga tidak valid.", 401) };

    const user = authData.user;
    let profileResult = await supabase.from("warga_profiles").select("id,nik").eq("id", user.id).maybeSingle();
    if (!profileResult.data && !profileResult.error) profileResult = await supabase.from("warga_profiles").select("id,nik").eq("user_id", user.id).maybeSingle();
    if (!profileResult.data && user.email) profileResult = await supabase.from("warga_profiles").select("id,nik").eq("email", user.email).maybeSingle();
    if (profileResult.error || !profileResult.data?.nik) return { response: error("Profil warga tidak ditemukan.", 404) };

    const { data: document, error: documentError } = await supabase.from("dokumen_pengajuan")
        .select("id,pengajuan_id,nama_file,jenis,url_file,created_at,status,metadata")
        .eq("id", id).maybeSingle();
    if (documentError) throw documentError;
    if (!document) return { response: error("Dokumen tidak ditemukan.", 404) };

    const { data: submission, error: submissionError } = await supabase.from("pengajuan_surat").select("id,nik").eq("id", document.pengajuan_id).maybeSingle();
    if (submissionError) throw submissionError;
    if (!submission || submission.nik !== profileResult.data.nik) return { response: error("Dokumen bukan milik akun ini.", 403) };
    if (getDocumentManagementPolicy(document as DokumenPengajuan) !== "MANAGEABLE") {
        return { response: error("Dokumen ini terkunci dan tidak dapat dikelola dari Dokumen Saya.", 403) };
    }
    return { supabase, user, document: document as DokumenPengajuan };
}

function safeFileName(value?: string | null) {
    const normalized = (value || "dokumen").normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
    return normalized.slice(0, 120) || "dokumen";
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        if (!UUID_REGEX.test(id)) return error("ID dokumen tidak valid.", 400);
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!token) return error("Silakan login terlebih dahulu.", 401);
        const supabase = createSupabaseAdminClient();
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) return error("Session warga tidak valid.", 401);
        let profile = await supabase.from("warga_profiles").select("nik").eq("id", authData.user.id).maybeSingle();
        if (!profile.data && !profile.error) profile = await supabase.from("warga_profiles").select("nik").eq("user_id", authData.user.id).maybeSingle();
        if (!profile.data && authData.user.email) profile = await supabase.from("warga_profiles").select("nik").eq("email", authData.user.email).maybeSingle();
        if (profile.error || !profile.data?.nik) return error("Profil warga tidak ditemukan.", 404);
        const { data: document, error: documentError } = await supabase.from("dokumen_pengajuan")
        .select("id,pengajuan_id,nama_file,jenis,url_file,status,metadata,pengajuan_surat!inner(*,layanan(nama))").eq("id", id).maybeSingle();
        if (documentError) throw documentError;
        const submission = Array.isArray(document?.pengajuan_surat) ? document.pengajuan_surat[0] : document?.pengajuan_surat;
        if (!document) return error("Dokumen tidak ditemukan.", 404);
        if (!submission || submission.nik !== profile.data.nik) return error("Dokumen bukan milik akun ini.", 403);
        // A final letter is identified by the authoritative submission contract,
        // never by the storage object's name or MIME type.
        const isIssuedLetter = isServiceResultDocument(document as DokumenPengajuan) && isFinalDocument(submission);
        if (isIssuedLetter) {
            return renderOfficialLetterPdfRoute(request, { params: Promise.resolve({ token: submission.verification_token }) });
        }
        const path = normalizeSuratObjectPath(document.url_file);
        if (!path) return error(DOCUMENT_UNAVAILABLE_MESSAGE, 404);
        const { data: file, error: storageError } = await supabase.storage.from(BUCKET).download(path);
        if (storageError || !file) {
            logSubmissionStorageError(request.nextUrl.searchParams.get("download") === "1" ? "download" : "view", storageError);
            return error(DOCUMENT_UNAVAILABLE_MESSAGE, 404);
        }
        const contentType = file.type || String((document.metadata as Record<string, unknown> | null)?.mime_type || "application/octet-stream");
        const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
        const layanan = Array.isArray(submission.layanan) ? submission.layanan[0] : submission.layanan;
        const responseFileName = isIssuedLetter
            ? `${String(layanan?.nama ?? "Surat").replace(/^Surat\s+/i, "Surat-")}-${submission.nomor_pengajuan ?? document.pengajuan_id}.pdf`
            : document.nama_file;
        return new NextResponse(file, { headers: {
            "Content-Type": contentType,
            "Content-Length": String(file.size),
            "Content-Disposition": `${disposition}; filename="${safeFileName(responseFileName)}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        } });
    } catch (cause) {
        logSubmissionStorageError(request.nextUrl.searchParams.get("download") === "1" ? "download" : "view", cause);
        return error(DOCUMENT_UNAVAILABLE_MESSAGE, 500);
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        if (!UUID_REGEX.test(id)) return error("ID dokumen tidak valid.", 400);
        const owned = await ownedManageableDocument(request, id);
        if ("response" in owned) return owned.response;
        const contentType = request.headers.get("content-type") ?? "";

        if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            if (form.get("action") !== "replace") return error("Aksi dokumen tidak valid.", 400);
            const file = form.get("file");
            if (!(file instanceof File) || file.size === 0) return error("File pengganti wajib dipilih.", 400);
            if (file.size > MAX_FILE_SIZE) return error("Ukuran file maksimal 1 MB.", 400);
            if (!ALLOWED_TYPES.has(file.type)) return error("Format file hanya PDF, JPG, PNG, atau WEBP.", 400);
            const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
            const newPath = `warga/${owned.user.id}/dokumen/${id}/${Date.now()}.${ext}`;
            const uploaded = await owned.supabase.storage.from(BUCKET).upload(newPath, file, { upsert: false, contentType: file.type });
            if (uploaded.error) throw uploaded.error;
            const metadata = { ...(owned.document.metadata ?? {}), size: file.size, mime_type: file.type, replaced_at: new Date().toISOString() };
            const updated = await owned.supabase.from("dokumen_pengajuan").update({ url_file: uploaded.data.path, metadata }).eq("id", id).eq("pengajuan_id", owned.document.pengajuan_id).select("id").maybeSingle();
            if (updated.error || !updated.data) {
                await owned.supabase.storage.from(BUCKET).remove([uploaded.data.path]);
                if (updated.error) throw updated.error;
                return error("Dokumen berubah. Muat ulang lalu coba lagi.", 409);
            }
            const oldPath = normalizeSuratObjectPath(owned.document.url_file);
            if (oldPath && oldPath !== uploaded.data.path) await owned.supabase.storage.from(BUCKET).remove([oldPath]);
            return NextResponse.json({ ok: true, message: "Dokumen berhasil diupload ulang." });
        }

        const body = await request.json().catch(() => null) as { action?: unknown; display_name?: unknown } | null;
        if (body?.action !== "rename") return error("Aksi dokumen tidak valid.", 400);
        const displayName = safeDisplayName(body.display_name);
        if (displayName.length < 1 || displayName.length > 100) return error("Nama dokumen harus 1-100 karakter.", 400);
        const metadata = { ...(owned.document.metadata ?? {}), display_name: displayName };
        const updated = await owned.supabase.from("dokumen_pengajuan").update({ metadata }).eq("id", id).eq("pengajuan_id", owned.document.pengajuan_id).select("id").maybeSingle();
        if (updated.error) throw updated.error;
        if (!updated.data) return error("Dokumen berubah. Muat ulang lalu coba lagi.", 409);
        return NextResponse.json({ ok: true, message: "Nama dokumen berhasil diubah." });
    } catch (cause) {
        console.error("PATCH /api/warga/dokumen/[id]", cause);
        return error("Dokumen gagal diperbarui.", 500);
    }
}

// POST is supported for clients that model file replacement as an upload action.
export async function POST(request: NextRequest, context: RouteContext) {
    return PATCH(request, context);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        if (!UUID_REGEX.test(id)) return error("ID dokumen tidak valid.", 400);
        const owned = await ownedManageableDocument(request, id);
        if ("response" in owned) return owned.response;
        const deleted = await owned.supabase.from("dokumen_pengajuan").delete().eq("id", id).eq("pengajuan_id", owned.document.pengajuan_id).select("id").maybeSingle();
        if (deleted.error) throw deleted.error;
        if (!deleted.data) return error("Dokumen berubah. Muat ulang lalu coba lagi.", 409);
        const path = normalizeSuratObjectPath(owned.document.url_file);
        if (path) await owned.supabase.storage.from(BUCKET).remove([path]);
        return NextResponse.json({ ok: true, message: "Dokumen berhasil dihapus." });
    } catch (cause) {
        console.error("DELETE /api/warga/dokumen/[id]", cause);
        return error("Dokumen gagal dihapus.", 500);
    }
}