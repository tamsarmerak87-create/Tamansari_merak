import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { appendWargaHistory, canHandleWargaStage, getActiveWargaStage, getAssignedPetugasId, getValidReturnStages, getWargaStageByRole, isPendingWargaVerification, notifyPetugasTarget, notifyWargaAccount, resolveReturnStage, WARGA_WORKFLOW } from "@/services/warga-verification-workflow";

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
        supabase.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active"),
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
    return { ...row, active_stage: getActiveWargaStage(row), return_targets: getValidReturnStages(getActiveWargaStage(row)?.role), documents, profile_change_requests: changeRequests.data ?? [], handled_by_name: row.handled_by ? (officerMap.get(String(row.handled_by))?.nama_lengkap ?? officerMap.get(String(row.handled_by))?.username ?? row.handled_by) : null, verification_history: Array.isArray(row.verification_history) ? row.verification_history.map((h: Record<string, any>) => ({ ...h, nama_petugas: h.nama_petugas ?? (h.petugas_id ? officerMap.get(String(h.petugas_id))?.nama_lengkap : null) })) : [] };
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    const stage = getWargaStageByRole(session.profile.role);
    if (!stage) return jsonError("Role tidak memiliki tahap verifikasi warga.", 403);
    const supabase = createSupabaseAdminClient();
    const id = request.nextUrl.searchParams.get("id");
    let query = supabase.from("warga_profiles").select("*").order("created_at", { ascending: false });
    if (id) query = query.eq("id", id);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    const candidates = id ? data ?? [] : (data ?? []).filter(isPendingWargaVerification);
    const rows = candidates.filter((row) => canHandleWargaStage(session.profile!, row)).map((row) => {
        const activeStage = getActiveWargaStage(row);
        return { ...row, active_stage: activeStage, return_targets: getValidReturnStages(activeStage?.role) };
    });
    logWargaQueue("GET", { user_id: session.profile.id, role: session.profile.role, requested_id: id, total_found: data?.length ?? 0, pending_candidates: candidates.length, returned_rows: rows.length, sample: (data ?? []).slice(0, 10).map((row) => ({ id: row.id, status_verifikasi: row.status_verifikasi, tahap_verifikasi: row.tahap_verifikasi, returned_to_role: row.returned_to_role, handled_by: row.handled_by, active_role: getActiveWargaStage(row)?.role ?? null })) });
    const detail = id && rows[0] ? await enrichWargaDetail(supabase, rows[0]) : null;
    return NextResponse.json({ ok: true, data: id ? detail : rows, stage, return_targets: getValidReturnStages(session.profile.role) });
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    const body = await request.json();
    const wargaId = String(body.id ?? body.wargaId ?? "");
    const action = String(body.action ?? "");
    const alasan = String(body.alasan ?? body.catatan ?? "").trim();
    const requestedReturnRole = typeof body.returned_to_role === "string" ? body.returned_to_role : typeof body.returnToRole === "string" ? body.returnToRole : null;
    if (!wargaId) return jsonError("ID warga wajib diisi.");
    if (!["periksa", "setujui", "kembalikan", "tolak"].includes(action)) return jsonError("Aksi tidak valid.");
    if (["kembalikan", "tolak"].includes(action) && !alasan) return jsonError("Alasan wajib diisi.");
    const supabase = createSupabaseAdminClient();
    const { data: warga, error: findError } = await supabase.from("warga_profiles").select("*").eq("id", wargaId).maybeSingle();
    if (findError) return jsonError(findError.message, 500);
    if (!warga) return jsonError("Data warga tidak ditemukan.", 404);
    const stage = getActiveWargaStage(warga);
    if (!stage || !canHandleWargaStage(session.profile, warga)) return jsonError("Anda tidak berwenang menangani tahap akun warga ini.", 403);
    const currentIndex = WARGA_WORKFLOW.findIndex((s) => s.role === stage.role);
    const nextStage = WARGA_WORKFLOW[currentIndex + 1] ?? null;
    const finalApproved = action === "setujui" && stage.role === "lurah";
    if (action === "setujui" && stage.role !== "lurah" && !nextStage) return jsonError("Hanya Lurah yang dapat menyelesaikan verifikasi akun warga.", 403);
    const returnStage = action === "kembalikan" ? resolveReturnStage(stage.role, requestedReturnRole) : null;
    if (action === "kembalikan" && !returnStage) return jsonError("Tujuan pengembalian tidak valid untuk tahap ini.", 400);
    const nextStatus = action === "tolak" ? "Ditolak" : action === "kembalikan" ? "Dikembalikan" : action === "periksa" ? stage.status : finalApproved ? "Terverifikasi" : nextStage?.status;
    if (!nextStatus) return jsonError("Tahap berikutnya tidak valid.");
    const targetStage = action === "kembalikan" ? returnStage : action === "setujui" ? nextStage : stage;
    const assignedId = getAssignedPetugasId(warga);
    const nextHandledBy = action === "periksa" ? session.profile.id : assignedId && targetStage?.role === stage.role ? assignedId : null;
    const history = appendWargaHistory(warga, { action, status_sebelum: warga.status_verifikasi, status_sesudah: nextStatus, role: session.profile.role, petugas_id: session.profile.id, nama_petugas: session.profile.nama_lengkap ?? session.profile.username, catatan: alasan || null, returned_to_role: returnStage?.role ?? null });
    const updateQuery = supabase.from("warga_profiles").update({ status_verifikasi: nextStatus, tahap_verifikasi: finalApproved ? "Terverifikasi" : targetStage?.label ?? stage.label, handled_by: nextHandledBy, returned_to_role: returnStage?.role ?? null, alasan_penolakan: action === "tolak" ? alasan : null, verified_at: finalApproved ? new Date().toISOString() : null, verified_by: finalApproved ? session.profile.id : null, verification_history: history }).eq("id", wargaId);
    const { data, error } = await (assignedId ? updateQuery.eq("handled_by", assignedId) : updateQuery.is("handled_by", null)).select("*").single();
    if (error) return jsonError(error.message, 500);
    if (finalApproved) await notifyWargaAccount(warga, "Akun Terverifikasi", "Akun warga Anda sudah terverifikasi oleh Lurah.");
    else if (action === "tolak") await notifyWargaAccount(warga, "Akun Ditolak", "Verifikasi akun warga Anda ditolak.", alasan);
    else if (targetStage && action !== "periksa") await notifyPetugasTarget(targetStage, { ...warga, handled_by: nextHandledBy }, "Verifikasi Akun Warga", `${warga.nama_lengkap ?? warga.nik} menunggu tindakan ${targetStage.label}.`, { warga_id: wargaId, status: nextStatus, returned_to_role: returnStage?.role ?? null });
    return NextResponse.json({ ok: true, data });
}