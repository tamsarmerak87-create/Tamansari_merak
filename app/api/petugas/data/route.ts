import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeWorkflowRole } from "@/services/verification-workflow";
import { canHandleWargaStage, getActiveWargaStage, isPendingWargaVerification } from "@/services/warga-verification-workflow";

type AnyRow = Record<string, any>;
type VerificationRow = {
    id: string;
    pengajuan_id: string;
    tahap: number;
    nama_tahap: string;
    role_petugas: string;
    status: string;
    petugas_id: string | null;
    user_id?: string | null;
    catatan: string | null;
    created_at: string | null;
    acted_at: string | null;
};

function jsonError(message: string, status = 400) {
    console.error("[PETUGAS DETAIL DEBUG] response error", { status, message });
    return NextResponse.json({ ok: false, error: message }, { status });
}
function groupBy<T extends AnyRow>(rows: T[], key: keyof T): Map<string, T[]> { const map = new Map<string, T[]>(); for (const row of rows) { const value = String(row[key] ?? ""); if (!map.has(value)) map.set(value, []); map.get(value)?.push(row); } return map; }
function activeStatusFromStages(stages: AnyRow[] = []) { return stages.find((stage) => stage.status === "Diproses")?.nama_tahap ?? (stages.every((stage) => stage.status === "Disetujui") ? "Selesai" : "Menunggu"); }
function canAccessSubmission(stages: AnyRow[] = [], role: string, userId: string) {
    if (role === "lurah") return true;
    return stages.some((stage) => stage.petugas_id === userId || stage.user_id === userId);
}

function historyTime(row: AnyRow) { return String(row.created_at ?? row.acted_at ?? row.updated_at ?? ""); }

function wargaTask(row: AnyRow): AnyRow {
    const activeStage = getActiveWargaStage(row);
    return {
        ...row,
        id: row.id,
        task_type: "warga_verification",
        jenis_tugas: "Verifikasi Akun Warga",
        nomor_pengajuan: row.nomor_pengajuan ?? row.nik ?? row.id,
        layanan_nama: "Verifikasi Akun Warga",
        active_stage: activeStage ? { ...activeStage, role_petugas: activeStage.role, nama_tahap: activeStage.label, status: "Diproses" } : null,
    };
}

function wargaHistoryRows(rows: AnyRow[], role: string, petugasId: string) {
    return rows.flatMap((warga) => {
        const entries = Array.isArray(warga.verification_history) ? warga.verification_history : [];
        return entries
            .filter((entry: AnyRow) => entry.petugas_id === petugasId || entry.role === role || entry.role_petugas === role)
            .map((entry: AnyRow, index: number) => ({
                id: entry.id ?? `warga-${warga.id}-${entry.created_at ?? index}`,
                task_type: "warga_verification",
                jenis_tugas: "Verifikasi Akun Warga",
                warga_id: warga.id,
                nama_warga: entry.nama_warga ?? warga.nama_lengkap ?? warga.nama ?? "Warga",
                pengajuan: { id: warga.id, nama_lengkap: entry.nama_warga ?? warga.nama_lengkap ?? warga.nama, layanan_nama: "Verifikasi Akun Warga", nomor_pengajuan: warga.nik ?? warga.id },
                action: entry.action,
                aksi: entry.action,
                status: entry.status_sesudah ?? entry.status,
                status_sebelum: entry.status_sebelum ?? null,
                status_sesudah: entry.status_sesudah ?? entry.status ?? null,
                tahap: entry.tahap ?? entry.nama_tahap ?? entry.role ?? entry.role_petugas ?? null,
                catatan: entry.catatan ?? entry.alasan ?? null,
                role_petugas: entry.role_petugas ?? entry.role ?? role,
                petugas_id: entry.petugas_id ?? null,
                nama_petugas: entry.nama_petugas ?? null,
                created_at: entry.created_at ?? warga.updated_at ?? warga.created_at,
            }));
    });
}

function logDetailDebug(message: string, data: AnyRow) {
    console.info("[PETUGAS DETAIL DEBUG]", message, data);
}

