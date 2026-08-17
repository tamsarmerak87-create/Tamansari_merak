import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseBrowserClient } from "@/services/supabase";
import { assertWargaAccountVerifiedByNik } from "@/services/warga-verification-workflow";
import { forwardToN8n, getAppBaseUrl } from "@/services/integrations";
import { createVerificationRows } from "@/services/verification-workflow";
import { createWargaNotification, type NotificationStatus } from "@/services/warga-notifikasi.service";

export const STATUS_STEPS = ["Permohonan diterima", "Verifikasi", "Diproses", "Ditandatangani", "Selesai"] as const;
export const SUBMISSION_STATUS = ["Menunggu Verifikasi", "Verifikasi", "Diproses", "Ditandatangani", "Selesai", "Ditolak"] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const SUBMISSION_STORAGE_BUCKET = "surat";

function notificationStatusFromSubmissionStatus(status: string): NotificationStatus | null {
    const normalized = status.trim().toLowerCase();
    if (["terverifikasi", "verifikasi", "diverifikasi"].includes(normalized)) return "verified";
    if (["ditolak", "tolak"].includes(normalized)) return "rejected";
    if (["diproses", "sedang diproses", "ditandatangani"].includes(normalized)) return "processing";
    if (["selesai"].includes(normalized)) return "completed";
    return null;
}

export const submissionSchema = z.object({
    layanan_id: z.string().uuid("Jenis layanan tidak valid"),
    nik: z.string().regex(/^\d{16}$/, "NIK harus 16 angka"),
    nama_lengkap: z.string().min(3, "Nama lengkap wajib diisi"),
    nomor_kk: z.string().regex(/^\d{16}$/, "Nomor KK harus 16 angka"),
    tempat_lahir: z.string().min(2, "Tempat lahir wajib diisi"),
    tanggal_lahir: z.string().min(1, "Tanggal lahir wajib diisi"),
    jenis_kelamin: z.string().min(1, "Jenis kelamin wajib dipilih"),
    agama: z.string().min(1, "Agama wajib dipilih"),
    status_perkawinan: z.string().min(1, "Status perkawinan wajib dipilih"),
    pekerjaan: z.string().min(2, "Pekerjaan wajib diisi"),
    alamat: z.string().min(8, "Alamat wajib diisi"),
    rt_rw: z.string().min(3, "RT/RW wajib diisi"),
    kelurahan: z.string().min(2, "Kelurahan wajib diisi"),
    kecamatan: z.string().min(2, "Kecamatan wajib diisi"),
    nomor_hp: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor HP tidak valid"),
    email: z.string().email("Email tidak valid"),
    jenis_surat: z.string().min(1, "Jenis surat wajib diisi"),
    keperluan: z.string().min(5, "Keperluan wajib diisi"),
    catatan: z.string().optional().default(""),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
type UploadStage = "file_upload" | "pengajuan_insert" | "verification_insert" | "dokumen_insert" | "tracking_insert";

type UploadedFileMeta = {
    path: string;
    url?: string | null;
    name: string;
    type: string;
    size: number;
};

type SubmissionRequest = SubmissionInput & {
    file_ktp?: string | null;
    file_kk?: string | null;
    file_pendukung?: string | null;
    ktp_path?: string | null;
    ktp_url?: string | null;
    ktp_name?: string | null;
    ktp_type?: string | null;
    ktp_size?: number | string | null;
    kk_path?: string | null;
    kk_url?: string | null;
    kk_name?: string | null;
    kk_type?: string | null;
    kk_size?: number | string | null;
    pendukung_path?: string | null;
    pendukung_url?: string | null;
    pendukung_name?: string | null;
    pendukung_type?: string | null;
    pendukung_size?: number | string | null;
    consent?: boolean;
    declaration?: boolean;
    physical_proof_generated?: boolean;
    physical_proof_viewed?: boolean;
    physical_proof_approved?: boolean;
    physical_proof_generated_at?: string | null;
    materai_status?: string | null;
};

type SubmissionPathKey = "file_ktp" | "file_kk" | "file_pendukung";

const SUBMISSION_PATH_KEYS: SubmissionPathKey[] = ["file_ktp", "file_kk", "file_pendukung"];

class SupabaseOperationError extends Error {
    details?: string;
    hint?: string;
    code?: string;
    stage?: UploadStage;

    constructor(label: string, error: { message?: string; details?: string; hint?: string; code?: string }, stage?: UploadStage) {
        super(error.message ?? label);
        this.name = label;
        this.details = error.details;
        this.hint = error.hint;
        this.code = error.code;
        this.stage = stage;
    }
}

function logUploadStage(label: string, meta: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    console.info(label, meta);
}

function logSupabaseStageError(label: string, error: { message?: string; statusCode?: string; status?: number; error?: string; code?: string }, meta: Record<string, unknown> = {}) {
    console.error(label, {
        ...meta,
        status: error.status ?? error.statusCode,
        code: error.code ?? error.error,
        message: error.message,
    });
}

export function validateUploadFile(file: File) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) throw new Error("File harus PDF, JPG, atau PNG.");
    if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran file terlalu besar. Maksimal 5 MB.");
}

