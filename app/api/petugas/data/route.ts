import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { ROLE_STAGE_STATUS, normalizeWorkflowRole } from "@/services/verification-workflow";

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (!workflowRole) return jsonError("Role tidak menggunakan Tugas Saya sebagai petugas biasa.", 403);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);
    const requiredStatus = ROLE_STAGE_STATUS[workflowRole];
    const detailId = request.nextUrl.searchParams.get("id");

    const { data: tasks, error: tasksError } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("workflow_status", requiredStatus).order("created_at", { ascending: false });
    if (tasksError) return jsonError(tasksError.message, 500);
    const ids = Array.from(new Set([...(tasks ?? []).map((item) => item.id), detailId].filter(Boolean)));
    const [{ data: documents, error: docError }, { data: verification, error: verError }] = await Promise.all([
        ids.length ? supabase.from("dokumen_pengajuan").select("*").in("pengajuan_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("verifikasi_pengajuan").select("*").in("pengajuan_id", ids).order("tahap", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (docError) return jsonError(docError.message, 500);
    if (verError) return jsonError(verError.message, 500);
    const docMap = new Map<string, unknown[]>();
    for (const doc of documents ?? []) { const key = String(doc.pengajuan_id ?? ""); if (!docMap.has(key)) docMap.set(key, []); docMap.get(key)?.push(doc); }
    const verMap = new Map<string, unknown[]>();
    for (const row of verification ?? []) { const key = String(row.pengajuan_id ?? ""); if (!verMap.has(key)) verMap.set(key, []); verMap.get(key)?.push(row); }
    const enrichedTasks = (tasks ?? []).map((item) => ({ ...item, dokumen_pengajuan: docMap.get(String(item.id)) ?? [], verifikasi_pengajuan: verMap.get(String(item.id)) ?? [] }));

    const { data: audits, error: auditError } = await supabase.from("audit_pengajuan").select("*, pengajuan:pengajuan_surat(*)").eq("user_id", session.profile.id).order("created_at", { ascending: false });
    if (auditError) return jsonError(auditError.message, 500);
    let detail = detailId ? enrichedTasks.find((item) => item.id === detailId) ?? null : null;
    if (detailId && !detail) {
        const { data: row, error } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", detailId).eq("workflow_status", requiredStatus).maybeSingle();
        if (error) return jsonError(error.message, 500);
        detail = row ? { ...row, dokumen_pengajuan: docMap.get(detailId) ?? [], verifikasi_pengajuan: verMap.get(detailId) ?? [] } : null;
    }
    return NextResponse.json({ ok: true, data: { tasks: enrichedTasks, history: audits ?? [], detail } });
}