async function withDocumentUrls(supabase: ReturnType<typeof createSupabaseAdminClient>, rows: AnyRow[] = []): Promise<AnyRow[]> {
    return Promise.all(rows.map(async (doc) => {
        const storagePath = String(doc.url_file ?? doc.file_path ?? doc.storage_path ?? "").trim();
        if (!storagePath || /^https?:\/\//i.test(storagePath)) return { ...doc, file_url: storagePath, storage_path: storagePath, status: doc.status ?? "Tersedia" };

        const { data, error } = await supabase.storage.from("surat").createSignedUrl(storagePath, 60 * 10);
        if (error) {
            logDetailDebug("error signed url dokumen", { pengajuanId: doc.pengajuan_id, dokumenId: doc.id, storagePath, bucket: "surat", errorQuery: error.message });
            return { ...doc, file_url: "", storage_path: storagePath, storage_error: "File tidak ditemukan di storage.", status: doc.status ?? "File tidak ditemukan" };
        }
        return { ...doc, file_url: data.signedUrl, signed_url: data.signedUrl, storage_path: storagePath, status: doc.status ?? "Tersedia" };
    }));
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "petugas" });
    const detailId = request.nextUrl.searchParams.get("id")?.trim() || null;
    if (session.error || !session.profile) {
        logDetailDebug("session/auth petugas tidak ditemukan", { idUrl: detailId, sessionError: session.error, status: 401 });
        return jsonError("Session petugas tidak valid.", 401);
    }
    if (!isPetugas(session.profile)) {
        logDetailDebug("session ada tetapi bukan role petugas", { idUrl: detailId, userId: session.profile.id, userName: session.profile.nama_lengkap ?? session.profile.username, userRole: session.profile.role, status: 403 });
        return jsonError("Akses khusus petugas.", 403);
    }
    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (!workflowRole) {
        logDetailDebug("role petugas tidak memiliki kewenangan workflow", { idUrl: detailId, userId: session.profile.id, userName: session.profile.nama_lengkap ?? session.profile.username, userRole: session.profile.role, status: 403 });
        return jsonError("Role petugas tidak memiliki kewenangan workflow.", 403);
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const isLurah = workflowRole === "lurah";

    logDetailDebug("request", { idUrl: detailId, userId: session.profile.id, userName: session.profile.nama_lengkap ?? session.profile.username, userRole: session.profile.role, workflowRole });

    const [activeResult, processedResult, returnedResult, allStagesResult, submissionsResult, officersResult, auditsResult, wargaResult] = await Promise.all([
        supabase.from("verifikasi_pengajuan").select("*").eq("role_petugas", workflowRole).eq("status", "Diproses").order("created_at", { ascending: false }),
        supabase.from("verifikasi_pengajuan").select("id", { count: "exact", head: true }).eq("petugas_id", session.profile.id).eq("status", "Disetujui"),
        supabase.from("verifikasi_pengajuan").select("id", { count: "exact", head: true }).eq("petugas_id", session.profile.id).eq("status", "Dikembalikan"),
        supabase.from("verifikasi_pengajuan").select("*").order("tahap", { ascending: true }),
        isLurah ? supabase.from("pengajuan_surat").select("*, layanan(*)").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        supabase.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active").eq("is_active", true),
        supabase.from("audit_pengajuan").select("*").eq("user_id", session.profile.id).order("created_at", { ascending: false }),
        supabase.from("warga_profiles").select("id,nama_lengkap,nama,nik,status_verifikasi,tahap_verifikasi,returned_to_role,handled_by,verification_history,alasan_penolakan,created_at,updated_at").order("updated_at", { ascending: false }),
    ]);

    if (activeResult.error) { logDetailDebug("error query active stages", { idUrl: detailId, errorQuery: activeResult.error.message }); return jsonError(activeResult.error.message, 500); }
    if (processedResult.error) { logDetailDebug("error query processed count", { idUrl: detailId, errorQuery: processedResult.error.message }); return jsonError(processedResult.error.message, 500); }
    if (returnedResult.error) { logDetailDebug("error query returned count", { idUrl: detailId, errorQuery: returnedResult.error.message }); return jsonError(returnedResult.error.message, 500); }
    if (allStagesResult.error) { logDetailDebug("error query all stages", { idUrl: detailId, errorQuery: allStagesResult.error.message }); return jsonError(allStagesResult.error.message, 500); }
    if (submissionsResult.error) { logDetailDebug("error query monitoring submissions", { idUrl: detailId, errorQuery: submissionsResult.error.message }); return jsonError(submissionsResult.error.message, 500); }
    if (officersResult.error) { logDetailDebug("error query officers", { idUrl: detailId, errorQuery: officersResult.error.message }); return jsonError(officersResult.error.message, 500); }
    if (auditsResult.error) { logDetailDebug("error query audits", { idUrl: detailId, errorQuery: auditsResult.error.message }); return jsonError(auditsResult.error.message, 500); }
    if (wargaResult.error) { logDetailDebug("error query warga verification", { idUrl: detailId, errorQuery: wargaResult.error.message }); return jsonError(wargaResult.error.message, 500); }

    const activeStages = (activeResult.data ?? []) as VerificationRow[];
    const allStages = (allStagesResult.data ?? []) as VerificationRow[];
    const activeIds = activeStages.map((stage) => stage.pengajuan_id);
    const listSubmissionIds = isLurah ? (submissionsResult.data ?? []).map((row) => row.id) : activeIds;
    const detailStageIds = detailId ? allStages.filter((stage) => stage.pengajuan_id === detailId).map((stage) => stage.pengajuan_id) : [];
    const submissionIds = Array.from(new Set([...listSubmissionIds, ...detailStageIds, detailId].filter(Boolean)));

    const [{ data: submissions, error: submissionError }, { data: documents, error: docError }, { data: tracking, error: trackingError }, { data: submissionAudits, error: submissionAuditError }] = await Promise.all([
        submissionIds.length ? supabase.from("pengajuan_surat").select("*, layanan(*)").in("id", submissionIds) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? supabase.from("dokumen_pengajuan").select("*").in("pengajuan_id", submissionIds) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? supabase.from("tracking_pengajuan").select("*").in("pengajuan_id", submissionIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? supabase.from("audit_pengajuan").select("*").in("pengajuan_id", submissionIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (submissionError) { logDetailDebug("error query detail submissions", { idUrl: detailId, submissionIds, errorQuery: submissionError.message }); return jsonError(submissionError.message, 500); }
    if (docError) { logDetailDebug("error query documents", { idUrl: detailId, submissionIds, errorQuery: docError.message }); return jsonError(docError.message, 500); }
    if (trackingError) { logDetailDebug("error query tracking", { idUrl: detailId, submissionIds, errorQuery: trackingError.message }); return jsonError(trackingError.message, 500); }
    if (submissionAuditError) { logDetailDebug("error query submission audits", { idUrl: detailId, submissionIds, errorQuery: submissionAuditError.message }); return jsonError(submissionAuditError.message, 500); }

    const signedDocuments = await withDocumentUrls(supabase, documents ?? []);
    const submissionMap = new Map((submissions ?? []).map((row: AnyRow) => [String(row.id), row]));
    let detailSubmission: AnyRow | null = null;
    if (detailId && !submissionMap.has(detailId)) {
        const { data, error } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", detailId).maybeSingle();
        if (error) {
            logDetailDebug("error query detail submission by id", { idUrl: detailId, errorQuery: error.message, status: 500 });
            return jsonError(error.message, 500);
        }
        detailSubmission = data;
        if (detailSubmission) submissionMap.set(String(detailSubmission.id), detailSubmission);
    }
    const officerMap = new Map((officersResult.data ?? []).map((row: AnyRow) => [String(row.id), row]));
    const docsByPengajuan = groupBy(signedDocuments, "pengajuan_id");
    const trackingByPengajuan = groupBy(tracking ?? [], "pengajuan_id");
    const auditsByPengajuan = groupBy(submissionAudits ?? [], "pengajuan_id");
    const stagesByPengajuan = groupBy(allStages.map((stage) => ({ ...stage, nama_petugas: stage.petugas_id ? officerMap.get(String(stage.petugas_id))?.nama_lengkap ?? officerMap.get(String(stage.petugas_id))?.username ?? null : null })), "pengajuan_id");

    function enrichStage(stage: VerificationRow): AnyRow {
        const pengajuan = submissionMap.get(stage.pengajuan_id);
        return { ...pengajuan, ...stage, id: stage.pengajuan_id, verifikasi_id: stage.id, active_stage: stage, workflow_status: stage.status, dokumen_pengajuan: docsByPengajuan.get(stage.pengajuan_id) ?? [], verifikasi_pengajuan: stagesByPengajuan.get(stage.pengajuan_id) ?? [], tracking_pengajuan: trackingByPengajuan.get(stage.pengajuan_id) ?? [], audit_pengajuan: auditsByPengajuan.get(stage.pengajuan_id) ?? [] };
    }

    function enrichSubmission(row: AnyRow): AnyRow {
        const stages = stagesByPengajuan.get(String(row.id)) ?? [];
        return { ...row, workflow_status: activeStatusFromStages(stages), verifikasi_pengajuan: stages, dokumen_pengajuan: docsByPengajuan.get(String(row.id)) ?? [], tracking_pengajuan: trackingByPengajuan.get(String(row.id)) ?? [], audit_pengajuan: auditsByPengajuan.get(String(row.id)) ?? [] };
    }

    const wargaRows = (wargaResult.data ?? []) as AnyRow[];
    const wargaTasks = wargaRows.filter((row) => isPendingWargaVerification(row) && canHandleWargaStage(session.profile!, row)).map(wargaTask);
    const pengajuanTasks: AnyRow[] = activeStages.map(enrichStage).filter((row) => row.nomor_pengajuan || row.nama_lengkap).map((row) => ({ ...row, task_type: "pengajuan_layanan", jenis_tugas: "Pengajuan Layanan" }));
    const tasks: AnyRow[] = [...wargaTasks, ...pengajuanTasks].sort((a, b) => new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime());
    const history: AnyRow[] = [...(auditsResult.data ?? []).map((row: AnyRow) => ({ ...row, task_type: "pengajuan_layanan", jenis_tugas: "Pengajuan Layanan" })), ...wargaHistoryRows(wargaRows, workflowRole, session.profile.id)].sort((a, b) => new Date(historyTime(b)).getTime() - new Date(historyTime(a)).getTime());
    const monitoring = isLurah ? (submissionsResult.data ?? []).map(enrichSubmission) : [];
    let detail: AnyRow | null = null;
    let detailError: { code: "NOT_FOUND" | "FORBIDDEN"; message: string } | null = null;
    if (detailId) {
        const submission = submissionMap.get(detailId) ?? detailSubmission;
        const detailStages = stagesByPengajuan.get(detailId) ?? [];
        const hasAccess = canAccessSubmission(detailStages, workflowRole, session.profile.id);
        const detailDocs = docsByPengajuan.get(detailId) ?? [];
        logDetailDebug("DETAIL PENGAJUAN DEBUG", { urlId: detailId, userId: session.profile.id, userName: session.profile.nama_lengkap ?? session.profile.username, userRole: session.profile.role, queryId: detailId, hasilQuery: { found: Boolean(submission), table: "pengajuan_surat", fieldId: "id", submissionIds, nomorPengajuan: submission?.nomor_pengajuan ?? null, namaPemohon: submission?.nama_lengkap ?? null, nik: submission?.nik ?? null, status: submission?.status ?? null }, errorQuery: null, jumlahDokumen: detailDocs.length, dokumen: detailDocs.map((doc) => ({ id: doc.id, jenis: doc.jenis, nama_file: doc.nama_file, storage_path: doc.storage_path, hasSignedUrl: Boolean(doc.signed_url), storage_error: doc.storage_error ?? null })), stages: detailStages.map((stage) => ({ id: stage.id, tahap: stage.tahap, role_petugas: stage.role_petugas, status: stage.status, petugas_id: stage.petugas_id, user_id: stage.user_id })), hasilPengecekanKewenangan: hasAccess });
        if (!submission) {
            detailError = { code: "NOT_FOUND", message: "Pengajuan tidak ditemukan." };
            logDetailDebug("kondisi A: pengajuan benar-benar tidak ditemukan", { idUrl: detailId, status: 404 });
        } else if (!hasAccess) {
            detailError = { code: "FORBIDDEN", message: "Pengajuan ada, tetapi bukan kewenangan petugas ini." };
            logDetailDebug("kondisi B: pengajuan ditemukan tetapi petugas tidak berwenang", { idUrl: detailId, userId: session.profile.id, userRole: session.profile.role, workflowRole, status: 403 });
        } else {
            detail = enrichSubmission(submission);
            detail.active_stage = detailStages.find((stage) => stage.status === "Diproses") ?? detailStages[0] ?? null;
            logDetailDebug("detail dapat diakses", { idUrl: detailId, userId: session.profile.id, userRole: session.profile.role, activeStage: detail.active_stage ? { id: detail.active_stage.id, tahap: detail.active_stage.tahap, role_petugas: detail.active_stage.role_petugas, status: detail.active_stage.status } : null });
        }
    }
    const stageCounts = [1, 2, 3, 4, 5].reduce<Record<string, number>>((acc, tahap) => { acc[String(tahap)] = allStages.filter((stage) => stage.tahap === tahap && stage.status === "Diproses").length; return acc; }, {});
    const totalResult = isLurah ? { total: (submissionsResult.data ?? []).length, selesai: (submissionsResult.data ?? []).filter((row: AnyRow) => row.status === "Selesai").length } : { total: 0, selesai: 0 };
    const stats = { menunggu: tasks.length, diproses: history.length, dikembalikan: history.filter((row) => /kembali|revisi|dikembalikan/i.test(`${row.action ?? row.aksi ?? row.status ?? row.status_sesudah ?? ""}`)).length, lurah: { total: totalResult.total, staff: stageCounts["1"] ?? 0, lapangan: stageCounts["2"] ?? 0, kasi: stageCounts["3"] ?? 0, seklur: stageCounts["4"] ?? 0, lurah: stageCounts["5"] ?? 0, selesai: totalResult.selesai } };

    return NextResponse.json({ ok: true, petugas: session.profile, stats, tugas: tasks, data: { tasks, wargaTasks, history, detail, detailError, officers: officersResult.data ?? [], monitoring, stats } });
}