function safeStorageSegment(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 96) || "dokumen";
}

function validateUploadedFileMeta(file: UploadedFileMeta, label: string) {
    if (!file.path || file.path.includes("..")) throw new Error(`${label} tidak valid.`);
    if (!ALLOWED_FILE_TYPES.includes(file.type)) throw new Error(`${label} harus PDF, JPG, atau PNG.`);
    if (file.size > MAX_FILE_SIZE) throw new Error(`Ukuran ${label} terlalu besar. Maksimal 5 MB.`);
}

function extensionFromFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    return ext.replace(/[^a-z0-9]/g, "") || "bin";
}

export async function uploadSubmissionAttachment(folder: "ktp" | "kk" | "pendukung", file: File, ownerId: string, nomorPengajuan?: string) {
    validateUploadFile(file);
    const client = createSupabaseBrowserClient();
    const { data: authData, error: authError } = await client.auth.getUser();
    if (process.env.NODE_ENV !== "production") logUploadStage("[surat-online:auth-check]", { hasUser: Boolean(authData?.user), authError: authError?.message ?? null });
    if (authError || !authData.user) throw new Error("Supabase Auth session belum aktif.");
    const safeNomor = safeStorageSegment(nomorPengajuan ?? `draft-${Date.now()}`);
    const path = `${authData.user.id}/${safeNomor}/${folder}.${extensionFromFile(file)}`;
    const { data, error } = await client.storage.from(SUBMISSION_STORAGE_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
    });
    if (error) throw new Error(error.message || "Gagal mengunggah dokumen.");
    const uploadedPath = data.path;
    logUploadStage("UPLOAD PATH", { bucket: SUBMISSION_STORAGE_BUCKET, userId: authData.user.id, ownerId, path: uploadedPath, plannedPath: path, fileName: file.name });
    return { path: uploadedPath, url: null, name: file.name, type: file.type, size: file.size } satisfies UploadedFileMeta;
}

export async function removeSubmissionAttachments(paths: string[]) {
    const safePaths = paths.filter((path) => path && !path.includes(".."));
    if (safePaths.length === 0) return;
    const client = typeof window === "undefined" ? createSupabaseAdminClient() : createSupabaseBrowserClient();
    const { error } = await client.storage.from(SUBMISSION_STORAGE_BUCKET).remove(safePaths);
    if (error) throw new Error(error.message || "Gagal membersihkan dokumen upload.");
}

function assertTextPathPayload(formData: SubmissionRequest) {
    SUBMISSION_PATH_KEYS.forEach((key) => {
        const value = formData[key];
        if (value == null || value === "") return;
        if (typeof value !== "string") throw new Error(`${key} harus berupa path file Storage, bukan File/Blob/Base64.`);
        const trimmed = value.trim();
        if (!trimmed || trimmed.includes("..") || /^data:/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
            throw new Error(`${key} harus berupa path file Storage yang valid.`);
        }
        if (trimmed.length > 512) throw new Error(`${key} terlalu panjang untuk path file Storage.`);
    });
}

