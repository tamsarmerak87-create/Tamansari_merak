import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseBrowserClient } from "@/services/supabase";
import { forwardToN8n } from "@/services/integrations";

export const STATUS_STEPS = ["Permohonan diterima", "Verifikasi", "Diproses", "Ditandatangani", "Selesai"] as const;
export const SUBMISSION_STATUS = ["Menunggu Verifikasi", "Verifikasi", "Diproses", "Ditandatangani", "Selesai", "Ditolak"] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const submissionSchema = z.object({
    layanan_id: z.string().min(1, "Jenis layanan wajib dipilih"),
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

export function validateUploadFile(file: File) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) throw new Error("File harus PDF, JPG, atau PNG.");
    if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran file maksimal 5 MB.");
}

export function getProgressFromStatus(status?: string) {
    if (status === "Selesai") return 5;
    if (status === "Ditandatangani") return 4;
    if (status === "Diproses") return 3;
    if (status === "Verifikasi" || status === "Menunggu Verifikasi") return 2;
    return 1;
}

export function createNomorPengajuan(sequence: number, date = new Date()) {
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    return `TMS-${stamp}-${String(sequence).padStart(4, "0")}`;
}

export async function getLayananList() {
    const client = createSupabaseBrowserClient();
    if (!client) return [];
    const { data, error } = await client.from("layanan").select("*").order("nama_layanan", { ascending: true });
    if (error) throw error;
    return data ?? [];
}

export async function createSubmission(formData: FormData) {
    if (typeof window !== "undefined") {
        const response = await fetch("/api/surat-online/pengajuan", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error ?? "Gagal mengirim pengajuan.");
        return result.data;
    }

    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");

    const payload = submissionSchema.parse(Object.fromEntries(formData.entries()));
    const ktp = formData.get("ktp") as File | null;
    const kk = formData.get("kk") as File | null;
    const pendukung = formData.get("pendukung") as File | null;
    if (!ktp || !kk) throw new Error("Upload KTP dan KK wajib diisi.");
    [ktp, kk, pendukung].filter(Boolean).forEach((file) => validateUploadFile(file as File));

    const today = new Date().toISOString().slice(0, 10);
    const { count } = await client.from("pengajuan_surat").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`);
    const nomor_pengajuan = createNomorPengajuan((count ?? 0) + 1);

    const uploadedPaths: string[] = [];
    let pengajuanId: string | null = null;

    const cleanup = async () => {
        try {
            if (pengajuanId) {
                await client.from("tracking_pengajuan").delete().eq("id_pengajuan", pengajuanId);
                await client.from("dokumen_pengajuan").delete().eq("id_pengajuan", pengajuanId);
                await client.from("pengajuan_surat").delete().eq("id", pengajuanId);
            }
            if (uploadedPaths.length > 0) await client.storage.from("surat").remove(uploadedPaths);
        } catch (cleanupError) {
            console.error("[surat-online:rollback]", cleanupError);
        }
    };

    const uploadOne = async (folder: "ktp" | "kk" | "pendukung", file: File | null) => {
        if (!file) return null;
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${folder}/${nomor_pengajuan}-${Date.now()}.${ext}`;
        const { error } = await client.storage.from("surat").upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        uploadedPaths.push(path);
        return client.storage.from("surat").getPublicUrl(path).data.publicUrl;
    };

    try {
        const ktp_url = await uploadOne("ktp", ktp);
        const kk_url = await uploadOne("kk", kk);
        const pendukung_url = await uploadOne("pendukung", pendukung);

        const { data: pengajuan, error } = await client.from("pengajuan_surat").insert({ ...payload, nomor_pengajuan, status: "Menunggu Verifikasi", ktp_url, kk_url, pendukung_url }).select("*").single();
        if (error) throw error;
        pengajuanId = pengajuan.id;

        const { error: dokumenError } = await client.from("dokumen_pengajuan").insert([
            { id_pengajuan: pengajuan.id, jenis_dokumen: "KTP", file_url: ktp_url },
            { id_pengajuan: pengajuan.id, jenis_dokumen: "KK", file_url: kk_url },
            ...(pendukung_url ? [{ id_pengajuan: pengajuan.id, jenis_dokumen: "Dokumen Pendukung", file_url: pendukung_url }] : []),
        ]);
        if (dokumenError) throw dokumenError;

        const { error: trackingError } = await client.from("tracking_pengajuan").insert({ id_pengajuan: pengajuan.id, status: "Menunggu Verifikasi", progress: 1, catatan: "Permohonan diterima dan menunggu verifikasi." });
        if (trackingError) throw trackingError;

        await forwardToN8n("surat-online/created", { nomor_pengajuan, email: payload.email, nomor_hp: payload.nomor_hp, status: "Menunggu Verifikasi" });

        return pengajuan;
    } catch (error) {
        await cleanup();
        throw error;
    }
}

export async function searchSubmission(query: string) {
    if (typeof window !== "undefined") {
        const response = await fetch(`/api/surat-online/tracking?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error ?? "Gagal mengambil status pengajuan.");
        return result.data ?? [];
    }

    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");
    const q = query.trim();
    const { data, error } = await client.from("pengajuan_surat").select("*, tracking_pengajuan(*), dokumen_pengajuan(*)").or(`nomor_pengajuan.eq.${q},nik.eq.${q}`).order("created_at", { referencedTable: "tracking_pengajuan", ascending: true });
    if (error) throw error;
    return data ?? [];
}

export async function updateSubmissionStatus(id: string, status: string, catatan?: string, petugas?: string, file_surat_url?: string) {
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");
    const progress = getProgressFromStatus(status);
    const { data, error } = await client.from("pengajuan_surat").update({ status, catatan_admin: catatan, petugas, file_surat_url }).eq("id", id).select("*").single();
    if (error) throw error;
    await client.from("tracking_pengajuan").insert({ id_pengajuan: id, status, progress, petugas, catatan });
    await forwardToN8n("surat-online/status", { nomor_pengajuan: data.nomor_pengajuan, status, catatan, petugas });
    return data;
}