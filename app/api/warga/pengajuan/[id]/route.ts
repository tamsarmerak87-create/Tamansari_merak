import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";

type ValidatedWarga = { warga: WargaProfile | null; authUserId: string } | { error: string; status: number };
type RouteContext = { params: Promise<{ id: string }> };

const WARGA_PROFILE_SAFE_COLUMNS = "id,nama_lengkap,nik,nomor_kk,email,nomor_hp,nomor_whatsapp,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,foto_url,role,status_verifikasi,alasan_penolakan,created_at,updated_at";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACKING_COLUMNS = "id,pengajuan_id,status,keterangan,petugas,created_at";
const DOKUMEN_COLUMNS = "id,pengajuan_id,nama_file,jenis,url_file,created_at";
const VERIFIKASI_COLUMNS = "id,pengajuan_id,tahap,nama_tahap,role_petugas,status,petugas_id,catatan,created_at,acted_at";
const EDITABLE_FIELDS = ["keperluan", "catatan", "alamat", "rt", "rw", "kelurahan", "kecamatan", "no_hp", "email"] as const;
const STORAGE_BUCKET = "surat";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function logSupabaseError(label: string, error: unknown) {
    const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(label, {
        message: supabaseError.message ?? (error instanceof Error ? error.message : "Unknown error"),
        code: supabaseError.code,
        details: supabaseError.details,
        hint: supabaseError.hint,
    });
}

function logDetailError(error: unknown) {
    const supabaseError = error as { code?: string; details?: string; hint?: string };
    console.error("DETAIL PENGAJUAN ERROR", {
        message: error instanceof Error ? error.message : String(error),
        code: supabaseError.code,
        details: supabaseError.details,
        hint: supabaseError.hint,
    });
}

function normalizedStatus(value: unknown) {
    return String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function isRevisionStatus(value: unknown) {
    const status = normalizedStatus(value);
    return status === "REVISI" || status === "PERLU_REVISI" || status.includes("DIKEMBALIKAN");
}

function storagePaths(value: unknown) {
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    } catch {
        // Nilai lama disimpan sebagai satu path biasa, bukan JSON.
    }
    return [value];
}

function eventTime(row: Record<string, any> | null | undefined) {
    const value = row?.acted_at ?? row?.created_at;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
}

