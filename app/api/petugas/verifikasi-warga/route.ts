import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { appendWargaHistory, canHandleWargaStage, getActiveWargaStage, getAssignedPetugasId, getValidReturnStages, getWargaStageByRole, isPendingWargaVerification, notifyPetugasTarget, notifyWargaAccount, resolveReturnStage, WARGA_WORKFLOW } from "@/services/warga-verification-workflow";

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

function logWargaQueue(message: string, data: Record<string, any>) {
    console.info("[WARGA VERIFICATION QUEUE]", message, data);
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
    const rows = candidates.filter((row) => canHandleWargaStage(session.profile!, row)).map((row) => ({ ...row, active_stage: getActiveWargaStage(row), return_targets: getValidReturnStages(session.profile!.role) }));
    logWargaQueue("GET", { user_id: session.profile.id, role: session.profile.role, requested_id: id, total_found: data?.length ?? 0, pending_candidates: candidates.length, returned_rows: rows.length, sample: (data ?? []).slice(0, 10).map((row) => ({ id: row.id, status_verifikasi: row.status_verifikasi, tahap_verifikasi: row.tahap_verifikasi, returned_to_role: row.returned_to_role, handled_by: row.handled_by, active_role: getActiveWargaStage(row)?.role ?? null })) });
    return NextResponse.json({ ok: true, data: id ? rows[0] ?? null : rows, stage, return_targets: getValidReturnStages(session.profile.role) });
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
    const { data, error } = await supabase.from("warga_profiles").update({ status_verifikasi: nextStatus, tahap_verifikasi: finalApproved ? "Terverifikasi" : targetStage?.label ?? stage.label, handled_by: nextHandledBy, returned_to_role: returnStage?.role ?? null, alasan_penolakan: action === "tolak" ? alasan : null, verified_at: finalApproved ? new Date().toISOString() : null, verified_by: finalApproved ? session.profile.id : null, verification_history: history }).eq("id", wargaId).select("*").single();
    if (error) return jsonError(error.message, 500);
    if (finalApproved) await notifyWargaAccount(warga, "Akun Terverifikasi", "Akun warga Anda sudah terverifikasi oleh Lurah.");
    else if (action === "tolak") await notifyWargaAccount(warga, "Akun Ditolak", "Verifikasi akun warga Anda ditolak.", alasan);
    else if (targetStage && action !== "periksa") await notifyPetugasTarget(targetStage, { ...warga, handled_by: nextHandledBy }, "Verifikasi Akun Warga", `${warga.nama_lengkap ?? warga.nik} menunggu tindakan ${targetStage.label}.`, { warga_id: wargaId, status: nextStatus, returned_to_role: returnStage?.role ?? null });
    return NextResponse.json({ ok: true, data });
}