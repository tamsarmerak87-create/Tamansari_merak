import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isAdmin, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { canHandleWargaStage, getActiveWargaStage, getValidReturnStages, getWargaStageByRole, isPendingWargaVerification, processWargaVerificationAction } from "@/services/warga-verification-workflow";

const CHANGE_DOCUMENT_BUCKET = "profile-change-documents";
const PROFILE_PHOTO_BUCKET = "avatars";

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

function logWargaQueue(message: string, data: Record<string, any>) {
    console.info("[WARGA VERIFICATION QUEUE]", message, data);
}

function fileNameFromPath(path?: string | null) { return String(path ?? "").split("/").pop() || "Dokumen"; }
function guessType(path?: string | null) { const ext = fileNameFromPath(path).split(".").pop()?.toLowerCase(); if (ext === "pdf") return "PDF"; if (["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) return "Gambar"; return ext ? ext.toUpperCase() : "File"; }
async function signedStorageUrl(supabase: ReturnType<typeof createSupabaseAdminClient>, bucket: string, path?: string | null) {
    const cleanPath = String(path ?? "").replace(/^\/+/, "");
    if (!cleanPath) return { url: "", meta: null as Record<string, any> | null };
    if (/^https?:\/\//i.test(cleanPath)) return { url: cleanPath, meta: null };
    const [{ data: signed }, { data: meta }] = await Promise.all([
        supabase.storage.from(bucket).createSignedUrl(cleanPath, 60 * 10),
        supabase.storage.from(bucket).list(cleanPath.split("/").slice(0, -1).join("/"), { search: fileNameFromPath(cleanPath), limit: 1 }),
    ]);
    return { url: signed?.signedUrl ?? "", meta: meta?.find((item) => item.name === fileNameFromPath(cleanPath)) ?? null };
}

async function enrichWargaDetail(supabase: ReturnType<typeof createSupabaseAdminClient>, row: Record<string, any>) {
    const [officers, changeRequests] = await Promise.all([
        supabase.from("petugas").select("id,username,nama_lengkap,nip,jabatan,role,is_active"),
        supabase.from("warga_profile_change_requests").select("id,change_request_id,user_id,profile_id,jenis_perubahan,data_lama,data_baru,alasan,dokumen_pendukung,status,alasan_petugas,created_at,verified_at,verified_by").eq("profile_id", row.id).order("created_at", { ascending: false }),
    ]);
    const officerMap = new Map((officers.data ?? []).map((p: Record<string, any>) => [String(p.id), p]));
    const documents: Record<string, any>[] = [];
    if (row.foto_url) {
        const { url, meta } = await signedStorageUrl(supabase, PROFILE_PHOTO_BUCKET, row.foto_url);
        documents.push({ id: "foto-profil", nama_dokumen: "Foto Profil", jenis_dokumen: "Foto Profil", nama_file: fileNameFromPath(row.foto_url), file_url: url, preview_url: url, tipe_file: guessType(row.foto_url), ukuran_file: meta?.metadata?.size ?? meta?.metadata?.contentLength ?? null, uploaded_at: meta?.created_at ?? row.updated_at ?? row.created_at, status: url ? "Dokumen tersedia" : "File tidak ditemukan" });
    }
    for (const req of changeRequests.data ?? []) {
        if (!req.dokumen_pendukung) continue;
        const { url, meta } = await signedStorageUrl(supabase, CHANGE_DOCUMENT_BUCKET, req.dokumen_pendukung);
        documents.push({ id: req.id, nama_dokumen: `Dokumen Pendukung ${req.jenis_perubahan}`, jenis_dokumen: "Dokumen Pendukung", nama_file: fileNameFromPath(req.dokumen_pendukung), file_url: url, preview_url: url, tipe_file: guessType(req.dokumen_pendukung), ukuran_file: meta?.metadata?.size ?? meta?.metadata?.contentLength ?? null, uploaded_at: req.created_at, status: req.status ?? (url ? "Dokumen tersedia" : "File tidak ditemukan"), change_request: req });
    }
    const verificationHistory = Array.isArray(row.verification_history) ? row.verification_history.map((h: Record<string, any>) => {
        const officer = h.petugas_id ? officerMap.get(String(h.petugas_id)) : null;
        return { ...h, nama_petugas: officer?.nama_lengkap ?? officer?.username ?? h.nama_petugas ?? null };
    }) : [];
    const latestHistoryOfficer = ([...verificationHistory] as Record<string, any>[]).reverse().find((h) => h.petugas_id || h.nama_petugas);
    const source = row.handled_by
        ? { id: row.handled_by, storedName: null }
        : latestHistoryOfficer
            ? { id: latestHistoryOfficer.petugas_id ?? null, storedName: latestHistoryOfficer.nama_petugas ?? null }
            : row.verified_by
                ? { id: row.verified_by, storedName: null }
                : null;
    const assignedOfficer = source?.id ? officerMap.get(String(source.id)) : null;
    const handledByName = assignedOfficer?.nama_lengkap ?? assignedOfficer?.username ?? source?.storedName ?? null;
    return { ...row, active_stage: getActiveWargaStage(row), return_targets: getValidReturnStages(getActiveWargaStage(row)?.role), documents, profile_change_requests: changeRequests.data ?? [], handled_by_name: handledByName, handled_by_nip: assignedOfficer?.nip ?? null, handled_by_jabatan: assignedOfficer?.jabatan ?? null, handled_by_role: assignedOfficer?.role ?? null, verification_history: verificationHistory };
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "any" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!isAdmin(session.profile) && !isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    const stage = getWargaStageByRole(session.profile.role);
    const supabase = createSupabaseAdminClient();
    const id = request.nextUrl.searchParams.get("id");
    let query = supabase.from("warga_profiles").select("*").order("created_at", { ascending: false });
    if (id) query = query.eq("id", id);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    const candidates = (data ?? []).filter((row) => {
        const activeStage = getActiveWargaStage(row);
        if (!activeStage || (!isAdmin(session.profile) && activeStage.role !== stage?.role)) return false;
        return isPendingWargaVerification(row) && canHandleWargaStage(session.profile!, row);
    });
    const rows = candidates.map((row) => {
        const activeStage = getActiveWargaStage(row);
        return { ...row, status_antrean: activeStage?.status ?? null, active_stage: activeStage, return_targets: getValidReturnStages(activeStage?.role) };
    });
    logWargaQueue("GET", { user_id: session.profile.id, role: session.profile.role, requested_id: id, total_found: data?.length ?? 0, pending_candidates: candidates.length, returned_rows: rows.length, sample: (data ?? []).slice(0, 10).map((row) => ({ id: row.id, status_verifikasi: row.status_verifikasi, tahap_verifikasi: row.tahap_verifikasi, returned_to_role: row.returned_to_role, handled_by: row.handled_by, active_role: getActiveWargaStage(row)?.role ?? null })) });
    const detail = id && rows[0] ? await enrichWargaDetail(supabase, rows[0]) : null;
    return NextResponse.json({ ok: true, data: id ? detail : rows, stage: stage ?? "ADMIN", return_targets: getValidReturnStages(stage?.role) });
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "any" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!isAdmin(session.profile) && !isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    const body = await request.json();
    const wargaId = String(body.id ?? body.wargaId ?? "");
    const action = String(body.action ?? "");
    const alasan = String(body.alasan ?? body.catatan ?? "").trim();
    const requestedReturnRole = typeof body.returned_to_role === "string" ? body.returned_to_role : typeof body.returnToRole === "string" ? body.returnToRole : null;
    if (!wargaId) return jsonError("ID warga wajib diisi.");
    if (!["periksa", "simpan", "setujui", "kembalikan", "tolak"].includes(action)) return jsonError("Aksi tidak valid.");
    if (["kembalikan", "tolak"].includes(action) && !alasan) return jsonError("Alasan wajib diisi.");
    try {
        const data = await processWargaVerificationAction({ wargaId, action: action as any, petugas: session.profile, catatan: alasan, returnedToRole: requestedReturnRole, pemeriksaan: body.pemeriksaan ?? null });
        return NextResponse.json({ ok: true, data });
    } catch (error: any) {
        return jsonError(error?.message ?? "Verifikasi akun gagal.", /berwenang/i.test(error?.message ?? "") ? 403 : 400);
    }
}