export function getProgressFromStatus(status?: string) {
    if (status === "Selesai") return 5;
    if (status === "Ditandatangani") return 4;
    if (status === "Diproses") return 3;
    if (status === "Verifikasi") return 2;
    return 1;
}

export function createNomorPengajuan(sequence: number, date = new Date()) {
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    return `TMS-${stamp}-${String(sequence).padStart(4, "0")}`;
}

export function createNomorTiket(sequence: number, date = new Date()) {
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    return `TIK-${stamp}-${String(sequence).padStart(6, "0")}`;
}

export function createTrackingUrl(nomorPengajuan: string) {
    return `${getAppBaseUrl()}/surat-online/tracking?nomor=${encodeURIComponent(nomorPengajuan)}`;
}

async function sendPengajuanEmail(payload: {
    to: string;
    nama: string;
    nomor_pengajuan: string;
    nomor_tiket: string;
    tanggal: string;
    jenis_pelayanan: string;
    tracking_url: string;
}) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !payload.to) return { skipped: true, reason: "RESEND_API_KEY/email belum tersedia" };

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL ?? "Kelurahan Tamansari <noreply@tamansari-merak.vercel.app>",
            to: payload.to,
            subject: "Pengajuan Surat Berhasil",
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
                    <h2>Pengajuan Surat Berhasil</h2>
                    <p>Yth. ${payload.nama}, permohonan surat online Anda berhasil diterima.</p>
                    <ul>
                        <li><b>Nomor Pengajuan:</b> ${payload.nomor_pengajuan}</li>
                        <li><b>Nomor Tiket:</b> ${payload.nomor_tiket}</li>
                        <li><b>Tanggal:</b> ${payload.tanggal}</li>
                        <li><b>Jenis Pelayanan:</b> ${payload.jenis_pelayanan}</li>
                    </ul>
                    <p>Cek status melalui tautan berikut:</p>
                    <p><a href="${payload.tracking_url}">${payload.tracking_url}</a></p>
                    <p>Kelurahan Tamansari<br/>Kecamatan Pulomerak<br/>Kota Cilegon</p>
                </div>
            `,
        }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: response.status, data };
    return { ok: true, status: response.status, data };
}

export async function getLayananList() {
    const client = createSupabaseBrowserClient();
    if (!client) return [];
    const { data, error } = await client
        .from("layanan")
        .select(`
            id,
            nama,
            deskripsi,
            aktif,
            persyaratan,
            alur,
            dasar_hukum,
            output,
            kanal,
            created_at
        `)
        .order("nama", { ascending: true });
    if (error) {
        console.error("SUPABASE LAYANAN LIST ERROR");
        console.dir(error, { depth: null });
        throw error;
    }
    return data ?? [];
}

export async function createSubmission(formData: SubmissionRequest) {
    if (typeof window !== "undefined") {
        try {
            assertTextPathPayload(formData);
            const response = await fetch("/api/surat-online/pengajuan", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(formData),
            });
            const result = await response.json().catch(() => null);
            const message = typeof result?.error === "string" ? result.error : result?.error?.message;
            if (!response.ok || !result?.ok) throw new Error(message ?? "Gagal mengirim pengajuan.");
            return result.data;
        } catch (error) {
            console.error("SURAT ONLINE CLIENT SUBMIT ERROR");
            console.dir(error, { depth: null });
            throw error;
        } finally {
            // Semua cleanup UI ditangani komponen pemanggil.
        }
    }

    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");

    let payload: SubmissionInput;
    let ktpMeta: UploadedFileMeta | null = null;
    let kkMeta: UploadedFileMeta | null = null;
    let pendukungMeta: UploadedFileMeta | null = null;

    assertTextPathPayload(formData);

    const getValue = (key: keyof SubmissionRequest) => formData[key];
    const readPath = (key: "file_ktp" | "file_kk" | "file_pendukung") => {
        const value = getValue(key);
        return typeof value === "string" && value.trim() ? value.trim() : null;
    };
    const readMeta = (prefix: "ktp" | "kk" | "pendukung") => {
        const path = getValue(`${prefix}_path` as keyof SubmissionRequest);
        if (!path) return null;
        return {
            path: String(path),
            url: String(getValue(`${prefix}_url` as keyof SubmissionRequest) ?? "") || null,
            name: String(getValue(`${prefix}_name` as keyof SubmissionRequest) ?? prefix),
            type: String(getValue(`${prefix}_type` as keyof SubmissionRequest) ?? ""),
            size: Number(getValue(`${prefix}_size` as keyof SubmissionRequest) ?? 0),
        } satisfies UploadedFileMeta;
    };

    try {
        payload = submissionSchema.parse({
            layanan_id: getValue("layanan_id"),
            nik: getValue("nik"),
            nama_lengkap: getValue("nama_lengkap"),
            nomor_kk: getValue("nomor_kk"),
            tempat_lahir: getValue("tempat_lahir"),
            tanggal_lahir: getValue("tanggal_lahir"),
            jenis_kelamin: getValue("jenis_kelamin"),
            agama: getValue("agama"),
            status_perkawinan: getValue("status_perkawinan"),
            pekerjaan: getValue("pekerjaan"),
            alamat: getValue("alamat"),
            rt_rw: getValue("rt_rw"),
            kelurahan: getValue("kelurahan"),
            kecamatan: getValue("kecamatan"),
            nomor_hp: getValue("nomor_hp"),
            email: getValue("email"),
            jenis_surat: getValue("jenis_surat"),
            keperluan: getValue("keperluan"),
            catatan: getValue("catatan") ?? "",
        });
        ktpMeta = readPath("file_ktp") ? { path: readPath("file_ktp") ?? "", url: null, name: "KTP", type: "application/pdf", size: 0 } : readMeta("ktp");
        kkMeta = readPath("file_kk") ? { path: readPath("file_kk") ?? "", url: null, name: "KK", type: "application/pdf", size: 0 } : readMeta("kk");
        pendukungMeta = readPath("file_pendukung") ? { path: readPath("file_pendukung") ?? "", url: null, name: "Dokumen pendukung", type: "application/pdf", size: 0 } : readMeta("pendukung");
        if (Number.isNaN(Date.parse(payload.tanggal_lahir))) throw new Error("Tanggal lahir tidak valid.");
        if (formData.consent !== true) throw new Error("Persetujuan pernyataan kebenaran wajib diberikan.");
        await assertWargaAccountVerifiedByNik(payload.nik);
        [ktpMeta, kkMeta, pendukungMeta].filter(Boolean).forEach((file) => {
            if (!file?.path || file.path.includes("..")) throw new Error("Path dokumen tidak valid.");
        });
    } catch (error) {
        console.error("SURAT ONLINE VALIDATION ERROR");
        console.dir(error, { depth: null });
        throw error;
    } finally {
        // Tidak ada resource yang perlu dibersihkan pada tahap validasi.
    }

    let nomor_pengajuan = "";
    let nomor_tiket = "";
    let tracking_url = "";

    try {
        const { data: layanan, error: layananError } = await client
            .from("layanan")
            .select(`
                id,
                nama
            `)
            .eq("id", payload.layanan_id)
            .eq("aktif", true)
            .maybeSingle();
        if (layananError) {
            console.error("SUPABASE SELECT LAYANAN ERROR");
            console.dir(layananError, { depth: null });
            throw new SupabaseOperationError("SUPABASE SELECT LAYANAN ERROR", layananError);
        }
        if (!layanan) throw new Error("Layanan tidak ditemukan atau tidak aktif.");

        const layananRecord = layanan as Record<string, unknown>;
        const jenisSuratFromDatabase = String(layananRecord.nama ?? payload.jenis_surat);

        const today = new Date().toISOString().slice(0, 10);
        const { count, error: countError } = await client.from("pengajuan_surat").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`);
        if (countError) {
            console.error("SUPABASE COUNT PENGAJUAN_SURAT ERROR");
            console.dir(countError, { depth: null });
            throw new SupabaseOperationError("SUPABASE COUNT PENGAJUAN_SURAT ERROR", countError);
        }
        const sequence = (count ?? 0) + 1;
        nomor_pengajuan = createNomorPengajuan(sequence);
        nomor_tiket = createNomorTiket(sequence);
        tracking_url = createTrackingUrl(nomor_pengajuan);

        const ktpUpload = ktpMeta?.path ? { path: ktpMeta.path } : null;
        const kkUpload = kkMeta?.path ? { path: kkMeta.path } : null;
        const pendukungUpload = pendukungMeta?.path ? { path: pendukungMeta.path } : null;

        logUploadStage("DATABASE PATH", {
            bucket: SUBMISSION_STORAGE_BUCKET,
            file_ktp: ktpUpload?.path ?? null,
            file_kk: kkUpload?.path ?? null,
            file_pendukung: pendukungUpload?.path ?? null,
        });

        const [rt = "", rw = ""] = payload.rt_rw.split("/").map((part) => part.trim());
        const pengajuanPayload = {
            layanan_id: payload.layanan_id,
            nik: payload.nik,
            nama_lengkap: payload.nama_lengkap,
            nomor_kk: payload.nomor_kk,
            tempat_lahir: payload.tempat_lahir,
            tanggal_lahir: payload.tanggal_lahir,
            jenis_kelamin: payload.jenis_kelamin,
            agama: payload.agama,
            status_perkawinan: payload.status_perkawinan,
            pekerjaan: payload.pekerjaan,
            alamat: payload.alamat,
            rt,
            rw,
            kelurahan: payload.kelurahan,
            kecamatan: payload.kecamatan,
            no_hp: payload.nomor_hp,
            email: payload.email,
            keperluan: payload.keperluan,
            catatan: payload.catatan || null,
            nomor_pengajuan,
            status: "Menunggu Verifikasi",
            file_ktp: ktpUpload?.path ?? null,
            file_kk: kkUpload?.path ?? null,
            file_pendukung: pendukungUpload?.path ?? null,
            consent_given: true,
        };

        logUploadStage("[surat-online:pengajuan-insert:start]", { stage: "pengajuan_insert", hasKtpPath: Boolean(pengajuanPayload.file_ktp), hasKkPath: Boolean(pengajuanPayload.file_kk), hasPendukungPath: Boolean(pengajuanPayload.file_pendukung) });
        console.log("[CREATE SUBMISSION] payload:", pengajuanPayload);

        const { data: pengajuan, error } = await client.from("pengajuan_surat").insert(pengajuanPayload).select("id,nomor_pengajuan,status,created_at").single();
        if (error) {
            logSupabaseStageError("[surat-online:pengajuan-insert:error]", error, { stage: "pengajuan_insert" });
            throw new SupabaseOperationError("PENGAJUAN INSERT ERROR", error, "pengajuan_insert");
        }

        const { error: verificationError } = await client.from("verifikasi_pengajuan").insert(createVerificationRows(pengajuan.id));
        if (verificationError) {
            logSupabaseStageError("[surat-online:verification-insert:error]", verificationError, { stage: "verification_insert" });
            throw new SupabaseOperationError("SUPABASE INSERT VERIFIKASI_PENGAJUAN ERROR", verificationError, "verification_insert");
        }

        const dokumenPayload = [
            ...(ktpUpload?.path
                ? [{
                    pengajuan_id: pengajuan.id,
                    nama_file: "KTP",
                    url_file: ktpUpload.path,
                    jenis: "KTP",
                }]
                : []),
            ...(kkUpload?.path
                ? [{
                    pengajuan_id: pengajuan.id,
                    nama_file: "KK",
                    url_file: kkUpload.path,
                    jenis: "KK",
                }]
                : []),
            ...(pendukungUpload?.path
                ? [{
                    pengajuan_id: pengajuan.id,
                    nama_file: "Dokumen Pendukung",
                    url_file: pendukungUpload.path,
                    jenis: "Pendukung",
                }]
                : []),
        ];

        const { error: dokumenError } = dokumenPayload.length > 0
            ? await client.from("dokumen_pengajuan").insert(dokumenPayload)
            : { error: null };
        if (dokumenError) {
            logSupabaseStageError("[surat-online:dokumen-insert:error]", dokumenError, { stage: "dokumen_insert" });
            throw new SupabaseOperationError("SUPABASE INSERT DOKUMEN_PENGAJUAN ERROR", dokumenError, "dokumen_insert");
        }

        const { error: trackingError } = await client.from("tracking_pengajuan").insert({
            pengajuan_id: pengajuan.id,
            status: "Menunggu Verifikasi",
            keterangan: "Permohonan diterima dan masuk tahap Verifikasi Staff Pelayanan.",
            petugas: null,
        });
        if (trackingError) {
            logSupabaseStageError("[surat-online:tracking-insert:error]", trackingError, { stage: "tracking_insert" });
            throw new SupabaseOperationError("PENGAJUAN TRACKING ERROR", trackingError, "tracking_insert");
        }

        await createWargaNotification({ pengajuanId: pengajuan.id, nik: payload.nik, status: "submitted" }).catch((notificationError) => {
            console.error("WARGA NOTIFICATION INSERT ERROR");
            console.dir(notificationError, { depth: null });
        });

        await client.from("pengajuan_audit_logs").insert(["CONSENT_GIVEN", "DECLARATION_ACCEPTED", "PHYSICAL_PROOF_GENERATED", "APPLICATION_SUBMITTED"].map((action) => ({ pengajuan_id: pengajuan.id, user_id: null, action })));

        try {
            const n8nResult = await forwardToN8n("surat-online/created", { nomor_pengajuan, nomor_tiket, tracking_url, email: payload.email, nomor_hp: payload.nomor_hp, status: "Menunggu Verifikasi" });
            if ("ok" in n8nResult && n8nResult.ok === false) {
                console.error("N8N FORWARD ERROR");
                console.dir(n8nResult, { depth: null });
            }
        } catch (n8nError) {
            console.error("N8N FORWARD ERROR");
            console.dir(n8nError, { depth: null });
        }

        try {
            const emailResult = await sendPengajuanEmail({
                to: payload.email,
                nama: payload.nama_lengkap,
                nomor_pengajuan,
                nomor_tiket,
                tanggal: pengajuan.created_at ?? new Date().toISOString(),
                jenis_pelayanan: jenisSuratFromDatabase,
                tracking_url,
            });
            if ("ok" in emailResult && emailResult.ok === false) {
                console.error("RESEND EMAIL ERROR");
                console.dir(emailResult, { depth: null });
            }
        } catch (emailError) {
            console.error("RESEND EMAIL ERROR");
            console.dir(emailError, { depth: null });
        }

        return {
            ...pengajuanPayload,
            ...pengajuan,
            jenis_surat: jenisSuratFromDatabase,
            nomor_tiket,
            tracking_url,
            layanan: { nama: jenisSuratFromDatabase },
            tracking_pengajuan: [{
                status: "Menunggu Verifikasi",
                keterangan: "Permohonan diterima dan masuk tahap Verifikasi Staff Pelayanan.",
                petugas: null,
                created_at: pengajuan.created_at,
            }],
        };
    } catch (error) {
        console.error("===== CREATE SUBMISSION FULL ERROR =====");
        console.dir(error, { depth: null });
        throw error;
    } finally {
        // State loading/hasil ditangani oleh client pemanggil; cleanup error ditangani di catch.
    }
}

