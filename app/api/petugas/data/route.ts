import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { DOCUMENT_UNAVAILABLE_MESSAGE, logSubmissionStorageError, normalizeSubmissionObjectPath, SUBMISSION_DOCUMENT_BUCKET } from "@/services/submission-storage";
import { ROLE_STAGE_STATUS, STAGE_WAITING_STATUS, getActiveStage, isFinalSubmissionStatus, normalizeSubmissionStatus, normalizeWorkflowRole } from "@/services/verification-workflow";
import { canHandleWargaStage, getActiveWargaStage, isPendingWargaVerification } from "@/services/warga-verification-workflow";

type AnyRow = Record<string, any>;
type SafeResult<T> = { data: T; error: AnyRow | null };
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

function jsonError(message: string, status = 400) {
    console.error("[PETUGAS DETAIL DEBUG] response error", { status, message });
    return NextResponse.json({ ok: false, error: message }, { status });
}
function logDataError(label: string, data: AnyRow) { console.error("[PETUGAS DATA ERROR]", label, data); }
function groupBy<T extends AnyRow>(rows: T[], key: keyof T): Map<string, T[]> { const map = new Map<string, T[]>(); for (const row of rows) { const value = String(row[key] ?? ""); if (!map.has(value)) map.set(value, []); map.get(value)?.push(row); } return map; }
function activeStatusFromStages(stages: AnyRow[] = []) { return stages.find((stage) => stage.status === "Diproses")?.nama_tahap ?? (stages.every((stage) => stage.status === "Disetujui") ? "Selesai" : "Menunggu"); }
function canAccessSubmission(stages: AnyRow[] = [], role: string, userId: string) {
    if (role === "lurah") return true;
    return stages.some((stage) => stage.role_petugas === role && ["Menunggu", "Diproses"].includes(String(stage.status ?? ""))) || stages.some((stage) => stage.petugas_id === userId);
}

function submissionWaitingForRole(row: AnyRow, role: string) {
    const activeStage = row.active_stage ?? null;
    const activeStageWaitingStatus = activeStage?.tahap ? STAGE_WAITING_STATUS[Number(activeStage.tahap)] : null;
    const rawWorkflowStatus = row.workflow_status ?? activeStageWaitingStatus ?? row.status ?? "";
    if (isFinalSubmissionStatus(String(rawWorkflowStatus))) return false;
    const normalizedStatus = normalizeSubmissionStatus(String(rawWorkflowStatus));
    const requiredStatus = ROLE_STAGE_STATUS[role as keyof typeof ROLE_STAGE_STATUS];
    if (activeStage?.role_petugas === role && ["Menunggu", "Diproses"].includes(String(activeStage?.status ?? ""))) return true;
    if (normalizedStatus === requiredStatus) return true;
    return role === "staff_pelayanan" && ["MENUNGGU_STAFF", "MENUNGGU_VERIFIKASI"].includes(String(normalizedStatus));
}

function historyTime(row: AnyRow) { return String(row.created_at ?? row.acted_at ?? row.updated_at ?? ""); }

