import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { ROLE_STAGE_STATUS, normalizeSubmissionStatus, normalizeWorkflowRole } from "@/services/verification-workflow";

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

    const taskQuery = supabase.from("pengajuan_surat").select("*, layanan(*)").eq("workflow_status", requiredStatus).order("created_at", { ascending: false });
    const { data: tasks, error: tasksError } = await taskQuery;
    if (tasksError) return jsonError(tasksError.message, 500);
    const isLurah = workflowRole === "lurah";
    const { data: monitoringRows, error: monitoringError } = isLurah
        ? await supabase.from("pengajuan_surat").select("id,workflow_status,status").order("created_at", { ascending: false })
        : { data: [], error: null };
    if (monitoringError) return jsonError(monitoringError.message, 500);
    const ids = Array.from(new Set([...(tasks ?? []).map((item) => item.id), detailId].filter(Boolean)));
    const [{ data: documents, error: docError }, { data: verification, error: verError }, { data: tracking, error: trackingError }] = await Promise.all([
        ids.length ? supabase.from("dokumen_pengajuan").select("*").in("pengajuan_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("verifikasi_pengajuan").select("*").in("pengajuan_id", ids).order("tahap", { ascending: true }) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from("tracking_pengajuan").select("*").in("pengajuan_id", ids).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (docError) return jsonError(docError.message, 500);
    if (verError) return jsonError(verError.message, 500);
    if (trackingError) return jsonError(trackingError.message, 500);
    const { data: officers, error: officersError } = await supabase.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active").eq("is_active", true);
    if (officersError) return jsonError(officersError.message, 500);
    const officerMap = new Map((officers ?? []).map((officer) => [String(officer.id), officer]));

    const docMap = new Map<string, unknown[]>();
    for (const doc of documents ?? []) { const key = String(doc.pengajuan_id ?? ""); if (!docMap.has(key)) docMap.set(key, []); docMap.get(key)?.push(doc); }
    const verMap = new Map<string, unknown[]>();
    for (const row of verification ?? []) {
        const key = String(row.pengajuan_id ?? "");
        const officer = row.petugas_id ? officerMap.get(String(row.petugas_id)) : null;
        if (!verMap.has(key)) verMap.set(key, []);
        verMap.get(key)?.push({ ...row, nama_petugas: officer?.nama_lengkap ?? officer?.username ?? null, petugas_detail: officer ?? null });
    }
    const trackingMap = new Map<string, unknown[]>();
    for (const row of tracking ?? []) { const key = String(row.pengajuan_id ?? ""); if (!trackingMap.has(key)) trackingMap.set(key, []); trackingMap.get(key)?.push(row); }
    const enrichedTasks = (tasks ?? []).map((item) => ({ ...item, workflow_status: normalizeSubmissionStatus(item.workflow_status ?? item.status), dokumen_pengajuan: docMap.get(String(item.id)) ?? [], verifikasi_pengajuan: verMap.get(String(item.id)) ?? [], tracking_pengajuan: trackingMap.get(String(item.id)) ?? [] }));

    const { data: audits, error: auditError } = await supabase.from("audit_pengajuan").select("*").eq("user_id", session.profile.id).order("created_at", { ascending: false });
    if (auditError) return jsonError(auditError.message, 500);
    let detail = detailId ? enrichedTasks.find((item) => item.id === detailId) ?? null : null;
    if (detailId && !detail) {
        const detailQuery = supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", detailId);
        const { data: row, error } = isLurah ? await detailQuery.maybeSingle() : await detailQuery.eq("workflow_status", requiredStatus).maybeSingle();
        if (error) return jsonError(error.message, 500);
        detail = row ? { ...row, workflow_status: normalizeSubmissionStatus(row.workflow_status ?? row.status), dokumen_pengajuan: docMap.get(detailId) ?? [], verifikasi_pengajuan: verMap.get(detailId) ?? [], tracking_pengajuan: trackingMap.get(detailId) ?? [] } : null;
    }
    const stats = { menunggu: enrichedTasks.length, diproses: 0, dikembalikan: (audits ?? []).filter((item) => /revisi|kembali/i.test(String(item.action ?? item.status ?? ""))).length };
    return NextResponse.json({ ok: true, petugas: session.profile, stats, tugas: enrichedTasks, data: { tasks: enrichedTasks, history: audits ?? [], detail, officers: officers ?? [], monitoring: monitoringRows ?? [] } });
}