export async function searchSubmission(query: string) {
    if (typeof window !== "undefined") {
        try {
            const response = await fetch(`/api/surat-online/tracking?q=${encodeURIComponent(query)}`);
            const result = await response.json().catch(() => null);
            const message = typeof result?.error === "string" ? result.error : result?.error?.message;
            if (!response.ok || !result?.ok) throw new Error(message ?? "Gagal mengambil status pengajuan.");
            return result.data ?? [];
        } catch (error) {
            console.error("SURAT ONLINE CLIENT SEARCH ERROR");
            console.dir(error, { depth: null });
            throw error;
        } finally {
            // State loading ditangani komponen pemanggil.
        }
    }

    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");
    const q = query.trim();
    if (!q) return [];
    const { data, error } = await client.from("pengajuan_surat").select("*, layanan(*), tracking_pengajuan(*), dokumen_pengajuan(*)").or(`nomor_pengajuan.eq.${q},nik.eq.${q}`).order("created_at", { referencedTable: "tracking_pengajuan", ascending: true });
    if (error) {
        console.error("SUPABASE SEARCH SUBMISSION ERROR");
        console.dir(error, { depth: null });
        throw error;
    }
    return data ?? [];
}

export async function updateSubmissionStatus(id: string, status: string, catatan?: string, petugas?: string, file_surat_url?: string, petugasId?: string) {
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");
    if (!petugasId) throw new Error("ID petugas dari session admin wajib tersedia untuk mengubah status pengajuan.");

    const now = new Date().toISOString();
    const normalizedStatus = status === "Sedang Diproses" ? "Diproses" : status;
    const updatePayload: Record<string, string | null | undefined> = {
        status: normalizedStatus,
        updated_at: now,
        catatan_admin: catatan ?? null,
        file_surat_url,
    };

    if (normalizedStatus === "Terverifikasi") {
        updatePayload.verified_at = now;
        updatePayload.verified_by = petugasId;
        updatePayload.alasan_penolakan = null;
    } else if (normalizedStatus === "Diproses") {
        updatePayload.diproses_at = now;
        updatePayload.diproses_by = petugasId;
        updatePayload.alasan_penolakan = null;
    } else if (normalizedStatus === "Selesai") {
        updatePayload.selesai_at = now;
        updatePayload.selesai_by = petugasId;
        updatePayload.alasan_penolakan = null;
    } else if (normalizedStatus === "Ditolak") {
        if (!catatan?.trim()) throw new Error("Alasan penolakan wajib diisi.");
        updatePayload.alasan_penolakan = catatan.trim();
    } else {
        throw new Error("Status pengajuan tidak valid untuk workflow admin.");
    }

    const { data, error } = await client.from("pengajuan_surat").update(updatePayload).eq("id", id).select("*").single();
    if (error) {
        console.error("SUPABASE UPDATE PENGAJUAN_SURAT ERROR");
        console.dir(error, { depth: null });
        throw error;
    }

    const { error: trackingError } = await client.from("tracking_pengajuan").insert({
        pengajuan_id: id,
        status: normalizedStatus,
        keterangan: catatan ?? null,
        petugas,
        created_at: now,
    });
    if (trackingError) {
        console.error("SUPABASE INSERT STATUS TRACKING_PENGAJUAN ERROR");
        console.error(trackingError);
        console.dir(trackingError, { depth: null });
        throw trackingError;
    }

    const notificationStatus = notificationStatusFromSubmissionStatus(normalizedStatus);
    if (notificationStatus) {
        await createWargaNotification({ pengajuanId: id, nik: data.nik, status: notificationStatus, catatan }).catch((notificationError) => {
            console.error("WARGA STATUS NOTIFICATION INSERT ERROR");
            console.dir(notificationError, { depth: null });
        });
    }

    try {
        const tracking_url = createTrackingUrl(data.nomor_pengajuan);
        const n8nResult = await forwardToN8n("surat-online/status", {
            nomor_pengajuan: data.nomor_pengajuan,
            status,
            catatan,
            petugas,
            tracking_url,
            whatsapp_message: `Assalamu'alaikum.\n\nPermohonan Surat Anda\n\nNomor:\n${data.nomor_pengajuan}\n\nStatus:\n${status}\n\nSilakan cek:\n${tracking_url}\n\nKelurahan Tamansari`,
        });
        if ("ok" in n8nResult && n8nResult.ok === false) {
            console.error("N8N STATUS FORWARD ERROR");
            console.dir(n8nResult, { depth: null });
        }
    } catch (n8nError) {
        console.error("N8N STATUS FORWARD ERROR");
        console.dir(n8nError, { depth: null });
    }
    return data;
}