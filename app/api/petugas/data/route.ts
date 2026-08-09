import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeWorkflowRole } from "@/services/verification-workflow";

type AnyRow = Record<string, any>;
type VerificationRow = {
    id: string;
    pengajuan_id: string;
    tahap: number;
    nama_tahap: string;
    role_petugas: string;
    status: string;
    petugas_id: string | null;
    catatan: string | null;
    created_at: string | null;
    acted_at: string | null;
};

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }
function groupBy<T extends AnyRow>(rows: T[], key: keyof T): Map<string, T[]> { const map = new Map<string, T[]>(); for (const row of rows) { const value = String(row[key] ?? ""); if (!map.has(value)) map.set(value, []); map.get(value)?.push(row); } return map; }
function activeStatusFromStages(stages: AnyRow[] = []) { return stages.find((stage) => stage.status === "Diproses")?.nama_tahap ?? (stages.every((stage) => stage.status === "Disetujui") ? "Selesai" : "Menunggu"); }

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (!workflowRole) return jsonError("Role petugas tidak memiliki kewenangan workflow.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const detailId = request.nextUrl.searchParams.get("id");
    const isLurah = workflowRole === "lurah";

    const [activeResult, processedResult, returnedResult, allStagesResult, submissionsResult, officersResult, auditsResult] = await Promise.all([
        supabase.from("verifikasi_pengajuan").select("*").eq("role_petugas", workflowRole).eq("status", "Diproses").order("created_at", { ascending: false }),
        supabase.from("verifikasi_pengajuan").select("id", { count: "exact", head: true }).eq("petugas_id", session.profile.id).eq("status", "Disetujui"),
        supabase.from("verifikasi_pengajuan").select("id", { count: "exact", head: true }).eq("petugas_id", session.profile.id).eq("status", "Dikembalikan"),
        supabase.from("verifikasi_pengajuan").select("*").order("tahap", { ascending: true }),
        isLurah ? supabase.from("pengajuan_surat").select("*, layanan(*)").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        supabase.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active").eq("is_active", true),
        supabase.from("audit_pengajuan").select("*").eq("user_id", session.profile.id).order("created_at", { ascending: false }),
    ]);

    if (activeResult.error) return jsonError(activeResult.error.message, 500);
    if (processedResult.error) return jsonError(processedResult.error.message, 500);
    if (returnedResult.error) return jsonError(returnedResult.error.message, 500);
    if (allStagesResult.error) return jsonError(allStagesResult.error.message, 500);
    if (submissionsResult.error) return jsonError(submissionsResult.error.message, 500);
    if (officersResult.error) return jsonError(officersResult.error.message, 500);
    if (auditsResult.error) return jsonError(auditsResult.error.message, 500);

    const activeStages = (activeResult.data ?? []) as VerificationRow[];
    const allStages = (allStagesResult.data ?? []) as VerificationRow[];
    const activeIds = activeStages.map((stage) => stage.pengajuan_id);
    const submissionIds = Array.from(new Set([...(isLurah ? (submissionsResult.data ?? []).map((row) => row.id) : activeIds), detailId].filter(Boolean)));

    const [{ data: submissions, error: submissionError }, { data: documents, error: docError }, { data: tracking, error: trackingError }] = await Promise.all([
        submissionIds.length ? supabase.from("pengajuan_surat").select("*, layanan(*)").in("id", submissionIds) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? supabase.from("dokumen_pengajuan").select("*").in("pengajuan_id", submissionIds) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? supabase.from("tracking_pengajuan").select("*").in("pengajuan_id", submissionIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (submissionError) return jsonError(submissionError.message, 500);
    if (docError) return jsonError(docError.message, 500);
    if (trackingError) return jsonError(trackingError.message, 500);

    const submissionMap = new Map((submissions ?? []).map((row: AnyRow) => [String(row.id), row]));
    const officerMap = new Map((officersResult.data ?? []).map((row: AnyRow) => [String(row.id), row]));
    const docsByPengajuan = groupBy(documents ?? [], "pengajuan_id");
    const trackingByPengajuan = groupBy(tracking ?? [], "pengajuan_id");
    const stagesByPengajuan = groupBy(allStages.map((stage) => ({ ...stage, nama_petugas: stage.petugas_id ? officerMap.get(String(stage.petugas_id))?.nama_lengkap ?? officerMap.get(String(stage.petugas_id))?.username ?? null : null })), "pengajuan_id");

    function enrichStage(stage: VerificationRow): AnyRow {
        const pengajuan = submissionMap.get(stage.pengajuan_id);
        return { ...pengajuan, ...stage, id: stage.pengajuan_id, verifikasi_id: stage.id, active_stage: stage, workflow_status: stage.status, dokumen_pengajuan: docsByPengajuan.get(stage.pengajuan_id) ?? [], verifikasi_pengajuan: stagesByPengajuan.get(stage.pengajuan_id) ?? [], tracking_pengajuan: trackingByPengajuan.get(stage.pengajuan_id) ?? [] };
    }

    function enrichSubmission(row: AnyRow): AnyRow {
        const stages = stagesByPengajuan.get(String(row.id)) ?? [];
        return { ...row, workflow_status: activeStatusFromStages(stages), verifikasi_pengajuan: stages, dokumen_pengajuan: docsByPengajuan.get(String(row.id)) ?? [], tracking_pengajuan: trackingByPengajuan.get(String(row.id)) ?? [] };
    }

    const tasks = activeStages.map(enrichStage).filter((row) => row.nomor_pengajuan || row.nama_lengkap);
    const monitoring = isLurah ? (submissionsResult.data ?? []).map(enrichSubmission) : [];
    const detail = detailId ? (tasks.find((row) => row.id === detailId) ?? (submissionMap.get(detailId) ? enrichSubmission(submissionMap.get(detailId)!) : null)) : null;
    const stageCounts = [1, 2, 3, 4, 5].reduce<Record<string, number>>((acc, tahap) => { acc[String(tahap)] = allStages.filter((stage) => stage.tahap === tahap && stage.status === "Diproses").length; return acc; }, {});
    const totalResult = isLurah ? { total: (submissionsResult.data ?? []).length, selesai: (submissionsResult.data ?? []).filter((row: AnyRow) => row.status === "Selesai").length } : { total: 0, selesai: 0 };
    const stats = { menunggu: activeStages.length, diproses: processedResult.count ?? 0, dikembalikan: returnedResult.count ?? 0, lurah: { total: totalResult.total, staff: stageCounts["1"] ?? 0, lapangan: stageCounts["2"] ?? 0, kasi: stageCounts["3"] ?? 0, seklur: stageCounts["4"] ?? 0, lurah: stageCounts["5"] ?? 0, selesai: totalResult.selesai } };

    return NextResponse.json({ ok: true, petugas: session.profile, stats, tugas: tasks, data: { tasks, history: auditsResult.data ?? [], detail, officers: officersResult.data ?? [], monitoring, stats } });
}