function wargaTask(row: AnyRow): AnyRow {
    const activeStage = getActiveWargaStage(row);
    return {
        ...row,
        id: row.id,
        nama: row.nama_lengkap ?? row.nama ?? null,
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

function logTugasDebug(data: AnyRow) {
    if (process.env.NODE_ENV === "production") return;
    console.info("[PETUGAS TUGAS DEBUG]", data);
}

async function safeRows<T extends AnyRow>(label: string, query: PromiseLike<{ data: T[] | null; error: AnyRow | null }>, warnings: AnyRow[]): Promise<SafeResult<T[]>> {
    const { data, error } = await query;
    if (error) {
        logDataError(label, { message: error.message, code: error.code, details: error.details, hint: error.hint });
        warnings.push({ source: label, message: error.message, code: error.code ?? null });
        return { data: [], error };
    }
    return { data: data ?? [], error: null };
}

async function safeMaybeSingle<T extends AnyRow>(label: string, query: PromiseLike<{ data: T | null; error: AnyRow | null }>, warnings: AnyRow[]): Promise<SafeResult<T | null>> {
    const { data, error } = await query;
    if (error) {
        logDataError(label, { message: error.message, code: error.code, details: error.details, hint: error.hint });
        warnings.push({ source: label, message: error.message, code: error.code ?? null });
        return { data: null, error };
    }
    return { data: data ?? null, error: null };
}

async function withDocumentUrls(supabase: ReturnType<typeof createSupabaseAdminClient>, rows: AnyRow[] = []): Promise<AnyRow[]> {
    return Promise.all(rows.map(async (doc) => {
        const storagePath = normalizeSubmissionObjectPath(String(doc.url_file ?? doc.file_path ?? doc.storage_path ?? ""));
        if (!storagePath || /^https?:\/\//i.test(storagePath)) return { ...doc, file_url: storagePath, storage_path: storagePath, status: doc.status ?? "Tersedia" };

        const { data, error } = await supabase.storage.from(SUBMISSION_DOCUMENT_BUCKET).createSignedUrl(storagePath, 60 * 10);
        if (error) {
            logSubmissionStorageError("petugas_view", error);
            return { ...doc, file_url: "", storage_path: storagePath, storage_error: DOCUMENT_UNAVAILABLE_MESSAGE, status: doc.status ?? "File tidak ditemukan" };
        }
        return { ...doc, file_url: data.signedUrl, signed_url: data.signedUrl, storage_path: storagePath, status: doc.status ?? "Tersedia" };
    }));
}

async function signedUrlFromProfileDocumentBucket(supabase: ReturnType<typeof createSupabaseAdminClient>, path?: string | null) {
    const storagePath = String(path ?? "").trim();
    if (!storagePath) return { signedUrl: "", error: "Path dokumen identitas tidak tersedia.", errorCode: "IDENTITY_DOCUMENT_PATH_MISSING", bucket: "profile-change-documents" };
    const { data, error } = await supabase.storage.from("profile-change-documents").createSignedUrl(storagePath, 60 * 10);
    if (error) {
        logDetailDebug("error signed url identitas", { storagePath, bucket: "profile-change-documents", errorQuery: error.message });
        return { signedUrl: "", error: error.message, errorCode: "IDENTITY_DOCUMENT_SIGN_FAILED", bucket: "profile-change-documents" };
    }
    if (!data?.signedUrl) {
        logDetailDebug("signed url identitas kosong", { storagePath, bucket: "profile-change-documents" });
        return { signedUrl: "", error: "Storage tidak mengembalikan signed URL.", errorCode: "IDENTITY_DOCUMENT_SIGNED_URL_EMPTY", bucket: "profile-change-documents" };
    }
    return { signedUrl: data.signedUrl, error: null, errorCode: null, bucket: "profile-change-documents" };
}

async function withIdentityUrls(supabase: ReturnType<typeof createSupabaseAdminClient>, rows: AnyRow[] = [], requestsByProfile = new Map<string, AnyRow[]>): Promise<AnyRow[]> {
    return Promise.all(rows.map(async (row) => {
        const requests = requestsByProfile.get(String(row.warga_profile_id ?? "")) ?? [];
        const ktpRequest = requests.find((request) => String(request.jenis_perubahan).toUpperCase() === "KTP");
        const kkRequest = requests.find((request) => String(request.jenis_perubahan).toUpperCase() === "KK");
        const [ktp, kk] = await Promise.all([
            signedUrlFromProfileDocumentBucket(supabase, ktpRequest?.dokumen_pendukung),
            signedUrlFromProfileDocumentBucket(supabase, kkRequest?.dokumen_pendukung),
        ]);
        return {
            ...row,
            ktp_signed_url: ktp.signedUrl,
            kk_signed_url: kk.signedUrl,
            identity_document_metadata: {
                profile_id: row.warga_profile_id ?? null,
                ktp: { bucket: ktp.bucket, path: ktpRequest?.dokumen_pendukung ?? "", available: Boolean(ktp.signedUrl), error: ktp.error, error_code: ktp.errorCode },
                kk: { bucket: kk.bucket, path: kkRequest?.dokumen_pendukung ?? "", available: Boolean(kk.signedUrl), error: kk.error, error_code: kk.errorCode },
            },
        };
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
    const warnings: AnyRow[] = [];

    logDetailDebug("request", { idUrl: detailId, userId: session.profile.id, userName: session.profile.nama_lengkap ?? session.profile.username, userRole: session.profile.role, workflowRole });

    const [activeResult, allStagesResult, submissionsResult, officersResult, auditsResult, wargaResult, petugasNotificationsResult] = await Promise.all([
        safeRows<VerificationRow>("verifikasi_pengajuan.active", (() => { let q = supabase.from("verifikasi_pengajuan").select("id,pengajuan_id,tahap,nama_tahap,role_petugas,status,petugas_id,catatan,created_at,acted_at").in("status", ["Menunggu", "Diproses"]); if (!isLurah && workflowRole !== "kepala_seksi") q = q.eq("role_petugas", workflowRole).or(`petugas_id.eq.${session.profile.id},petugas_id.is.null`); return q.order("created_at", { ascending: false }); })(), warnings),
        safeRows<VerificationRow>("verifikasi_pengajuan.all", (() => { let q = supabase.from("verifikasi_pengajuan").select("id,pengajuan_id,tahap,nama_tahap,role_petugas,status,petugas_id,catatan,created_at,acted_at"); if (!isLurah) q = q.or(`role_petugas.eq.${workflowRole},petugas_id.eq.${session.profile.id}`); return q.order("tahap", { ascending: true }); })(), warnings),
        safeRows<AnyRow>(isLurah ? "pengajuan_surat.monitoring" : "pengajuan_surat.petugas_candidates", supabase.from("pengajuan_surat").select("*, layanan(*)").order("created_at", { ascending: false }), warnings),
        safeRows<AnyRow>("petugas", supabase.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active").eq("is_active", true).in("role", ["staff_pelayanan", "petugas_lapangan"]), warnings),
        safeRows<AnyRow>("audit_pengajuan.mine", supabase.from("audit_pengajuan").select("*").eq("user_id", session.profile.id).order("created_at", { ascending: false }), warnings),
        safeRows<AnyRow>("warga_profiles.verification", supabase.from("warga_profiles").select("*").order("updated_at", { ascending: false }), warnings),
        safeRows<AnyRow>("petugas_notifikasi", supabase.from("petugas_notifikasi").select("*").eq("petugas_id", session.profile.id).order("created_at", { ascending: false }).limit(20), warnings),
    ]);

    const activeStages = (activeResult.data ?? []) as VerificationRow[];
    const allStages = (allStagesResult.data ?? []) as VerificationRow[];
    const candidateSubmissions = ((submissionsResult.data ?? []) as AnyRow[]).filter((row) => isLurah || submissionWaitingForRole(row, workflowRole));
    const activeIds = activeStages.map((stage) => stage.pengajuan_id);
    const legacyIds = candidateSubmissions.map((row) => row.id).filter(Boolean);
    const listSubmissionIds = isLurah ? (submissionsResult.data ?? []).map((row) => row.id) : Array.from(new Set([...activeIds, ...legacyIds]));
    const detailStageIds = detailId ? allStages.filter((stage) => stage.pengajuan_id === detailId).map((stage) => stage.pengajuan_id) : [];
    const submissionIds = Array.from(new Set([...listSubmissionIds, ...detailStageIds, detailId].filter(Boolean)));

    const [submissionsResultDetail, documentsResult, trackingResult, submissionAuditsResult] = await Promise.all([
        submissionIds.length ? safeRows<AnyRow>("pengajuan_surat.detail", supabase.from("pengajuan_surat").select("*, layanan(*)").in("id", submissionIds), warnings) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? safeRows<AnyRow>("dokumen_pengajuan", supabase.from("dokumen_pengajuan").select("*").in("pengajuan_id", submissionIds), warnings) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? safeRows<AnyRow>("tracking_pengajuan", supabase.from("tracking_pengajuan").select("*").in("pengajuan_id", submissionIds).order("created_at", { ascending: true }), warnings) : Promise.resolve({ data: [], error: null }),
        submissionIds.length ? safeRows<AnyRow>("audit_pengajuan.detail", supabase.from("audit_pengajuan").select("*").in("pengajuan_id", submissionIds).order("created_at", { ascending: true }), warnings) : Promise.resolve({ data: [], error: null }),
    ]);

    const submissionNiks = Array.from(new Set((submissionsResultDetail.data ?? []).map((row: AnyRow) => String(row.nik ?? "").trim()).filter(Boolean)));
    const identityProfilesResult = submissionNiks.length
        ? await safeRows<AnyRow>("warga_profiles.identity_by_nik", supabase.from("warga_profiles").select("id,nik").in("nik", submissionNiks), warnings)
        : { data: [], error: null };
    const wargaByNik = new Map((identityProfilesResult.data ?? []).filter((row: AnyRow) => row.nik).map((row: AnyRow) => [String(row.nik), row]));
    const profileIds = Array.from(new Set((identityProfilesResult.data ?? []).map((row: AnyRow) => row.id).filter(Boolean)));
    const identityRequestsResult = profileIds.length
        ? await safeRows<AnyRow>("warga_profile_change_requests.identity", supabase.from("warga_profile_change_requests").select("id,profile_id,jenis_perubahan,dokumen_pendukung,created_at").in("profile_id", profileIds).in("jenis_perubahan", ["KTP", "KK"]).order("created_at", { ascending: false }), warnings)
        : { data: [], error: null };
    const identityRequestsByProfile = groupBy(identityRequestsResult.data ?? [], "profile_id");
    const submissionsWithIdentityPaths = (submissionsResultDetail.data ?? []).map((row: AnyRow) => {
        const warga = wargaByNik.get(String(row.nik ?? "")) ?? {};
        return {
            ...row,
            warga_profile_id: warga.id ?? null,
        };
    });
    const signedDocuments = await withDocumentUrls(supabase, documentsResult.data ?? []);
    const signedSubmissions = await withIdentityUrls(supabase, submissionsWithIdentityPaths, identityRequestsByProfile);
    const submissionMap = new Map(signedSubmissions.map((row: AnyRow) => [String(row.id), row]));
    let detailSubmission: AnyRow | null = null;
    if (detailId && !submissionMap.has(detailId)) {
        const detailSubmissionResult = await safeMaybeSingle<AnyRow>("pengajuan_surat.detail_id", supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", detailId).maybeSingle(), warnings);
        detailSubmission = detailSubmissionResult.data;
        if (detailSubmission) {
            const detailNik = String(detailSubmission.nik ?? "").trim();
            let warga = wargaByNik.get(detailNik) ?? null;
            if (!warga && detailNik) {
                const detailProfileResult = await safeMaybeSingle<AnyRow>("warga_profiles.identity_detail_by_nik", supabase.from("warga_profiles").select("id,nik").eq("nik", detailNik).maybeSingle(), warnings);
                warga = detailProfileResult.data;
                if (warga?.id) {
                    wargaByNik.set(detailNik, warga);
                    const detailIdentityRequestsResult = await safeRows<AnyRow>("warga_profile_change_requests.identity_detail", supabase.from("warga_profile_change_requests").select("id,profile_id,jenis_perubahan,dokumen_pendukung,created_at").eq("profile_id", warga.id).in("jenis_perubahan", ["KTP", "KK"]).order("created_at", { ascending: false }), warnings);
                    identityRequestsByProfile.set(String(warga.id), detailIdentityRequestsResult.data ?? []);
                }
            }
            const [signedDetail] = await withIdentityUrls(supabase, [{
                ...detailSubmission,
                warga_profile_id: warga?.id ?? null,
            }], identityRequestsByProfile);
            detailSubmission = signedDetail;
            submissionMap.set(String(detailSubmission.id), detailSubmission);
        }
    }
    const officerMap = new Map((officersResult.data ?? []).map((row: AnyRow) => [String(row.id), row]));
    const docsByPengajuan = groupBy(signedDocuments, "pengajuan_id");
    const trackingByPengajuan = groupBy(trackingResult.data ?? [], "pengajuan_id");
    const auditsByPengajuan = groupBy(submissionAuditsResult.data ?? [], "pengajuan_id");
    const stagesByPengajuan = groupBy(allStages.map((stage) => ({ ...stage, nama_petugas: stage.petugas_id ? officerMap.get(String(stage.petugas_id))?.nama_lengkap ?? officerMap.get(String(stage.petugas_id))?.username ?? null : null })), "pengajuan_id");

    function enrichStage(stage: VerificationRow): AnyRow {
        const pengajuan = submissionMap.get(stage.pengajuan_id);
        return { ...pengajuan, ...stage, id: stage.pengajuan_id, verifikasi_id: stage.id, active_stage: stage, workflow_status: STAGE_WAITING_STATUS[stage.tahap] ?? pengajuan?.workflow_status ?? pengajuan?.status ?? stage.status, workflow_stage_status: stage.status, dokumen_pengajuan: docsByPengajuan.get(stage.pengajuan_id) ?? [], verifikasi_pengajuan: stagesByPengajuan.get(stage.pengajuan_id) ?? [], tracking_pengajuan: trackingByPengajuan.get(stage.pengajuan_id) ?? [], audit_pengajuan: auditsByPengajuan.get(stage.pengajuan_id) ?? [] };
    }

    function enrichSubmission(row: AnyRow): AnyRow {
        const stages = stagesByPengajuan.get(String(row.id)) ?? [];
        const activeStage = getActiveStage(stages) ?? null;
        return { ...row, workflow_status: activeStage ? (STAGE_WAITING_STATUS[Number(activeStage.tahap)] ?? activeStage.status) : activeStatusFromStages(stages) || row.status, active_stage: activeStage, verifikasi_pengajuan: stages, dokumen_pengajuan: docsByPengajuan.get(String(row.id)) ?? [], tracking_pengajuan: trackingByPengajuan.get(String(row.id)) ?? [], audit_pengajuan: auditsByPengajuan.get(String(row.id)) ?? [] };
    }

    const wargaRows = (wargaResult.data ?? []) as AnyRow[];
    const wargaTasks = wargaRows.filter((row) => isPendingWargaVerification(row) && canHandleWargaStage(session.profile!, row)).map(wargaTask);
    const requiredSubmissionStatus = ROLE_STAGE_STATUS[workflowRole];
    const kasiTasks: AnyRow[] = workflowRole === "kepala_seksi" ? activeStages.filter((stage) => [1, 2].includes(stage.tahap) && !stage.petugas_id).map(enrichStage).filter((row) => row.nomor_pengajuan || row.nama_lengkap).map((row) => ({ ...row, task_type: "pengajuan_layanan", jenis_tugas: "Pengajuan Layanan" })) : [];
    const stageTasks: AnyRow[] = activeStages
        .map(enrichStage)
        .filter((row) => row.nomor_pengajuan || row.nama_lengkap)
        .filter((row) => row.active_stage?.role_petugas === workflowRole && submissionWaitingForRole(row, workflowRole))
        .map((row) => ({ ...row, task_type: "pengajuan_layanan", jenis_tugas: "Pengajuan Layanan" }));
    const legacyTasks: AnyRow[] = candidateSubmissions
        .filter((row) => !activeIds.includes(row.id))
        .map(enrichSubmission)
        .filter((row) => submissionWaitingForRole(row, workflowRole))
        .map((row) => ({ ...row, active_stage: row.active_stage ?? { tahap: 1, nama_tahap: "Verifikasi Staff Pelayanan", role_petugas: "staff_pelayanan", status: "Diproses" }, workflow_status: row.workflow_status ?? requiredSubmissionStatus, task_type: "pengajuan_layanan", jenis_tugas: "Pengajuan Layanan" }));
    const pengajuanTasks: AnyRow[] = [...stageTasks, ...legacyTasks, ...kasiTasks]
        .filter((row, index, rows) => rows.findIndex((item) => item.id === row.id) === index)
        .map((row) => ({ ...row, task_type: "pengajuan_layanan", jenis_tugas: "Pengajuan Layanan" }));
    const tasks: AnyRow[] = pengajuanTasks.sort((a, b) => new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime());
    logTugasDebug({
        userId: session.profile.id,
        role: session.profile.role,
        jabatan: session.profile.jabatan ?? null,
        normalizedRole: workflowRole,
        activeStage: activeStages.map((stage) => ({ pengajuan_id: stage.pengajuan_id, tahap: stage.tahap, role_petugas: stage.role_petugas, status: stage.status })),
        waitingStatus: requiredSubmissionStatus,
        table: "verifikasi_pengajuan + pengajuan_surat",
        query: { role_petugas: workflowRole, stage_status: ["Menunggu", "Diproses"], submission_status: requiredSubmissionStatus },
        queryResultCount: { activeStages: activeStages.length, candidateSubmissions: candidateSubmissions.length, stageTasks: stageTasks.length, legacyTasks: legacyTasks.length, tasks: tasks.length },
        queryError: warnings.length ? warnings : null,
    });
    const wargaHistory = wargaHistoryRows(wargaRows, workflowRole, session.profile.id).sort((a, b) => new Date(historyTime(b)).getTime() - new Date(historyTime(a)).getTime());
    const history: AnyRow[] = (auditsResult.data ?? []).map((row: AnyRow) => ({ ...row, task_type: "pengajuan_layanan", jenis_tugas: "Pengajuan Layanan" })).sort((a, b) => new Date(historyTime(b)).getTime() - new Date(historyTime(a)).getTime());
    const monitoring = isLurah ? (submissionsResult.data ?? []).map(enrichSubmission) : [];
    let detail: AnyRow | null = null;
    let detailError: { code: "NOT_FOUND" | "FORBIDDEN"; message: string } | null = null;
    if (detailId) {
        const submission = submissionMap.get(detailId) ?? detailSubmission;
        const detailStages = stagesByPengajuan.get(detailId) ?? [];
        const hasAccess = canAccessSubmission(detailStages, workflowRole, session.profile.id);
        const detailDocs = docsByPengajuan.get(detailId) ?? [];
        logDetailDebug("DETAIL PENGAJUAN DEBUG", { urlId: detailId, userId: session.profile.id, userName: session.profile.nama_lengkap ?? session.profile.username, userRole: session.profile.role, queryId: detailId, hasilQuery: { found: Boolean(submission), table: "pengajuan_surat", fieldId: "id", submissionIds, nomorPengajuan: submission?.nomor_pengajuan ?? null, namaPemohon: submission?.nama_lengkap ?? null, nik: submission?.nik ?? null, status: submission?.status ?? null }, errorQuery: null, jumlahDokumen: detailDocs.length, dokumen: detailDocs.map((doc) => ({ id: doc.id, jenis: doc.jenis, nama_file: doc.nama_file, storage_path: doc.storage_path, hasSignedUrl: Boolean(doc.signed_url), storage_error: doc.storage_error ?? null })), stages: detailStages.map((stage) => ({ id: stage.id, tahap: stage.tahap, role_petugas: stage.role_petugas, status: stage.status, petugas_id: stage.petugas_id })), hasilPengecekanKewenangan: hasAccess });
        if (!submission) {
            detailError = { code: "NOT_FOUND", message: "Pengajuan tidak ditemukan." };
            logDetailDebug("kondisi A: pengajuan benar-benar tidak ditemukan", { idUrl: detailId, status: 404 });
        } else if (!hasAccess) {
            detailError = { code: "FORBIDDEN", message: "Pengajuan ada, tetapi bukan kewenangan petugas ini." };
            logDetailDebug("kondisi B: pengajuan ditemukan tetapi petugas tidak berwenang", { idUrl: detailId, userId: session.profile.id, userRole: session.profile.role, workflowRole, status: 403 });
        } else {
            detail = enrichSubmission(submission);
            detail.active_stage = getActiveStage(detailStages) ?? detailStages[0] ?? null;
            logDetailDebug("detail dapat diakses", { idUrl: detailId, userId: session.profile.id, userRole: session.profile.role, activeStage: detail.active_stage ? { id: detail.active_stage.id, tahap: detail.active_stage.tahap, role_petugas: detail.active_stage.role_petugas, status: detail.active_stage.status } : null });
        }
    }
    const stageCounts = [1, 2, 3, 4, 5].reduce<Record<string, number>>((acc, tahap) => { acc[String(tahap)] = allStages.filter((stage) => stage.tahap === tahap && ["Menunggu", "Diproses"].includes(String(stage.status ?? ""))).length; return acc; }, {});
    const totalResult = isLurah ? { total: (submissionsResult.data ?? []).length, selesai: (submissionsResult.data ?? []).filter((row: AnyRow) => row.status === "Selesai").length } : { total: 0, selesai: 0 };
    const unassignedForKasi = workflowRole === "kepala_seksi" ? allStages.filter((stage) => [1, 2].includes(stage.tahap) && !stage.petugas_id && ["Menunggu", "Diproses"].includes(stage.status)).length / 2 : 0;
    const stats = { menunggu: tasks.length, tugas_pengajuan: pengajuanTasks.length, verifikasi_warga: wargaTasks.length, pengajuan_masuk: Math.floor(unassignedForKasi), diproses: history.length, dikembalikan: history.filter((row) => /kembali|revisi|dikembalikan/i.test(`${row.action ?? row.aksi ?? row.status ?? row.status_sesudah ?? ""}`)).length, lurah: { total: totalResult.total, staff: stageCounts["1"] ?? 0, lapangan: stageCounts["2"] ?? 0, kasi: stageCounts["3"] ?? 0, seklur: stageCounts["4"] ?? 0, lurah: stageCounts["5"] ?? 0, selesai: totalResult.selesai } };

    return NextResponse.json({ ok: true, petugas: session.profile, stats, tugas: tasks, data: { tasks, wargaTasks, wargaHistory, pengajuanTasks, history, detail, detailError, officers: officersResult.data ?? [], monitoring, notifikasi: petugasNotificationsResult.data ?? [], warnings, stats } });
}