async function hydrateDetail(supabase: ReturnType<typeof createSupabaseAdminClient>, pengajuan: Record<string, any>) {
    const [layananResult, trackingResult, dokumenResult, verifikasiResult] = await Promise.all([
        pengajuan.layanan_id ? supabase.from("layanan").select("id,nama,deskripsi").eq("id", pengajuan.layanan_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from("tracking_pengajuan").select(TRACKING_COLUMNS).eq("pengajuan_id", pengajuan.id).order("created_at", { ascending: true }),
        supabase.from("dokumen_pengajuan").select(DOKUMEN_COLUMNS).eq("pengajuan_id", pengajuan.id).order("created_at", { ascending: false }),
        supabase.from("verifikasi_pengajuan").select(VERIFIKASI_COLUMNS).eq("pengajuan_id", pengajuan.id).order("tahap", { ascending: true }),
    ]);

    if (layananResult.error) logSupabaseError("DETAIL LAYANAN QUERY ERROR", layananResult.error);
    if (trackingResult.error) logSupabaseError("DETAIL TRACKING QUERY ERROR", trackingResult.error);
    if (dokumenResult.error) logSupabaseError("DETAIL DOKUMEN QUERY ERROR", dokumenResult.error);
    if (verifikasiResult.error) logSupabaseError("DETAIL VERIFIKASI QUERY ERROR", verifikasiResult.error);

    const verificationStages = verifikasiResult.data ?? [];
    const trackingRows = trackingResult.data ?? [];
    const primaryStatus = normalizedStatus(pengajuan.status);
    const latestReturnedStage = [...verificationStages]
        .filter((stage) => normalizedStatus(stage.status) === "DITOLAK")
        .sort((a, b) => eventTime(b) - eventTime(a))[0] ?? null;
    const latestRevisionTracking = [...trackingRows]
        .filter((track) => /revisi|dikembalikan/i.test(`${track.status ?? ""} ${track.keterangan ?? ""}`))
        .sort((a, b) => eventTime(b) - eventTime(a))[0] ?? null;
    const latestRejectionTracking = [...trackingRows]
        .filter((track) => /ditolak|penolakan/i.test(`${track.status ?? ""} ${track.keterangan ?? ""}`) && !/revisi|dikembalikan/i.test(`${track.status ?? ""} ${track.keterangan ?? ""}`))
        .sort((a, b) => eventTime(b) - eventTime(a))[0] ?? null;
    const candidateActiveStage = verificationStages.find((stage) => normalizedStatus(stage.status) === "DIPROSES")
        ?? verificationStages.find((stage) => normalizedStatus(stage.status) === "MENUNGGU")
        ?? null;
    const revisionTime = Math.max(eventTime(latestReturnedStage), eventTime(latestRevisionTracking));
    const activeTime = eventTime(candidateActiveStage);
    const terminalStatus = ["SELESAI", "DITOLAK", "DIBATALKAN"].includes(primaryStatus) ? primaryStatus : undefined;
    const resubmittedAfterRevision = revisionTime > 0 && activeTime > revisionTime;
    const revisionActive = !terminalStatus && revisionTime > 0 && !resubmittedAfterRevision;
    const rejectionActive = !terminalStatus && !revisionActive && eventTime(latestRejectionTracking) >= activeTime && eventTime(latestRejectionTracking) > 0;
    // Menunggu is a stage-level state; an active submission remains in the app's Diproses status.
    const resumedWorkflowStatus = candidateActiveStage ? "DIPROSES" : primaryStatus;
    const effectiveStatus = terminalStatus
        ?? (revisionActive ? "REVISI" : rejectionActive ? "DITOLAK" : resubmittedAfterRevision ? resumedWorkflowStatus : primaryStatus);
    const workflowStopped = ["REVISI", "DITOLAK", "SELESAI", "DIBATALKAN"].includes(effectiveStatus);
    const activeStage = workflowStopped ? null : candidateActiveStage;
    const returnedStage = revisionActive ? latestReturnedStage : null;

    return {
        ...pengajuan,
        status: effectiveStatus || pengajuan.status,
        active_stage: activeStage,
        returned_to_role: returnedStage?.role_petugas ?? null,
        revision_note: returnedStage?.catatan ?? latestRevisionTracking?.keterangan ?? pengajuan.catatan ?? null,
        layanan: layananResult.data ?? { nama: pengajuan.jenis_surat ?? "Layanan tidak tersedia" },
        tracking_pengajuan: trackingRows,
        dokumen_pengajuan: dokumenResult.data ?? [],
        verifikasi_pengajuan: verificationStages,
    };
}

async function getValidatedWarga(request: NextRequest): Promise<ValidatedWarga> {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { error: "Silakan login terlebih dahulu.", status: 401 as const };

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return { error: "Session warga tidak valid.", status: 401 as const };

    const user = userData.user;
    const byId = await supabase.from("warga_profiles").select(WARGA_PROFILE_SAFE_COLUMNS).eq("id", user.id).maybeSingle<WargaProfile>();
    if (byId.error) throw byId.error;
    if (byId.data) return { warga: byId.data, authUserId: user.id };

    const byEmail = await supabase.from("warga_profiles").select(WARGA_PROFILE_SAFE_COLUMNS).eq("email", user.email ?? "").maybeSingle<WargaProfile>();
    if (byEmail.error) throw byEmail.error;
    return { warga: byEmail.data ?? null, authUserId: user.id };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        console.log("DETAIL PENGAJUAN ID", {
            id,
            valid: Boolean(id),
        });

        if (!id) {
            console.error("DETAIL PENGAJUAN ID MISSING");
            return jsonError("ID pengajuan tidak ditemukan.", 400);
        }

        if (!UUID_REGEX.test(id)) {
            console.error("DETAIL PENGAJUAN INVALID UUID", { id });
            return jsonError("ID pengajuan tidak valid.", 400);
        }

        const validated = await getValidatedWarga(request);
        if ("error" in validated) return jsonError(validated.error, validated.status);
        const warga = validated.warga;
        if (!warga?.nik) return jsonError("Profil warga tidak ditemukan.", 404);
        console.log("DETAIL WARGA VALID:", Boolean(warga));

        const supabase = createSupabaseAdminClient();
        const { data: pengajuan, error } = await supabase
            .from("pengajuan_surat")
            .select(`
                id,
                nomor_pengajuan,
                nik,
                nama_lengkap,
                status,
                created_at,
                updated_at,
                layanan_id,
                keperluan,
                catatan,
                alamat,
                rt,
                rw,
                kelurahan,
                kecamatan,
                no_hp,
                email
            `)
            .eq("id", id)
            .maybeSingle();
        if (error) {
            console.error("DETAIL PENGAJUAN QUERY ERROR", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                id,
            });
            throw error;
        }

        console.log("DETAIL PENGAJUAN FOUND:", Boolean(pengajuan));
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (pengajuan.nik !== warga.nik) return jsonError("Pengajuan bukan milik akun ini.", 403);

        return NextResponse.json({
            ok: true,
            data: await hydrateDetail(supabase, pengajuan),
        });
    } catch (error) {
        logDetailError(error);
        return NextResponse.json(
            {
                ok: false,
                error: "Gagal mengambil detail pengajuan warga.",
            },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    let rollback: (() => Promise<void>) | null = null;
    try {
        const { id } = await params;
        if (!UUID_REGEX.test(id)) return jsonError("ID pengajuan tidak valid.", 400);

        const validated = await getValidatedWarga(request);
        if ("error" in validated) return jsonError(validated.error, validated.status);
        const warga = validated.warga;
        if (!warga?.nik) return jsonError("Profil warga tidak ditemukan.", 404);

        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return jsonError("Data perbaikan tidak valid.", 400);
        const documents = Array.isArray(body.documents) ? body.documents : [];
        const uploadedPaths: string[] = [];
        for (const document of documents) {
            const path = typeof document === "object" && document ? String((document as Record<string, unknown>).url_file ?? "").trim() : "";
            if (!path || path.includes("..") || !path.startsWith(`${validated.authUserId}/`)) return jsonError("Path dokumen perbaikan tidak valid.", 400);
            uploadedPaths.push(path);
        }

        const supabase = createSupabaseAdminClient();
        const { data: pengajuan, error: pengajuanError } = await supabase
            .from("pengajuan_surat")
            .select("id,nomor_pengajuan,nik,status,file_pendukung,keperluan,catatan,alamat,rt,rw,kelurahan,kecamatan,no_hp,email,updated_at")
            .eq("id", id)
            .maybeSingle();
        if (pengajuanError) throw pengajuanError;
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (pengajuan.nik !== warga.nik) return jsonError("Pengajuan bukan milik akun ini.", 403);
        if (!isRevisionStatus(pengajuan.status)) return jsonError("Hanya pengajuan yang berstatus perlu revisi yang dapat dikirim ulang.", 409);

        const { data: returnedStages, error: stageError } = await supabase
            .from("verifikasi_pengajuan")
            .select("id,tahap,status,petugas_id,acted_at,updated_at,created_at")
            .eq("pengajuan_id", id)
            .ilike("status", "ditolak");
        if (stageError) throw stageError;
        const returnedStage = [...(returnedStages ?? [])].sort((a, b) => eventTime(b) - eventTime(a))[0];
        if (!returnedStage) return jsonError("Tahap revisi pengajuan tidak ditemukan.", 409);

        const updatePayload: Record<string, string | null> = { status: "Diproses", updated_at: new Date().toISOString() };
        for (const field of EDITABLE_FIELDS) {
            if (!(field in body)) continue;
            const value = body[field];
            updatePayload[field] = typeof value === "string" && value.trim() ? value.trim() : null;
        }
        if (!updatePayload.keperluan && "keperluan" in body) return jsonError("Keperluan wajib diisi.", 400);

        const oldDocumentResult = documents.length > 0
            ? await supabase.from("dokumen_pengajuan").select("id,pengajuan_id,nama_file,jenis,url_file,created_at").eq("pengajuan_id", id).ilike("jenis", "%pendukung%")
            : { data: [], error: null };
        if (oldDocumentResult.error) throw oldDocumentResult.error;
        const oldPaths = [...storagePaths(pengajuan.file_pendukung), ...(oldDocumentResult.data ?? []).flatMap((row) => storagePaths(row.url_file))];
        const oldDocumentIds = (oldDocumentResult.data ?? []).map((row) => row.id);
        let insertedDocumentIds: string[] = [];
        let stageChanged = false;
        let pengajuanChanged = false;
        let trackingId: string | null = null;
        let oldDocumentsDeleted = false;

        rollback = async () => {
            if (trackingId) await supabase.from("tracking_pengajuan").delete().eq("id", trackingId);
            if (pengajuanChanged) {
                const originalPengajuan = {
                    status: pengajuan.status,
                    file_pendukung: pengajuan.file_pendukung,
                    keperluan: pengajuan.keperluan,
                    catatan: pengajuan.catatan,
                    alamat: pengajuan.alamat,
                    rt: pengajuan.rt,
                    rw: pengajuan.rw,
                    kelurahan: pengajuan.kelurahan,
                    kecamatan: pengajuan.kecamatan,
                    no_hp: pengajuan.no_hp,
                    email: pengajuan.email,
                    updated_at: pengajuan.updated_at,
                };
                await supabase.from("pengajuan_surat").update(originalPengajuan).eq("id", id).eq("nik", warga.nik).eq("status", "Diproses");
            }
            if (stageChanged) {
                await supabase.from("verifikasi_pengajuan").update({ status: returnedStage.status, petugas_id: returnedStage.petugas_id, acted_at: returnedStage.acted_at, updated_at: returnedStage.updated_at }).eq("id", returnedStage.id).eq("status", "Diproses");
            }
            if (insertedDocumentIds.length > 0) await supabase.from("dokumen_pengajuan").delete().in("id", insertedDocumentIds);
            if (oldDocumentsDeleted && (oldDocumentResult.data ?? []).length > 0) await supabase.from("dokumen_pengajuan").insert(oldDocumentResult.data);
        };

        if (documents.length > 0) {
            const rows = documents.map((document) => {
                const record = document as Record<string, unknown>;
                return { pengajuan_id: id, nama_file: String(record.nama_file ?? "Dokumen Pendukung"), jenis: "Pendukung", url_file: String(record.url_file) };
            });
            const insertDocuments = await supabase.from("dokumen_pengajuan").insert(rows).select("id");
            if (insertDocuments.error) throw insertDocuments.error;
            insertedDocumentIds = (insertDocuments.data ?? []).map((row) => row.id);
            updatePayload.file_pendukung = uploadedPaths.length > 1 ? JSON.stringify(uploadedPaths) : uploadedPaths[0];
        }

        const stageUpdate = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses", petugas_id: null, acted_at: null, updated_at: new Date().toISOString() }).eq("id", returnedStage.id).ilike("status", "ditolak").select("id").maybeSingle();
        if (stageUpdate.error) throw stageUpdate.error;
        if (!stageUpdate.data) throw new Error("Tahap revisi telah berubah.");
        stageChanged = true;
        const pengajuanUpdate = await supabase.from("pengajuan_surat").update(updatePayload).eq("id", id).eq("nik", warga.nik).eq("status", pengajuan.status).select("id,nomor_pengajuan,status").maybeSingle();
        if (pengajuanUpdate.error) throw pengajuanUpdate.error;
        if (!pengajuanUpdate.data) throw new Error("Status pengajuan telah berubah.");
        pengajuanChanged = true;

        const tracking = await supabase.from("tracking_pengajuan").insert({
            pengajuan_id: id,
            status: "Diproses",
            keterangan: `Perbaikan telah dikirim ulang dan dilanjutkan pada tahap ${returnedStage.tahap}.`,
            petugas: "Warga",
        }).select("id").single();
        if (tracking.error) throw tracking.error;
        trackingId = tracking.data.id;

        if (oldDocumentIds.length > 0) {
            const deleteOldDocuments = await supabase.from("dokumen_pengajuan").delete().in("id", oldDocumentIds).eq("pengajuan_id", id);
            if (deleteOldDocuments.error) throw deleteOldDocuments.error;
            oldDocumentsDeleted = true;
        }
        rollback = null;
        if (documents.length > 0 && oldPaths.length > 0) {
            const storageCleanup = await supabase.storage.from(STORAGE_BUCKET).remove([...new Set(oldPaths.filter((path) => !uploadedPaths.includes(path)))]);
            if (storageCleanup.error) logSupabaseError("PATCH OLD STORAGE CLEANUP ERROR", storageCleanup.error);
        }

        return NextResponse.json({ ok: true, message: "Perbaikan pengajuan berhasil dikirim ulang.", data: pengajuanUpdate.data });
    } catch (error) {
        if (rollback) await rollback().catch((rollbackError) => logSupabaseError("PATCH PENGAJUAN ROLLBACK ERROR", rollbackError));
        logSupabaseError("PATCH PENGAJUAN WARGA ERROR", error);
        return jsonError("Gagal mengirim ulang perbaikan pengajuan.", 500);
    }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        if (!UUID_REGEX.test(id)) return jsonError("ID pengajuan tidak valid.", 400);

        const validated = await getValidatedWarga(request);
        if ("error" in validated) return jsonError(validated.error, validated.status);
        const warga = validated.warga;
        if (!warga?.nik) return jsonError("Profil warga tidak ditemukan.", 404);

        const supabase = createSupabaseAdminClient();
        const { data: pengajuan, error } = await supabase.from("pengajuan_surat").select("id,nik,status,file_ktp,file_kk,file_pendukung").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (pengajuan.nik !== warga.nik) return jsonError("Pengajuan bukan milik akun ini.", 403);
        if (!isRevisionStatus(pengajuan.status)) return jsonError("Hanya pengajuan yang berstatus perlu revisi yang dapat dihapus.", 409);

        const { data: documents, error: documentError } = await supabase.from("dokumen_pengajuan").select("url_file").eq("pengajuan_id", id);
        if (documentError) throw documentError;
        const candidatePaths = [...storagePaths(pengajuan.file_ktp), ...storagePaths(pengajuan.file_kk), ...storagePaths(pengajuan.file_pendukung), ...(documents ?? []).flatMap((row) => storagePaths(row.url_file))]
            .filter((path) => !path.includes("..") && path.startsWith(`${validated.authUserId}/`));

        // Relasi pengajuan memakai ON DELETE CASCADE; parent dihapus terakhir secara atomik oleh database.
        const deleted = await supabase.from("pengajuan_surat").delete().eq("id", id).eq("nik", warga.nik).eq("status", pengajuan.status).select("id").maybeSingle();
        if (deleted.error) throw deleted.error;
        if (!deleted.data) return jsonError("Pengajuan gagal dihapus karena status atau kepemilikan telah berubah.", 409);
        const uniqueCandidatePaths = [...new Set(candidatePaths)];
        const referencedPaths = new Set<string>();
        if (uniqueCandidatePaths.length > 0) {
            const [{ data: otherSubmissions, error: otherSubmissionError }, { data: otherDocuments, error: otherDocumentError }] = await Promise.all([
                supabase.from("pengajuan_surat").select("file_ktp,file_kk,file_pendukung").neq("id", id),
                supabase.from("dokumen_pengajuan").select("url_file").neq("pengajuan_id", id),
            ]);
            if (otherSubmissionError) logSupabaseError("DELETE OTHER SUBMISSION STORAGE CHECK ERROR", otherSubmissionError);
            if (otherDocumentError) logSupabaseError("DELETE OTHER DOCUMENT STORAGE CHECK ERROR", otherDocumentError);
            if (!otherSubmissionError && !otherDocumentError) {
                for (const row of otherSubmissions ?? []) {
                    storagePaths(row.file_ktp).forEach((path) => referencedPaths.add(path));
                    storagePaths(row.file_kk).forEach((path) => referencedPaths.add(path));
                    storagePaths(row.file_pendukung).forEach((path) => referencedPaths.add(path));
                }
                for (const row of otherDocuments ?? []) storagePaths(row.url_file).forEach((path) => referencedPaths.add(path));
            } else {
                uniqueCandidatePaths.forEach((path) => referencedPaths.add(path));
            }
        }
        const removablePaths = uniqueCandidatePaths.filter((path) => !referencedPaths.has(path));
        if (removablePaths.length > 0) {
            const storageCleanup = await supabase.storage.from(STORAGE_BUCKET).remove(removablePaths);
            if (storageCleanup.error) logSupabaseError("DELETE STORAGE CLEANUP ERROR", storageCleanup.error);
        }

        return NextResponse.json({ ok: true, message: "Pengajuan berhasil dihapus." });
    } catch (error) {
        logSupabaseError("DELETE PENGAJUAN WARGA ERROR", error);
        return jsonError("Gagal menghapus pengajuan.", 500);
    }
}
